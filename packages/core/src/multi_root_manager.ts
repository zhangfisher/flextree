/**
 *
 * 多根树管理器
 *
 * 基于隐藏根（Hidden Root）模式实现多根树：
 * 内部持有一个单树 FlexTreeManager，物理上表里就是一棵普通的单根树，
 * 由本管理器自动创建并维护一个隐藏根（level=0、leftValue=1），
 * 用户视角的"多根"即隐藏根的子节点（物理 level=1，对外归一化为 0）。
 *
 * 本类是纯委托层，不实现任何树逻辑，因此 FlexTreeManager 的全部能力
 * （跨"根"移动、根间真实兄弟导航、verify/repair、copy、forEach）原样保留。
 *
 * 与 FlexTreeManager 的 API 差异：
 *  - 不提供 getRoot/hasRoot/createRoot（多根语义下无意义）
 *  - 新增 .nodes：同步返回用户根节点列表（每次 write 后自动刷新）
 *  - toJson 返回多根嵌套数组
 *
 */
import mitt from "mitt";
import { FlexTreeManager, type FlexTreeManagerOptions } from "./manager";
import { FlexTree } from "./tree";
import {
  FlexTreeError,
  FlexTreeNodeInvalidOperationError,
  FlexTreeNodeNotFoundError,
} from "./errors";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  FlexTreeEvents,
  FlexTreeExportJsonOptions,
  FlexTreeExportListOptions,
  FlexTreeExportJsonFormat,
  FlexTreeExportListFormat,
  FlexTreeNodeInput,
  FlexTreeNodeRelation,
  IFlexTreeNodeFields,
  NonUndefined,
} from "./types";
import { FlexNodeRelPosition } from "./types";
import type { FlexTreeCopyOptions } from "./mixins/copy.mixin";
import type { ForEachOptions } from "./mixins/forEach.mixin";
import { isNull } from "./utils/isNull";

/** 隐藏根的默认名称 */
export const HIDDEN_ROOT_NAME = "__root__";

export type MultiRootFlexTreeManagerOptions<TreeIdType = any> = FlexTreeManagerOptions<TreeIdType> & {
  /** 隐藏根节点名称，默认 __root__ */
  hiddenRootName?: string;
};

export class MultiRootFlexTreeManager<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  // 单例实例存储 Map<tableName, instance>
  private static _instances = new Map<string, MultiRootFlexTreeManager>();

  // 内部单树管理器（直接 new，不走 getInstance，避免注册进 FlexTreeManager 的单例表）
  private _manager: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, any>;
  private _emitter = mitt<FlexTreeEvents>();
  // 用户根节点列表缓存，write 完成后刷新
  private _nodes: TreeNode[] = [];
  private _hiddenRootName: string;
  private _loaded = false;

  constructor(
    tableName: string,
    options?: MultiRootFlexTreeManagerOptions<NonUndefined<KeyFields["treeId"]>[1]>,
  ) {
    if (options?.treeId !== undefined) {
      throw new FlexTreeError("Multi-root tree is based on a single-tree table, treeId is not allowed");
    }
    if (!options?.adapter) {
      throw new FlexTreeError("not found database adapter");
    }
    this._hiddenRootName = options?.hiddenRootName ?? HIDDEN_ROOT_NAME;
    this._manager = new FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, any>(
      tableName,
      options as FlexTreeManagerOptions<any>,
    );
    this._forwardEvents();
  }

  /**
   * 获取 MultiRootFlexTreeManager 单例实例
   * @param tableName 表名
   * @param options 配置选项
   */
  static getInstance<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  >(
    tableName: string,
    options?: MultiRootFlexTreeManagerOptions<any>,
  ): MultiRootFlexTreeManager<Fields, KeyFields> {
    const existingInstance = MultiRootFlexTreeManager._instances.get(tableName);
    if (existingInstance) {
      return existingInstance as MultiRootFlexTreeManager<Fields, KeyFields>;
    }
    const newInstance = new MultiRootFlexTreeManager<Fields, KeyFields>(tableName, options);
    MultiRootFlexTreeManager._instances.set(tableName, newInstance as any);
    return newInstance;
  }

  static clearInstance(tableName: string) {
    if (tableName) {
      MultiRootFlexTreeManager._instances.delete(tableName);
    } else {
      MultiRootFlexTreeManager._instances.clear();
    }
  }

  /**
   * 初始化：检查并自愈隐藏根，刷新用户根列表缓存
   *
   * 隐藏根被外部删除后，下次 load 会自动重建。
   * 重复调用安全（幂等，仅刷新缓存）。
   */
  async load() {
    if (!(await this._manager.hasRoot())) {
      await this._manager.write(async () => {
        // 二次检查：write 串行化后确认仍无根
        if (!(await this._manager.hasRoot())) {
          await this._manager.createRoot({ name: this._hiddenRootName } as Partial<TreeNode>);
        }
      });
    }
    await this._refreshNodes();
    this._loaded = true;
  }

  /**
   * 重新查询用户根列表并写入缓存
   */
  private async _refreshNodes() {
    const root = await this._manager.getRoot();
    if (!root) {
      this._nodes = [];
      return;
    }
    this._nodes = this._normalizeNodes(
      (await this._manager.getChildren(root)).filter((n: any) => !this._isHiddenRoot(n)) as TreeNode[],
    );
  }

  // ============================== 透传属性 ==============================

  get options() {
    return this._manager.options;
  }
  get escaper() {
    return this._manager.escaper;
  }
  get updating() {
    return this._manager.updating;
  }
  get tableName() {
    return this._manager.tableName;
  }
  get adapter() {
    return this._manager.adapter;
  }
  get keyFields() {
    return this._manager.keyFields;
  }
  get updateAt() {
    return this._manager.updateAt;
  }
  get treeId(): undefined {
    return undefined;
  }
  get isLoaded() {
    return this._loaded;
  }

  /**
   * 用户根节点列表（同步）
   *
   * 每次 write 完成后自动刷新；level 已归一化（用户根 level=0）
   */
  get nodes(): TreeNode[] {
    return this._nodes;
  }

  get on() {
    return this._emitter.on.bind(this);
  }
  get off() {
    return this._emitter.off.bind(this);
  }
  get emit() {
    return this._emitter.emit.bind(this);
  }

  // ============================== 内部工具 ==============================

  /**
   * 判定节点是否为隐藏根（单树表中 leftValue=1 全表唯一，结构判定不受改名影响）
   */
  private _isHiddenRoot(node: any): boolean {
    return !!node && node[this.keyFields.leftValue] === 1;
  }

  /**
   * level 归一化：浅拷贝并减 1（用户根物理 level=1，对外显示 0）
   *
   * 浅拷贝而非原地修改：避免污染调用方持有的节点对象引用
   */
  private _normalizeNode(node: TreeNode): TreeNode {
    if (!node) return node;
    const levelField = this.keyFields.level;
    return { ...node, [levelField]: (node as any)[levelField] - 1 } as TreeNode;
  }

  private _normalizeNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.map((n) => this._normalizeNode(n));
  }

  /**
   * 转发子管理器的节点事件到本管理器（载荷保持原样）
   *
   * beforeWrite/afterWrite 不转发，由本管理器的 write 自行发出
   */
  private _forwardEvents() {
    const events = ["node:added", "node:deleted", "node:cleared", "node:updated", "node:moved"];
    for (const evt of events as (keyof FlexTreeEvents)[]) {
      this._manager.on(evt, (payload: any) => {
        this._emitter.emit(evt, payload);
      });
    }
  }

  /**
   * 递归修正 toJson 导出结果中的 level（仅 includeKeyFields 时存在 level 字段）
   */
  private _fixJsonLevel(result: any, childrenField: string): any {
    if (result && typeof result === "object" && this.keyFields.level in result) {
      result[this.keyFields.level] = result[this.keyFields.level] - 1;
    }
    const children = result?.[childrenField];
    if (Array.isArray(children)) {
      for (const child of children) {
        this._fixJsonLevel(child, childrenField);
      }
    }
    return result;
  }

  // ============================== 读方法 ==============================

  /**
   * 获取节点列表（不含隐藏根，level 已归一化）
   *
   * @param options.level 限定返回的层级（用户视角：1=只返回根节点，2=根+子节点，依次类推）
   * @param options.fields 限定返回的字段名称
   * @param options.where WHERE 过滤条件（注意：条件中的 level 为物理值，比用户视角大 1）
   * @param options.includeRecyclebin 默认 false：回收站（bin 及其后代）在数据库端被排除
   */
  async getNodes(
    options?: {
      level?: number;
      fields?: (keyof TreeNode)[];
      where?: string;
      includeRecyclebin?: boolean;
    },
  ): Promise<TreeNode[]> {
    // 用户视角第 N 层 = 物理 level ∈ [1..N]（用户根=物理1），与子 manager 的
    // level<=N 语义一致，无需换算，仅过滤隐藏根
    const result = await this._manager.getNodes(options);
    return this._normalizeNodes(
      result.filter((n: any) => !this._isHiddenRoot(n)) as TreeNode[],
    );
  }

  /**
   * 根据 id 获取节点
   *
   * 隐藏根对外不存在：命中时抛 FlexTreeNodeNotFoundError
   * 启用回收站时默认过滤站内节点（includeRecyclebin=true 时包含）
   */
  async getNode(
    nodeId: NodeId,
    options?: { includeRecyclebin?: boolean },
  ): Promise<TreeNode | undefined> {
    const node = await this._manager.getNode(nodeId, options);
    if (this._isHiddenRoot(node)) {
      throw new FlexTreeNodeNotFoundError();
    }
    return this._normalizeNode(node as TreeNode);
  }

  /**
   * 根据输入参数返回节点数据（物理值，level 不归一化——供写方法解析参数使用）
   *
   * 多根树没有唯一默认节点：param 为空时抛错
   */
  async getNodeData(param: any): Promise<TreeNode> {
    if (isNull(param)) {
      throw new FlexTreeError("Multi-root tree requires an explicit node parameter");
    }
    const node = await this._manager.getNodeData(param);
    if (this._isHiddenRoot(node)) {
      throw new FlexTreeNodeNotFoundError();
    }
    return node;
  }

  /**
   * 获取指定节点的所有后代（level 已归一化；相对 level 无需换算）
   *
   * @param nodeId 为空时返回所有用户节点（相当于 getNodes()）
   * @param options.includeRecyclebin 默认 false：回收站内容在数据库端被排除
   */
  async getDescendants(
    nodeId?: NodeId | TreeNode,
    options?: { level?: number; includeSelf?: boolean; includeRecyclebin?: boolean },
  ): Promise<TreeNode[]> {
    if (isNull(nodeId)) {
      return await this.getNodes(options);
    }
    // 参数经 any 中转：NodeId | TreeNode 的泛型联合会触发 TS2590（联合类型过于复杂）
    return this._normalizeNodes(
      (await this._manager.getDescendants(nodeId as any, options)) as TreeNode[],
    );
  }

  /**
   * 获取后代节点数量
   */
  async getDescendantCount(
    nodeId: NodeId | TreeNode,
    options?: { level?: number; includeRecyclebin?: boolean },
  ) {
    return await this._manager.getDescendantCount(nodeId, options);
  }

  /**
   * 获取子节点集合（过滤隐藏根；nodeId 为空时返回用户根列表）
   */
  async getChildren(
    nodeId: NodeId | TreeNode,
    options?: { includeRecyclebin?: boolean },
  ): Promise<TreeNode[]> {
    const result = await this._manager.getChildren(nodeId, options);
    return this._normalizeNodes(
      result.filter((n: any) => !this._isHiddenRoot(n)) as TreeNode[],
    );
  }

  /**
   * 获取所有祖先节点（不含隐藏根；用户根返回 []）
   */
  async getAncestors(nodeId: NodeId | TreeNode, options?: { includeSelf?: boolean }) {
    const result = await this._manager.getAncestors(nodeId, options);
    return this._normalizeNodes(
      result.filter((n: any) => !this._isHiddenRoot(n)) as TreeNode[],
    );
  }

  /**
   * 获取祖先节点数量（不含隐藏根；用户根返回 0）
   */
  async getAncestorsCount(nodeId: NodeId | TreeNode) {
    // 参数经 any 中转：NodeId | TreeNode 的泛型联合会触发 TS2590（联合类型过于复杂）
    const count = await this._manager.getAncestorsCount(nodeId as any);
    return Math.max(0, count - 1);
  }

  /**
   * 获取父节点（level 已归一化）
   *
   * 用户根没有父节点：命中隐藏根时抛 FlexTreeNodeNotFoundError
   */
  async getParent(nodeId: NodeId | TreeNode): Promise<TreeNode> {
    const parent = await this._manager.getParent(nodeId);
    if (this._isHiddenRoot(parent)) {
      throw new FlexTreeNodeNotFoundError();
    }
    return this._normalizeNode(parent);
  }

  /**
   * 获取所有兄弟节点（level 已归一化；用户根之间是真实的兄弟关系）
   */
  async getSiblings(
    nodeId: NodeId | TreeNode,
    options?: { includeSelf?: boolean; includeRecyclebin?: boolean },
  ) {
    return this._normalizeNodes(await this._manager.getSiblings(nodeId, options));
  }

  /**
   * 获取下一个兄弟节点（最后一个用户根返回 undefined）
   */
  async getNextSibling(
    nodeId: NodeId | TreeNode,
    options?: { includeRecyclebin?: boolean },
  ) {
    const node = await this._manager.getNextSibling(nodeId, options);
    return node ? this._normalizeNode(node) : node;
  }

  /**
   * 获取上一个兄弟节点（第一个用户根返回 undefined）
   */
  async getPreviousSibling(
    nodeId: NodeId | TreeNode,
    options?: { includeRecyclebin?: boolean },
  ) {
    const node = await this._manager.getPreviousSibling(nodeId, options);
    return node ? this._normalizeNode(node) : node;
  }

  /**
   * 返回满足条件的第一个节点（不含隐藏根；条件中的 level 自动按用户视角换算）
   */
  async findNode(
    node: NodeId | Partial<TreeNode>,
    options?: { includeRecyclebin?: boolean },
  ): Promise<TreeNode | null> {
    let nodes: TreeNode[] = [];
    if (typeof node === "object") {
      nodes = await this.findNodes(node as Partial<TreeNode>, options);
    } else {
      nodes = await this.findNodes({ [this.keyFields.id]: node } as Partial<TreeNode>, options);
    }
    if (nodes.length === 0) {
      return null;
    }
    return nodes[0];
  }

  /**
   * 返回满足条件的节点（不含隐藏根；条件中的 level 自动按用户视角换算）
   */
  async findNodes(
    condition: Partial<TreeNode>,
    options?: { includeRecyclebin?: boolean },
  ): Promise<TreeNode[]> {
    let cond = condition as any;
    const levelField = this.keyFields.level;
    if (cond && levelField in cond && typeof cond[levelField] === "number") {
      // 拷贝条件对象换算 level，避免污染调用方入参
      cond = { ...cond, [levelField]: cond[levelField] + 1 };
    }
    const result = await this._manager.findNodes(cond, options);
    return this._normalizeNodes(
      result.filter((n: any) => !this._isHiddenRoot(n)) as TreeNode[],
    );
  }

  /**
   * 获取两个节点之间的关系
   */
  async getNodeRelation(
    srcNode: NodeId | TreeNode,
    targetNode: NodeId | TreeNode,
  ): Promise<FlexTreeNodeRelation> {
    return await this._manager.getNodeRelation(srcNode, targetNode);
  }

  /**
   * 判断节点是否为用户根
   *
   * 同时兼容物理数据（用户根 level=1）与归一化数据（用户根 level=0）
   */
  isRoot(node: TreeNode): boolean {
    const level = (node as any)[this.keyFields.level];
    const leftValue = (node as any)[this.keyFields.leftValue];
    return level === 1 || (level === 0 && leftValue !== 1);
  }

  /**
   * 判断给定的节点数据是否有效
   */
  isValidNode(node: any): boolean {
    return this._manager.isValidNode(node);
  }

  /**
   * 返回两个节点是否在同一棵树中（多根树恒为 true）
   */
  isSameTree(node1: TreeNode, node2: TreeNode) {
    return this._manager.isSameTree(node1, node2);
  }

  /**
   * 判断两个节点是否相同
   */
  isSameNode(node1: TreeNode, node2: TreeNode) {
    return this._manager.isSameNode(node1, node2);
  }

  /**
   * 遍历树节点（回调收到归一化数据，不包含隐藏根）
   *
   * @param options.maxLevel 用户视角层级（1=只遍历根节点）；缺省遍历全部
   */
  async forEach(
    callback: (node: TreeNode, children: TreeNode[]) => boolean,
    options: ForEachOptions = {},
  ): Promise<void> {
    // 包装 callback：隐藏根跳过（不调用户回调、不中断遍历），
    // 其余节点与 children 均做 level 归一化
    const wrapped = (node: any, children: any[]) => {
      if (this._isHiddenRoot(node)) {
        return true;
      }
      return callback(
        this._normalizeNode(node),
        this._normalizeNodes(children.filter((c: any) => !this._isHiddenRoot(c))),
      );
    };
    // maxLevel 是物理层比较（_forEachDFS 用节点物理 level 与 maxLevel 比较），
    // 用户视角 N 层 = 物理 [1..N]，无需换算
    await this._manager.forEach(wrapped, options);
  }

  /**
   * 校验树的完整性（透传：隐藏根满足全部物理校验）
   */
  async verify(): Promise<boolean> {
    return await this._manager.verify();
  }

  // ============================== 写方法 ==============================

  /**
   * 执行更新操作
   *
   * 与 FlexTreeManager.write 语义一致：写锁、事务、读守卫均由内部单树管理器承载，
   * 回调参数为本管理器实例。每次 write 结束后自动刷新 .nodes 缓存。
   */
  async write(fn: (tree: MultiRootFlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>) => Promise<void>) {
    this._emitter.emit("beforeWrite");
    try {
      await this._manager.write(async () => {
        await fn(this);
      });
    } finally {
      await this._refreshNodes();
      this._emitter.emit("afterWrite");
    }
  }

  /**
   * 增加多个节点
   *
   * 未指定 at 时挂到隐藏根下 = 新增用户根
   */
  async addNodes<Children extends string = "children">(
    nodes: FlexTreeNodeInput<Fields, KeyFields, Children>[],
    options?: {
      at?: NodeId | TreeNode | null;
      pos?: FlexNodeRelPosition;
      childrenField?: Children;
      includeRecyclebin?: boolean;
    },
  ): Promise<void>;
  async addNodes(
    nodes: Partial<TreeNode>[],
    atNode?: NodeId | TreeNode | null,
    pos?: FlexNodeRelPosition,
  ): Promise<void>;
  async addNodes<Children extends string = "children">(
    nodes: any,
    optionsOrAt?: any,
    pos?: FlexNodeRelPosition,
  ): Promise<void> {
    await this._manager.addNodes(nodes, optionsOrAt, pos);
  }

  /**
   * 删除指定节点及其子节点
   *
   * 隐藏根不可删除：命中时抛 FlexTreeNodeInvalidOperationError
   * options.recycle/includeRecyclebin 语义与 FlexTreeManager.deleteNode 一致
   */
  async deleteNode(
    nodeId: NodeId | TreeNode,
    options?: { detach?: boolean; recycle?: boolean; includeRecyclebin?: boolean },
  ): Promise<void> {
    if (isNull(nodeId)) {
      throw new FlexTreeNodeInvalidOperationError("Hidden root node can not be deleted");
    }
    // 经子 manager 解析（mm.getNodeData 对隐藏根抛 NotFound，此处需要区分错误类型）
    const nodeData = await this._manager.getNodeData(nodeId);
    if (this._isHiddenRoot(nodeData)) {
      throw new FlexTreeNodeInvalidOperationError("Hidden root node can not be deleted");
    }
    await this._manager.deleteNode(nodeId, options);
  }

  /**
   * 清空回收站（透传子 manager；未启用时静默返回）
   */
  async clearRecycleBin(): Promise<void> {
    await this._manager.clearRecycleBin();
  }

  /**
   * 判断节点是否位于回收站内（透传子 manager）
   */
  async isInRecycleBin(node: NodeId | TreeNode): Promise<boolean> {
    return await this._manager.isInRecycleBin(node as any);
  }

  /**
   * 判断节点是否是回收站节点本身（透传子 manager）
   */
  isRecycleBin(node: NodeId | TreeNode): boolean {
    return this._manager.isRecycleBin(node as any);
  }

  /**
   * 清除所有用户节点并重建隐藏根
   */
  async clear() {
    await this._manager.clear();
    await this._manager.createRoot({ name: this._hiddenRootName } as Partial<TreeNode>);
  }

  /**
   * 移动节点到指定位置（跨"根"移动即普通同树移动，天然支持）
   * 选项对象可含 includeRecyclebin（回收站视角），语义与 FlexTreeManager.moveNode 一致
   */
  async moveNode(
    node: NodeId | TreeNode,
    toNode?: NodeId | TreeNode,
    posOrOptions: FlexNodeRelPosition | { pos?: FlexNodeRelPosition; includeRecyclebin?: boolean } = FlexNodeRelPosition.NextSibling,
  ) {
    await this._manager.moveNode(node as any, toNode as any, posOrOptions as any);
  }

  /**
   * 节点上移（第一个用户根抛 FlexTreeNodeInvalidOperationError）
   */
  async moveUpNode(node: NodeId | TreeNode) {
    await this._manager.moveUpNode(node);
  }

  /**
   * 节点下移（最后一个用户根抛 FlexTreeNodeInvalidOperationError）
   */
  async moveDownNode(node: NodeId | TreeNode) {
    await this._manager.moveDownNode(node);
  }

  /**
   * 返回 node 是否允许移动到 toNode 的指定位置
   */
  async canMoveTo(
    node: NodeId | TreeNode,
    toNode?: NodeId | TreeNode,
    options?: { pos?: FlexNodeRelPosition; includeRecyclebin?: boolean },
  ) {
    return await this._manager.canMoveTo(node as any, toNode as any, options as any);
  }

  /**
   * 复制节点（返回副本根，level 已归一化）
   */
  async copyNode(
    nodeId: NodeId | TreeNode,
    options?: FlexTreeCopyOptions<NodeId, TreeNode, TreeId>,
  ): Promise<TreeNode> {
    const copyRoot = await this._manager.copyNode(nodeId, options as any);
    return this._normalizeNode(copyRoot);
  }

  /**
   * 更新节点数据（关键字段外的其他字段）
   */
  async update(
    node: Partial<TreeNode> | Partial<TreeNode>[],
    options?: { includeRecyclebin?: boolean },
  ) {
    await this._manager.update(node as any, options);
  }

  /**
   * 修复当前树的破坏结构（修复后刷新用户根缓存）
   */
  async repair() {
    await this._manager.repair();
    await this._refreshNodes();
  }

  // ============================== 导出 ==============================

  /**
   * 导出为多根嵌套数组（level 已归一化）
   */
  async toJson(
    options?: FlexTreeExportJsonOptions<Fields, KeyFields>,
  ): Promise<FlexTreeExportJsonFormat<Fields, KeyFields>[]> {
    const tree = this._buildExportTree();
    await tree.load();
    const childrenField = options?.childrenField ?? "children";
    return (tree.root?.children ?? []).map((child) =>
      this._fixJsonLevel(child.toJson(options), childrenField),
    ) as FlexTreeExportJsonFormat<Fields, KeyFields>[];
  }

  /**
   * 导出为平面列表（用户根的 pid 为 0，不泄漏隐藏根 id；level 已归一化）
   */
  async toList(
    options?: FlexTreeExportListOptions<Fields, KeyFields>,
  ): Promise<FlexTreeExportListFormat<Fields, KeyFields>> {
    const tree = this._buildExportTree();
    await tree.load();
    const pidField = options?.pidField ?? "pid";
    const results: any[] = [];
    for (const child of tree.root?.children ?? []) {
      const list = child.toList(options) as any[];
      if (list.length > 0) {
        // 用户根子树的首元素 pid 指向隐藏根，修正为 0
        list[0][pidField] = 0;
        if (this.keyFields.level in list[0]) {
          list[0][this.keyFields.level] = list[0][this.keyFields.level] - 1;
        }
        for (let i = 1; i < list.length; i++) {
          if (this.keyFields.level in list[i]) {
            list[i][this.keyFields.level] = list[i][this.keyFields.level] - 1;
          }
        }
        results.push(...list);
      }
    }
    return results as FlexTreeExportListFormat<Fields, KeyFields>;
  }

  /**
   * 构建用于导出的 FlexTree（其 root 即隐藏根，children 即用户根）
   */
  private _buildExportTree(): FlexTree<Fields, KeyFields> {
    return this._manager.getTree();
  }
}
