/**
 *
 * 多根内存树
 *
 * 与 FlexTree 对 FlexTreeManager 的关系完全对称：把多根树加载到内存，
 * 构建查询优先的对象树（FlexTreeNode 实例），加载后全部导航零数据库查询。
 *
 * 直连 MultiRootFlexTreeManager 读取（ADR-0007）：数据天然无隐藏根、
 * level 已归一化，内存树中不存在隐藏根——用户根即顶层节点（parent=undefined）。
 *
 * Live Tree 全套继承（脏标记、提交确认后自动全量重载、重载中读抛
 * FlexTreeDirtyError、自身写免重载），lazy 支持与 FlexTree 一致。
 *
 * 与 FlexTree 的 API 差异：
 *  - .nodes 返回用户根节点实例列表（取代 .root，多根无单根）
 *  - id 恒为 undefined（多根树禁 treeId）
 *  - toJson 返回多根嵌套数组；toList 中用户根 pid=0
 *  - load() 空树（零用户根）是合法终态：nodes=[]、status='loaded'
 *  - getByPath 首段在用户根中匹配；'/' 无根锚点，返回 undefined
 *
 */
import type { RequiredDeep } from "type-fest";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  FlexTreeExportJsonFormat,
  FlexTreeExportJsonOptions,
  FlexTreeExportListFormat,
  FlexTreeExportListOptions,
  IFlexTreeNodeFields,
  NonUndefined,
} from "./types";
import {
  MultiRootFlexTreeManager,
  type MultiRootFlexTreeManagerOptions,
} from "./multi_root_manager";
import { FlexTreeNode, type FlexTreeNodeStatus } from "./node";
import { FlexTreeDirtyError, FlexTreeError, FlexTreeNotFoundError } from "./errors";
import { AsyncLocalStorage } from "./utils/asyncLocalStage";

export type MultiRootFlexTreeOptions<TreeIdType = any> = MultiRootFlexTreeManagerOptions<TreeIdType> & {
  lazy?: boolean; // 是否懒加载树
};

export class MultiRootFlexTree<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  NodeFields extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<
    Fields,
    KeyFields
  >,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  // 单例实例存储 Map<tableName+lazy, instance>（多根树无 treeId，键不含树维度）
  private static _instances = new Map<string, MultiRootFlexTree>();
  private _options: RequiredDeep<MultiRootFlexTreeOptions<KeyFields["treeId"]>>;
  private _manager: MultiRootFlexTreeManager<Fields, KeyFields, NodeFields, NodeId, any>;
  // 用户根节点实例列表（内存树的顶层）
  private _nodes: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>[] = [];
  private _loaded = false;

  // Live Tree 状态：_dirty=脏（含重载失败后的持续脏），_reloading=重载进行中
  private _dirty = false;
  private _reloading = false;
  // lazy 归树实例自身持有（与 FlexTree 同构：单例 manager 是共享配置，lazy 是读取行为）
  private _lazy: boolean;
  // 自身发起的写链路标记：update 写路径已同步刷新内存数据，
  // 其触发的 node:* 事件无须再走"置脏→自动重载"回路
  private _selfWriteCtx = new AsyncLocalStorage<boolean>();
  // countField 可见口径的 Bin 区间（回收站启用时预取，节点 toNodeData 读取）
  _binRangeForCount?: { left: number; right: number } | null;

  constructor(
    tableName: string,
    options?: MultiRootFlexTreeOptions<NonUndefined<KeyFields["treeId"]>[1]>,
  ) {
    // Live Tree：manager 走单例，与用户的 MultiRootFlexTreeManager 共享实例，事件才可达。
    // lazy 不透传给 manager（避免单例命中时被首建配置顶掉），由本实例持有
    const { lazy, ...managerOptions } = options || {};
    this._lazy = !!lazy;
    this._manager = MultiRootFlexTreeManager.getInstance<Fields, KeyFields>(
      tableName,
      managerOptions as MultiRootFlexTreeManagerOptions<any>,
    ) as MultiRootFlexTreeManager<Fields, KeyFields, NodeFields, NodeId, any>;
    this._options = { ...this._manager.options, lazy: this._lazy } as RequiredDeep<
      MultiRootFlexTreeOptions<KeyFields["treeId"]>
    >;
    this._bindLiveEvents();
  }

  /**
   * 获取 MultiRootFlexTree 单例实例
   * 以 tableName+lazy 为键（多根树无 treeId 维度），机制与 FlexTree.getInstance 同构：
   * 同表的懒/非懒形态各自持有实例；命中已存在实例时校验 adapter 一致性。
   * 单例树共享加载状态（load/dirty/自动重载），适合"多处获取同一棵活树"的场景。
   */
  static getInstance<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  >(
    tableName: string,
    options?: MultiRootFlexTreeOptions<NonUndefined<KeyFields["treeId"]>[1]>,
  ): MultiRootFlexTree<Fields, KeyFields> {
    const lazyKey = `${tableName}#${options?.lazy ? "lazy" : "full"}`;
    const existingInstance = MultiRootFlexTree._instances.get(lazyKey);
    if (existingInstance) {
      if (options?.adapter && existingInstance.manager.adapter !== options.adapter) {
        throw new FlexTreeError(
          `MultiRootFlexTree instance for ${lazyKey} already exists with a different adapter`,
        );
      }
      return existingInstance as MultiRootFlexTree<Fields, KeyFields>;
    }
    const newInstance = new MultiRootFlexTree<Fields, KeyFields>(tableName, options);
    MultiRootFlexTree._instances.set(lazyKey, newInstance as any);
    return newInstance as MultiRootFlexTree<Fields, KeyFields>;
  }

  /**
   * 清理 MultiRootFlexTree 单例注册
   * 不传参数清空全部；传表名时连带清理其懒/非懒形态
   */
  static clearInstance(tableName?: string) {
    if (tableName) {
      MultiRootFlexTree._instances.delete(tableName);
      MultiRootFlexTree._instances.delete(`${tableName}#full`);
      MultiRootFlexTree._instances.delete(`${tableName}#lazy`);
      for (const key of MultiRootFlexTree._instances.keys()) {
        if (key.startsWith(`${tableName}#`)) {
          MultiRootFlexTree._instances.delete(key);
        }
      }
    } else {
      MultiRootFlexTree._instances.clear();
    }
  }

  /**
   * Live Tree 事件订阅（与 FlexTree._bindLiveEvents 同构，详见 CONTEXT.md「Live Tree」）
   *
   * 任一 node:* 事件在事务内先挂起，待 write:after 携带 committed=true 确认提交后：
   * 置 dirty=true 并自动启动全量重载。committed=false（回滚）：数据库未变，丢弃挂起信号。
   * 重载期间（_reloading=true）的读操作抛 FlexTreeDirtyError。
   */
  private _bindLiveEvents() {
    let eventsPending = false;
    for (const event of [
      "node:added",
      "node:deleted",
      "node:recycled",
      "node:moved",
      "node:cleared",
      "node:updated",
    ] as const) {
      this._manager.on(event, () => {
        eventsPending = true;
      });
    }
    this._manager.on("write:after", (payload) => {
      if (payload && payload.committed === false) {
        // 回滚：数据库未变，丢弃挂起信号
        eventsPending = false;
        return;
      }
      if (eventsPending) {
        eventsPending = false;
        // 自身发起的写（_selfWriteCtx 内）：写路径已同步刷新内存数据，无须重载
        if (this._selfWriteCtx.getStore() === true) return;
        this._markDirtyAndReload();
      }
    });
  }

  /**
   * 置脏并启动全量重载（fire-and-forget：不阻塞写事务的调用方）
   *
   * 重载失败时保持 dirty=true——数据确实变了，内存树不可信，读取仍应报错。
   * 树尚未 load 过（!_loaded）时不自动重载：显式 load 前无内存树可失效。
   * 与 FlexTree 不同：零用户根是多根树的合法终态（隐藏根仍在表内），
   * load 不会因空抛 NotFound，重载天然以 nodes=[] 清脏收场。
   */
  private _markDirtyAndReload() {
    this._dirty = true;
    if (!this._loaded) return;
    this._reloading = true;
    this.load()
      .catch(() => {
        // 其他失败保持脏态：内存树不可信，读取持续报错
      })
      .finally(() => {
        this._reloading = false;
      });
  }

  /**
   * 读守卫：重载进行中的读操作抛 FlexTreeDirtyError
   */
  private _guardRead() {
    if (this._reloading) {
      throw new FlexTreeDirtyError(
        "MultiRootFlexTree is reloading after a committed write; read after the reload completes",
      );
    }
  }

  /**
   * 整树脏标记：已提交写确认树已变化（true=内存树不可信，读取前须完成自动重载）
   */
  get dirty() {
    return this._dirty;
  }

  /**
   * 恒为 undefined（多根树基于单树表，禁 treeId）
   */
  get id() {
    return undefined;
  }

  get options() {
    return this._options;
  }

  get on() {
    return this._manager.on.bind(this._manager);
  }

  get off() {
    return this._manager.off.bind(this._manager);
  }

  get emit() {
    return this._manager.emit.bind(this._manager);
  }

  get manager() {
    return this._manager!;
  }

  get lazy() {
    return this._lazy;
  }

  /**
   * 用户根节点实例列表（内存树顶层；未 load 时为空数组）
   */
  get nodes(): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>[] {
    this._guardRead();
    return this._nodes;
  }

  /**
   * 树的加载状态：按根聚合（error > loading > idle > loaded；零根=loaded；未 load=idle）
   */
  get status(): FlexTreeNodeStatus {
    if (!this._loaded) return "idle";
    if (this._nodes.length === 0) return "loaded";
    const statuses = this._nodes.map((n) => n.status);
    if (statuses.includes("error")) return "error";
    if (statuses.includes("loading")) return "loading";
    if (statuses.includes("idle")) return "idle";
    return "loaded";
  }

  /**
   * 单根语义的根节点：多根树无单根，恒为 undefined（FlexTreeNodeHost 接口占位）
   */
  get root(): undefined {
    this._guardRead();
    return undefined;
  }

  /**
   * 加载整棵多根树到内存（一次 getNodes 全量取数，树层组栈建树）
   *
   * 空树（零用户根）是合法终态：nodes=[]、status='loaded'、不抛错。
   * 重载成功后清除脏标记；失败则保留旧树并保持脏态。
   */
  async load() {
    const prevNodes = this._nodes;
    const prevLoaded = this._loaded;
    this._nodes = [];
    this._loaded = true;
    try {
      await this._buildMemoryTree();
      await this.prepareCountContext();
      this._dirty = false;
    } catch (e) {
      // 失败回退：保留旧树并保持脏态——数据已变，新树不完整不可用
      this._nodes = prevNodes;
      this._loaded = prevLoaded;
      this._dirty = true;
      throw e;
    }
  }

  /**
   * 全量取数并组栈建树（Q13b：一次 SQL，树层组装）
   *
   * getNodes 按 leftValue 升序返回全部用户节点（隐藏根已被过滤、level 已归一化，
   * 用户根 level=0）。组栈规则与 FlexTreeNode.load 相同：level 等值挂兄弟、
   * +1 下探挂子、回退弹栈；归一化 level 的相对差值与物理 level 一致，逻辑原样可用。
   * lazy 模式只建到用户根的第一层（maxLevel=1）。
   */
  private async _buildMemoryTree() {
    // lazy 取归一化 level∈[0..1]（用户根+一级子节点）：物理 level<=2 经归一化即 [0..1]
    const maxLevel = this._lazy ? 1 : 0; // 懒加载时只加载用户根及其一级子节点
    const nodes = (await this._manager.getNodes(
      maxLevel > 0 ? { level: maxLevel + 1 } : undefined,
    )) as unknown as NodeFields[];
    if (nodes.length === 0) return; // 空树：合法终态

    const keyFields = this._manager.keyFields;
    const roots: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>[] = [];
    // 组栈：栈顶为"待挂下一个子节点的节点"，与 FlexTreeNode.load 的 pnodes 同构
    const pnodes: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>[] = [];
    let preNode: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any> | undefined;

    for (const data of nodes) {
      const nodeLevel = (data as any)[keyFields.level];
      const nodeLeftValue = (data as any)[keyFields.leftValue];
      const nodeRightValue = (data as any)[keyFields.rightValue];

      if (nodeLevel === 0) {
        // 用户根：顶层节点，parent=undefined
        const root = new FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>(
          data,
          undefined,
          this as any,
        );
        roots.push(root);
        pnodes.length = 0;
        pnodes.push(root);
        preNode = root;
        continue;
      }
      if (!preNode) {
        throw new FlexTreeNotFoundError("Invalid multi-root tree structure: orphan node");
      }
      if (nodeLevel === preNode.level) {
        const parent = pnodes[pnodes.length - 1];
        const nodeObj = new FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>(
          data,
          parent,
          this as any,
        );
        parent.children!.push(nodeObj);
        preNode = nodeObj;
      } else if (nodeLevel > preNode.level) {
        if (nodeLevel === preNode.level + 1) {
          const nodeObj = new FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>(
            data,
            preNode,
            this as any,
          );
          preNode.children!.push(nodeObj);
          preNode = nodeObj;
          if (
            nodeRightValue - nodeLeftValue > 1 &&
            (maxLevel === 0 || (maxLevel > 0 && nodeLevel < maxLevel))
          ) {
            pnodes.push(preNode);
          }
        } else {
          throw new FlexTreeNotFoundError("Invalid multi-root tree structure");
        }
      } else if (nodeLevel < preNode.level) {
        while (true) {
          const parent = pnodes[pnodes.length - 1];
          if (parent && nodeLevel === parent.level + 1) {
            const nodeObj = new FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>(
              data,
              parent,
              this as any,
            );
            parent.children!.push(nodeObj);
            preNode = nodeObj;
            if (
              nodeRightValue - nodeLeftValue > 1 &&
              (maxLevel === 0 || (maxLevel > 0 && nodeLevel < maxLevel))
            ) {
              pnodes.push(preNode);
            }
            break;
          } else if (pnodes.length === 0) {
            throw new FlexTreeNotFoundError("Invalid multi-root tree structure: orphan node");
          } else {
            pnodes.pop();
          }
        }
      }
    }
    this._nodes = roots;
    // 组栈由树层完成（节点未走 node.load），补标已装载节点的状态。
    // lazy 截断层以下的节点不在此列：FlexTree 的懒语义是"有子孙但未加载的节点
    // 状态保持 idle、children=[]"——由 updateSelf 的 children=[] + 默认 idle 表达，
    // 此处只标记本次已真正载入内存数据的节点（即本次组栈遍历到的节点）。
    const loaded = new Set<object>();
    const collect = (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>) => {
      loaded.add(node);
      for (const child of node.children ?? []) {
        collect(child);
      }
    };
    for (const root of roots) {
      collect(root);
    }
    // 遍历原始行而非树：lazy 截断处的中间节点（如根下的 A1，其子未载入）也在本次
    // 数据行内——其自身数据已载入，状态应为 loaded（children=[] 表示"子未加载"）
    for (const node of loaded) {
      if ((node as any).status !== "loaded") {
        (node as any)._status = "loaded";
      }
    }
  }

  /**
   * 根据路径获取节点：首段在用户根中按 byField 匹配，剩余路径委托节点层解析
   *
   * - 'A/A-1'：首段 A 匹配用户根，'A-1' 在该根内解析
   * - './A' 等价 'A'；'/' 与 '../' 无根锚点可上溯，返回 undefined
   * - 懒加载模式下路径中未加载的节点返回 undefined（与 FlexTree 一致）
   */
  getByPath(
    path: string,
    options?: { byField?: string; delimiter?: string },
  ): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any> | undefined {
    this._guardRead();
    const { byField, delimiter } = Object.assign(
      { byField: this._manager.keyFields.name, delimiter: "/" },
      options,
    );
    // 剥离 './' 前缀（树层无"当前节点"，'./' 即从用户根层开始）
    let relPath = path;
    const curPrefix = `.${delimiter}`;
    while (relPath.startsWith(curPrefix) && !relPath.startsWith(`..${delimiter}`)) {
      relPath = relPath.substring(curPrefix.length);
    }
    // '/' 或 '../' 开头：多根树无根锚点/父级可上溯，视为路径不存在
    if (relPath.startsWith(delimiter) || relPath.startsWith(`..${delimiter}`) || relPath === "..") {
      return undefined;
    }
    const segments = relPath.split(delimiter).filter((s) => s !== "");
    if (segments.length === 0) return undefined;
    // 首段在用户根中匹配
    const root = this._nodes.find((n) => (n.fields as any)[byField] === segments[0]);
    if (!root) return undefined;
    if (segments.length === 1) return root;
    // 剩余路径在该根内解析（沿用节点层相对路径语义）
    return root.getByPath(segments.slice(1).join(delimiter), { byField, delimiter });
  }

  /**
   * 根据路径更新节点数据（路径解析与 getByPath 同锚点；路径不存在抛 FlexTreeNotFoundError）
   */
  async update(path: string, data: Partial<NodeFields>) {
    const node = this.getByPath(path);
    if (!node) {
      throw new FlexTreeNotFoundError(`Node ${path} not found`);
    }
    // 自身发起的写：node.update 成功后已同步刷新内存节点数据，
    // 其触发的 node:updated/write:after 不再走自动重载回路（见 _bindLiveEvents）
    await this._selfWriteCtx.run(true, async () => {
      await node.update(data);
    });
  }

  /**
   * 重新从数据库加载整棵树数据（结构不变，仅刷新已加载节点的数据）
   */
  async sync() {
    if (this._loaded) {
      await Promise.all(this._nodes.map((n) => n.sync(true)));
      await this.prepareCountContext();
      this._dirty = false;
    }
  }

  /**
   * 根据节点 id 或条件获取节点实例（在全部用户树中查找）
   */
  get(
    nodeIdOrCondition:
      | NodeId
      | ((node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>) => boolean),
  ): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any> | undefined {
    this._guardRead();
    // 参数经 any 中转：NodeId | 条件函数 的泛型联合会触发过载匹配失败（与 node.get 同因）
    const arg = nodeIdOrCondition as any;
    if (typeof arg !== "function") {
      for (const root of this._nodes) {
        const found = root.get(arg as NodeId);
        if (found) return found;
      }
      return undefined;
    }
    for (const root of this._nodes) {
      if (arg(root)) return root;
      const found = root.get(arg);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * 查找第一个满足条件的节点（范围：全部用户树，不含层级截断语义）
   */
  find(
    condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>) => boolean,
  ): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any> | undefined {
    this._guardRead();
    for (const root of this._nodes) {
      if (condition(root)) return root;
      const found = root.find(condition);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * 查找所有满足条件的节点（范围：全部用户树）
   */
  findAll(
    condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>) => boolean,
  ): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>[] {
    this._guardRead();
    const results: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>[] = [];
    for (const root of this._nodes) {
      if (condition(root)) results.push(root);
      results.push(...root.findAll(condition));
    }
    return results;
  }

  /**
   * 遍历全部用户树的节点（各根独立遍历，回调语义与 FlexTree.forEach 一致）
   */
  forEach(
    callback: (
      node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any>,
      parent: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId, any> | undefined,
    ) => void,
    options?: { includeSelf?: boolean; ignoreErrors?: boolean; mode?: "dfs" | "bfs" },
  ) {
    this._guardRead();
    for (const root of this._nodes) {
      root.forEach(callback, { includeSelf: true, ...options });
    }
  }

  /**
   * 预取 Bin 区间供导出链路计算可见口径的 count（ADR-0006）
   *
   * - 未启用回收站时无操作
   * - load/sync 后无参调用：提前预取，供后续同步的 toJson/toList({countField}) 使用；
   *   显式传入 options 时按 options 刷新
   * - 内部 manager 的 Bin 区间缓存在每次 write 提交后失效，这里预取的值仅服务本次导出
   */
  async prepareCountContext(options?: { countField?: string }) {
    const manager = this._manager as any;
    if (!manager.recycleBinEnabled || manager.recycleBinDisableFilter) {
      this._binRangeForCount = undefined;
      return;
    }
    if (options && !options.countField) {
      this._binRangeForCount = undefined;
      return;
    }
    // load/sync 的无参预取：已有值则跳过（避免重复查询）
    if (!options && this._binRangeForCount !== undefined) return;
    this._binRangeForCount = (await this._manager._getBinRange()) ?? null;
  }

  /**
   * 导出为多根嵌套数组（同步，基于内存树；level 已归一化）
   */
  toJson(
    options?: FlexTreeExportJsonOptions<Fields, KeyFields>,
  ): FlexTreeExportJsonFormat<Fields, KeyFields>[] {
    this._guardRead();
    return this._nodes.map((n) => n.toJson(options)) as FlexTreeExportJsonFormat<
      Fields,
      KeyFields
    >[];
  }

  /**
   * 导出为平面列表（同步，基于内存树；用户根 pid=0，不泄漏隐藏根 id）
   */
  toList(
    options?: FlexTreeExportListOptions<Fields, KeyFields>,
  ): FlexTreeExportListFormat<Fields, KeyFields> {
    this._guardRead();
    const results: any[] = [];
    for (const root of this._nodes) {
      const list = root.toList(options) as any[];
      // 用户根无父节点：toList 内 pid 已按"无父=0"处理（parent=undefined）
      results.push(...list);
    }
    return results as FlexTreeExportListFormat<Fields, KeyFields>;
  }
}
