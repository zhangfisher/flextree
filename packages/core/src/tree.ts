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
import { FlexTreeManager, type FlexTreeManagerOptions } from "./manager";
import { FlexTreeNode, type FlexTreeNodeStatus } from "./node";
import { FlexTreeDirtyError, FlexTreeError, FlexTreeNotFoundError } from "./errors";
import { AsyncLocalStorage } from "./utils/asyncLocalStage";

export type FlexTreeOptions<TreeIdType = any> = FlexTreeManagerOptions<TreeIdType> & {
  lazy?: boolean; // 是否懒加载树
};
export type FlexTreeStatus = FlexTreeNodeStatus;

export class FlexTree<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  NodeFields extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<
    Fields,
    KeyFields
  >,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  // 单例实例存储 Map<tableName+treeId+lazy, instance>
  // 键含 lazy：lazy 归 FlexTree 实例所有，同表同树的懒/非懒树是不同实例
  private static _instances = new Map<string, FlexTree>();
  private _options: RequiredDeep<FlexTreeOptions<KeyFields["treeId"]>>;
  private _treeId: TreeId;
  private _manager: FlexTreeManager<Fields, KeyFields, NodeFields, NodeId, TreeId>;
  private _root?: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>;

  // Live Tree 状态：_dirty=脏（含重载失败后的持续脏），_reloading=重载进行中
  private _dirty = false;
  private _reloading = false;
  // lazy 归 FlexTree 自身持有：单例 manager 是共享配置（adapter/fields/treeId/recyclebin），
  // lazy 是树的读取行为——同表同树可同时存在懒/非懒两棵 FlexTree（详见 CONTEXT.md「Live Tree」）
  private _lazy: boolean;
  // 自身发起的写链路标记：FlexTree.update 等内部写会同步刷新内存数据，
  // 其触发的 node:* 事件无须再走"置脏→自动重载"回路（避免读写竞争与冗余重载）
  private _selfWriteCtx = new AsyncLocalStorage<boolean>();

  constructor(tableName: string, options?: FlexTreeOptions<NonUndefined<KeyFields["treeId"]>[1]>) {
    // Live Tree：内部 manager 走单例，与用户的 FlexTreeManager 共享实例，事件才可达（详见 CONTEXT.md）
    // lazy 不透传给 manager（避免单例命中时被首建配置顶掉），由本实例持有
    const { lazy, ...managerOptions } = options || {};
    this._lazy = !!lazy;
    this._manager = FlexTreeManager.getInstance<Fields, KeyFields>(
      tableName,
      managerOptions as FlexTreeManagerOptions<any>,
    ) as FlexTreeManager<Fields, KeyFields, NodeFields, NodeId, TreeId>;
    this._treeId = this._manager.treeId;
    this._options = { ...this._manager.options, lazy: this._lazy } as RequiredDeep<
      FlexTreeOptions<KeyFields["treeId"]>
    >;
    this._bindLiveEvents();
  }

  /**
   * 获取 FlexTree 单例实例
   * 以 tableName+treeId+lazy 为键：与 FlexTreeManager 单例机制同构——
   * 多树表中同表不同树、同树的懒/非懒形态各自持有实例。
   * 命中已存在实例时校验 adapter 一致性，避免静默错连数据库。
   * 单例树共享加载状态（load/dirty/自动重载），适合"多处获取同一棵活树"的场景。
   * @param tableName 表名
   * @param options 配置选项
   * @returns FlexTree 实例
   */
  static getInstance<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  >(
    tableName: string,
    options?: FlexTreeOptions<NonUndefined<KeyFields["treeId"]>[1]>,
  ): FlexTree<Fields, KeyFields> {
    const treeId = options?.treeId;
    const key =
      treeId === undefined
        ? tableName
        : `${tableName}::${String(treeId)}`;
    const lazyKey = `${key}#${options?.lazy ? "lazy" : "full"}`;
    const existingInstance = FlexTree._instances.get(lazyKey);
    if (existingInstance) {
      if (options?.adapter && existingInstance.manager.adapter !== options.adapter) {
        throw new FlexTreeError(
          `FlexTree instance for ${lazyKey} already exists with a different adapter`,
        );
      }
      return existingInstance as FlexTree<Fields, KeyFields>;
    }
    const newInstance = new (FlexTree as any)(tableName, options);
    FlexTree._instances.set(lazyKey, newInstance);
    return newInstance as FlexTree<Fields, KeyFields>;
  }

  /**
   * 清理 FlexTree 单例注册
   * 不传参数清空全部；传表名时连带清理其多树实例（treeId 复合键）与懒/非懒形态
   */
  static clearInstance(tableName?: string) {
    if (tableName) {
      FlexTree._instances.delete(tableName);
      FlexTree._instances.delete(`${tableName}#full`);
      FlexTree._instances.delete(`${tableName}#lazy`);
      for (const key of FlexTree._instances.keys()) {
        // 多树复合键：tableName::treeId 与 tableName::treeId#lazy/#full
        if (key === tableName || key.startsWith(`${tableName}::`) || key.startsWith(`${tableName}#`)) {
          FlexTree._instances.delete(key);
        }
      }
    } else {
      FlexTree._instances.clear();
    }
  }

  /**
   * Live Tree 事件订阅（详见 CONTEXT.md「Live Tree」）
   *
   * 任一 node:* 事件（结构变化或数据更新）在事务内先挂起，待 write:after 携带
   * committed=true 确认提交后：置 dirty=true 并自动启动全量重载。
   * committed=false（回滚）：数据库未变，丢弃挂起信号，内存树保持有效。
   * 重载期间（_reloading=true）的读操作抛 FlexTreeDirtyError。
   */
  private _bindLiveEvents() {
    // 本批（当前 write 事务）内是否出现过任何 node:* 事件
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
   * 重载失败时保持 dirty=true——数据确实变了，内存树不可信，读取仍应报错；
   * 应用层可捕获 load 的 rejection 或稍后手动 load/sync 重试。
   * 树尚未 load 过（无 _root）时不自动重载：显式 load 前无内存树可失效。
   * clear() 后的空表是合法终态：NotFound 视为"无树"，清脏收场（load 的公开
   * 语义——空树抛错——保持不变，仅自动重载路径消化此场景）。
   */
  private _markDirtyAndReload() {
    this._dirty = true;
    if (!this._root) return;
    this._reloading = true;
    this.load()
      .catch((e) => {
        if (e instanceof FlexTreeNotFoundError) {
          // 树已被清空：合法的"无树"终态
          this._root = undefined;
          this._dirty = false;
          return;
        }
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
        "FlexTree is reloading after a committed write; read after the reload completes",
      );
    }
  }

  /**
   * 整树脏标记：已提交写确认树已变化（true=内存树不可信，读取前须完成自动重载）
   */
  get dirty() {
    return this._dirty;
  }

  get id() {
    return this._treeId;
  }

  get options() {
    return this._options;
  }

  get on() {
    return this._manager.on.bind(this);
  }

  get off() {
    return this._manager.off.bind(this);
  }

  get emit() {
    return this._manager.emit.bind(this);
  }

  get manager() {
    return this._manager!;
  }

  get root() {
    this._guardRead();
    return this._root;
  }
  get status() {
    if (!this._root) {
      return "idle";
    } else {
      return this._root.status;
    }
  }
  /**
   * 加载树到内存中（重载成功后清除脏标记）
   */
  async load() {
    const prevRoot = this._root;
    this._root = new FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>(
      undefined,
      undefined,
      this,
    );
    try {
      await this._root.load();
      await this.prepareCountContext();
      this._dirty = false;
    } catch (e) {
      // 失败回退：保留旧树并保持脏态——数据已变，新树不完整不可用
      this._root = prevRoot;
      this._dirty = true;
      throw e;
    }
  }
  getByPath(
    path: string,
    options?: { byField?: string; delimiter?: string },
  ): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
    this._guardRead();
    return this.root?.getByPath(path, options);
  }
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
  async sync() {
    if (this._root) {
      await this._root.sync(true);
      await this.prepareCountContext();
      this._dirty = false;
    }
  }
  /**
   * 根据节点id获取节点实例
   */
  get(nodeId: NodeId): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined;
  get(
    condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean,
  ): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined;
  get(): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
    this._guardRead();
    const nodeId = arguments[0];
    if (nodeId === this._root?.id) {
      return this._root;
    } else {
      return this._root?.get(nodeId);
    }
  }

  /**
   *
   * @param condition
   * @returns 返回满足条件的节点列表
   */
  find(
    condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean,
  ): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
    this._guardRead();
    return this._root!.find(condition);
  }
  findAll(
    condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean,
  ): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>[] {
    this._guardRead();
    return this._root!.findAll(condition);
  }
  forEach(
    callback: (
      node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>,
      parent: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined,
    ) => void,
    options?: { includeSelf?: boolean; ignoreErrors?: boolean; mode?: "dfs" | "bfs" },
  ) {
    this._guardRead();
    return this._root!.forEach(callback, options);
  }
  /**
   * 预取 Bin 区间供导出链路计算可见口径的 count（ADR-0006）
   *
   * - 未启用回收站或 recycleBinDisableFilter=true（includeRecyclebin 视角）时无操作
   * - load/sync 后无参调用：提前预取，供后续同步的 toJson/toList({countField}) 使用；
   *   显式传入 options 时按 options 刷新（manager.toJson/toList 调用链）
   * - 内部 manager 的 Bin 区间缓存在每次 write 提交后失效，这里预取的值仅服务本次导出
   */
  async prepareCountContext(options?: { countField?: string }) {
    const tree = this as any;
    const manager = this._manager as any;
    if (!manager.recycleBinEnabled || manager.recycleBinDisableFilter) {
      tree._binRangeForCount = undefined;
      return;
    }
    if (options && !options.countField) {
      tree._binRangeForCount = undefined;
      return;
    }
    // load/sync 的无参预取：已有值则跳过（避免重复查询）
    if (!options && tree._binRangeForCount !== undefined) return;
    tree._binRangeForCount = (await manager._getBinRange()) ?? null;
  }

  toJson(
    options?: FlexTreeExportJsonOptions<Fields, KeyFields>,
  ): FlexTreeExportJsonFormat<Fields, KeyFields> {
    this._guardRead();
    return this._root!.toJson(options);
  }

  toList(
    options?: FlexTreeExportListOptions<Fields, KeyFields>,
  ): FlexTreeExportListFormat<Fields, KeyFields> {
    this._guardRead();
    return this._root!.toList(options);
  }
}
