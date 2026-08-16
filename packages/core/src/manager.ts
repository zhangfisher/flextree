// oxlint-disable typescript/no-unsafe-declaration-merging
/**
 *
 * 树管理器,负责核心的树操作
 *
 */
import { deepMerge } from "flex-tools/object/deepMerge";
import type { RequiredDeep } from "type-fest";
import { mix } from "ts-mixer";
import mitt from "mitt";
import { AsyncLocalStorage } from "./utils/asyncLocalStage";
import type { IFlexTreeAdapter } from "./adapter";
import { FlexTreeDriverError, FlexTreeError, FlexTreeInvalidUpdateError } from "./errors";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  FlexTreeEvents,
  FlexTreeExportJsonOptions,
  FlexTreeExportListOptions,
  IFlexTreeNodeFields,
  NonUndefined,
} from "./types";
import { MoveNodeMixin } from "./mixins/move.mixin";
import { DeleteNodeMixin } from "./mixins/delete.mixin";
import { AddNodeMixin } from "./mixins/add.mixin";
import { CopyNodeMixin } from "./mixins/copy.mixin";
import { IsNodeMixin } from "./mixins/is.mixin";
import { SqlMixin } from "./mixins/sql.mixin";
import { GetNodeMixin } from "./mixins/get.mixin";
import { FindNodeMixin } from "./mixins/find.mixin";
import { RootNodeMixin } from "./mixins/root.mixin";
import { RelationMixin } from "./mixins/relation.mixin";
import { UpdateNodeMixin } from "./mixins/update.mixin";
import { VerifyTreeMixin } from "./mixins/verify.mixin";
import { ForEachMixin } from "./mixins/forEach.mixin";
import { RepairMixin } from "./mixins/repair.mixin";
import { RecycleMixin } from "./mixins/recycle.mixin";
import { createEscaper, Escaper } from "./escaper";
import { FlexTree, type FlexTreeOptions } from "./tree";

/**
 * 回收站配置：提供即启用回收站功能
 *
 * - id：回收站节点的 id；多树表下可传 (treeId) => id 函数实现每树各自建站
 * - name：回收站节点的名称
 */
export interface FlexTreeRecyclebinOptions<NodeId = any, TreeId = any> {
  id: NodeId | ((treeId: TreeId) => NodeId);
  name: string;
}

export interface FlexTreeManagerOptions<TreeIdType = any> {
  treeId?: TreeIdType; // 使用支持单表多树时需要提供
  fields?: {
    id?: string;
    name?: string;
    treeId?: string;
    level?: string;
    leftValue?: string;
    rightValue?: string;
  };
  /** 回收站配置，提供即启用（Bin 恒为根节点的子节点，默认视角下 Bin 及其后代逻辑不存在） */
  recyclebin?: FlexTreeRecyclebinOptions;
  adapter: IFlexTreeAdapter;
}

export interface FlexTreeManager<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
>
  extends
    MoveNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    DeleteNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    AddNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    CopyNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    IsNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    SqlMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    GetNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    FindNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    RootNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    RelationMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    UpdateNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    VerifyTreeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    ForEachMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    RepairMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    RecycleMixin<Fields, KeyFields, TreeNode, NodeId, TreeId> {}

/**
 *
 *
 *
 * 泛型:
 *  - Node:  除了关键字段外的其他字段
 *  - NodeId:  id字段的类型
 *  - TreeIdType:  treeId字段的类型
 *  - KeyFields: 当自定义的关键字段名称,需要提供该类型
 *
 */
@mix(
  MoveNodeMixin,
  DeleteNodeMixin,
  AddNodeMixin,
  CopyNodeMixin,
  IsNodeMixin,
  SqlMixin,
  GetNodeMixin,
  FindNodeMixin,
  RootNodeMixin,
  RelationMixin,
  UpdateNodeMixin,
  VerifyTreeMixin,
  ForEachMixin,
  RepairMixin,
  RecycleMixin,
)
// eslint-disable-next-line ts/no-unsafe-declaration-merging
export class FlexTreeManager<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  // eslint-disable-next-line unused-imports/no-unused-vars
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  // eslint-disable-next-line unused-imports/no-unused-vars
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  // 单例实例存储 Map<tableName+treeId, instance>
  private static _instances = new Map<string, FlexTreeManager>();

  private _options: RequiredDeep<FlexTreeManagerOptions<TreeId>>;
  private _isWriting = false;
  private _tableName: string;
  private _treeId: any;
  private _fields: RequiredDeep<NonUndefined<FlexTreeManagerOptions["fields"]>>;
  private _adapter: IFlexTreeAdapter;
  private _escaper: Escaper;
  private _connected: boolean = false;
  private _emitter = mitt<FlexTreeEvents>();
  private _lastUpdateAt = 0;
  // 回收站：bin 区间缓存（null=未加载，undefined=bin 不存在）与懒创建标记
  protected _binRange: { left: number; right: number } | null | undefined = null;
  protected _binEnsured = false;
  // 写事务上下文与完成 Promise：用于读守卫，避免外部读看到 write 事务的中间态
  private _writeCtx = new AsyncLocalStorage<boolean>();
  private _txPromise?: Promise<void>;
  // 本次 write 收集的 SQL：onExecuteSql 汇入，COMMIT 前聚合触发 write:commit
  protected _pendingSqls: string[] = [];

  constructor(
    tableName: string,
    options?: FlexTreeManagerOptions<NonUndefined<KeyFields["treeId"]>[1]>,
  ) {
    // 深度合并选项
    this._options = deepMerge(
      {
        treeId: undefined,
        singleton: true,
        fields: {
          id: "id",
          name: "name",
          treeId: "treeId",
          level: "level",
          leftValue: "leftValue",
          rightValue: "rightValue",
        },
      },
      options || {},
    ) as RequiredDeep<FlexTreeManagerOptions<TreeId>>;

    if (!this._options.adapter) {
      throw new FlexTreeError("not found database adapter");
    }

    // 初始化实例属性
    this._fields = this._options.fields;
    this._treeId = this.options.treeId;
    this._adapter = this.options.adapter;
    this._adapter.bind(this as FlexTreeManager);
    this._escaper = createEscaper(this._adapter.type || "postgresql");
    this._tableName = this._escaper.escapeId(tableName);
  }

  /**
   * 获取 FlexTreeManager 单例实例
   * 以 tableName+treeId 为键：多树表中同表不同树各自持有实例；
   * 命中已存在实例时校验 adapter 一致性，避免静默错连数据库
   *
   * 注意：内部以 new this(...) 构造而非 new FlexTreeManager(...)——ts-mixer 的 @mix
   * 装饰器返回新类并替换模块导出绑定，类体内对类名的词法引用仍是装饰前的原始类
   * （其实例缺失 mixin 方法）；this 是实际被调用的类（即装饰后的类）
   * @param tableName 表名
   * @param options 配置选项
   * @returns FlexTreeManager 实例
   */
  static getInstance<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  >(tableName: string, options?: FlexTreeManagerOptions<any>): FlexTreeManager<Fields, KeyFields> {
    const treeId = options?.treeId;
    const key = treeId === undefined ? tableName : `${tableName}::${String(treeId)}`;
    const existingInstance = FlexTreeManager._instances.get(key);
    if (existingInstance) {
      if (options?.adapter && existingInstance.adapter !== options.adapter) {
        throw new FlexTreeError(
          `FlexTreeManager instance for ${key} already exists with a different adapter`,
        );
      }
      return existingInstance as FlexTreeManager<Fields, KeyFields>;
    }
    // 创建新实例并注册到单例Map（构造函数会处理 options 和 adapter 检查）
    const newInstance = new (this as any)(tableName, options);
    FlexTreeManager._instances.set(key, newInstance);
    return newInstance as FlexTreeManager<Fields, KeyFields>;
  }

  static clearInstance(tableName?: string) {
    if (tableName) {
      // 同 getInstance 的键规则：tableName 可能已是复合键（历史遗留直接传入），也可能需要连带其多树实例
      FlexTreeManager._instances.delete(tableName);
      for (const key of FlexTreeManager._instances.keys()) {
        if (key.startsWith(`${tableName}::`)) {
          FlexTreeManager._instances.delete(key);
        }
      }
    } else {
      FlexTreeManager._instances.clear();
    }
  }

  get options() {
    return this._options;
  }
  get escaper() {
    return this._escaper;
  }

  get updating() {
    return this._isWriting;
  }

  get tableName() {
    return this._tableName;
  }

  get adapter() {
    return this._options.adapter!;
  }

  get treeId() {
    return this._treeId;
  }

  set treeId(value: TreeId) {
    this._treeId = value;
  }

  get keyFields() {
    return this._fields;
  }

  get updateAt() {
    return this._lastUpdateAt;
  }

  get isMultiTree() {
    return this._treeId !== undefined;
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

  async connected() {
    if (this._adapter && this._connected) {
      return true;
    }
    return false;
  }
  async assertConnected() {
    try {
      if (!this._adapter) {
        throw new FlexTreeDriverError();
      }
      if (!this._adapter.connected) {
        await this._adapter.open();
      }
    } catch (e: any) {
      throw new FlexTreeDriverError(e.message);
    }
    if (!this._adapter.connected) {
      throw new FlexTreeDriverError();
    }
  }

  /**
   * 执行更新操作
   *
   * 由于树更新操作需要破坏树的leftValue,rightValue等，
   * 所以需要严格禁止并发操作，因此所有的树更新操作需要通过update方法进行
   *
   * update方法通过设置isUpdating标志位来阻止并发操作
   *
   * tree.write(async ()=>{
   *
   * })
   *
   * @param fn
   */
  async write(fn: (tree: FlexTreeManager) => Promise<void>) {
    if (this._isWriting) {
      throw new FlexTreeInvalidUpdateError(
        "The tree is performing a write operation and does not support concurrent operations",
      );
    }
    this._isWriting = true;
    this._pendingSqls = [];
    this._emitter.emit("write:before");
    // 外部读守卫的完成信号：write 结束（提交/回滚）后 resolve，外部读据此解除等待
    let releaseTx!: () => void;
    this._txPromise = new Promise<void>((r) => {
      releaseTx = r;
    });
    // write:after 的提交结果标记：adapter.transaction 正常返回视为已提交，异常则为回滚
    let committed = false;
    try {
      // adapter.transaction 包住整个 fn：多个 onExecuteSql 共享一个事务，任一失败整体回滚（跨方法原子）。
      // _writeCtx.run 标记 write 调用链：fn 内的读（getStore 非空）直接放行看事务内状态；
      // 外部并发读（getStore 空）由 _guardRead 等待此事务完成，避免读到中间态（脏读）。
      await this.adapter.transaction(async () => {
        await this._writeCtx.run(true, async () => {
          await fn(this as FlexTreeManager);
          // 回收站启用时首次写操作懒创建 bin 节点（含位置不变量校验）。
          // 放在 fn 之后：fn 可能本身就在建根（createRoot/首次 addNodes(null)），
          // 之后 ensure 才能看到根并把 bin 挂上；须在 _writeCtx 内——
          // ensure 内部的读（getRoot/addNodes）经 _guardRead 放行看事务内状态，
          // 放在外层会等待 _txPromise 造成死锁
          await this._ensureBinNode();
          // write:commit：COMMIT 前聚合触发（须在事务回调内——回调返回后 adapter 即发 COMMIT）。
          // 只读通知：吞掉监听器异常，事务照常提交；空批（本次 write 未执行任何 SQL）不触发
          if (this._pendingSqls.length > 0) {
            try {
              this._emitter.emit("write:commit", {
                tree: this._treeId,
                sqls: this._pendingSqls,
              });
            } catch {
              // 事件不介入执行结果
            }
          }
        });
      });
      committed = true;
      this._lastUpdateAt = Date.now();
    } finally {
      releaseTx();
      this._txPromise = undefined;
      this._isWriting = false;
      this._pendingSqls = [];
      // 写事务结束（提交或回滚）：失效 bin 区间缓存，下次读重新加载
      this._invalidateBinRange();
      this._emitter.emit("write:after", { committed });
    }
  }

  /**
   * 在多树表中，需要在记录中注入treeId字段
   */
  protected withTreeId(record: Record<string, any>) {
    if (this.isMultiTree) {
      // 直接设置原始值，不进行转义，因为后续的escaper会处理转义
      record[this._fields.treeId] = this._treeId;
    }
  }

  protected _assertWriteable() {
    if (!this._isWriting) {
      throw new FlexTreeInvalidUpdateError(
        "The tree write operation must be performed within write(async ()=>{....})",
      );
    }
  }

  /**
   * 读守卫：write 进行中时，外部读（不在 write 调用链）等待 write 完成，避免读到事务中间态；
   * write fn 内的读（_writeCtx.getStore 非空）直接放行——它要看同事务内的状态（操作间互相可见）。
   */
  protected async _guardRead() {
    // getStore() === true 表示在 write 调用链内（内部读，放行）；否则为外部读，等待 write 完成
    if (this._txPromise && this._writeCtx.getStore() !== true) {
      await this._txPromise;
    }
  }
  getTree(options?: FlexTreeOptions) {
    // 需要传递未转义的表名，避免 FlexTreeManager 构造函数重复转义
    const rawTableName = this.tableName.replace(/^\[|\]$/g, "");
    // Live Tree：FlexTree 构造内部走 getInstance 单例。本 manager 若未注册单例
    // （直接 new 或 MultiRoot 内部 manager），先以同键注册自身——保证 getTree 出来的
    // 树与 this 事件互通；已注册时 getInstance 直接命中（键冲突即 adapter 冲突，校验兜底）
    const treeId = this.treeId;
    const key = treeId === undefined ? rawTableName : `${rawTableName}::${String(treeId)}`;
    if (!FlexTreeManager._instances.has(key)) {
      FlexTreeManager._instances.set(key, this as FlexTreeManager);
    }
    return new FlexTree<Fields, KeyFields>(rawTableName, {
      lazy: false,
      ...options,
      treeId: treeId as any,
      adapter: this.adapter,
      fields: this._fields,
      // 回收站配置透传：内部 FlexTreeManager 须同样启用，
      // 否则 toJson/toList 的加载链路（getDescendants）不会过滤 bin
      recyclebin: this.options.recyclebin,
    });
  }
  async toJson(
    options?: FlexTreeExportJsonOptions<Fields, KeyFields> & { includeRecyclebin?: boolean },
  ) {
    const tree = this.getTree();
    // includeRecyclebin=true：导出回收站视角（内部 manager 禁用 bin 过滤）。
    // 显式双向设置：getTree 走单例后树被复用，单向置 true 会泄漏到后续调用
    (tree as any).manager.recycleBinDisableFilter = !!options?.includeRecyclebin;
    await tree.load();
    await tree.prepareCountContext(options);
    return tree.toJson(options);
  }
  async toList(
    options?: FlexTreeExportListOptions<Fields, KeyFields> & { includeRecyclebin?: boolean },
  ) {
    const tree = this.getTree();
    (tree as any).manager.recycleBinDisableFilter = !!options?.includeRecyclebin;
    await tree.load();
    await tree.prepareCountContext(options);
    return tree.toList(options);
  }

  /**
   * 生成 count 计算的 SQL SELECT 表达式（数据库端计算，ADR-0006）
   *
   * 公式 (rightValue - leftValue - 1) / 2（差值恒为偶数，五方言整数除法无截断歧义）；
   * 可见口径：默认视角下 Bin 所在子树（left < binLeft AND right > binRight，即仅根/隐藏根）
   * 扣减 Bin 自身及其后代。返回 " AS <countField>" 形式，前缀为空串表示不需要
   *
   * @param countField 附加字段名（空串表示未指定）
   * @param includeRecyclebin true 时为物理口径（不扣减）
   * @param alias 字段前缀（如 "Node."），空串表示无前缀
   */
  protected async _countExpr(
    countField: string | undefined,
    includeRecyclebin: boolean,
    alias = "",
  ): Promise<string> {
    if (!countField) return "";
    const left = `${alias}${this.escaper.escapeId(this.keyFields.leftValue)}`;
    const right = `${alias}${this.escaper.escapeId(this.keyFields.rightValue)}`;
    let expr = `((${right}-${left}-1)/2)`;
    // 可见口径：Bin 子树整体落在该节点子树内时扣减其规模（Bin 自身 + 后代）
    const binRange =
      !includeRecyclebin && this.recycleBinEnabled ? await (this as any)._getBinRange() : undefined;
    if (binRange) {
      expr = `CASE WHEN ${left}<${binRange.left} AND ${right}>${binRange.right}
        THEN ${expr}-((${binRange.right}-${binRange.left}-1)/2+1) ELSE ${expr} END`;
    }
    return `${expr} AS ${this.escaper.escapeId(countField)}`;
  }

  /**
   * 校验 countField 不与节点已有字段重名（SQL 端重名会静默顶掉同名列，须 JS 端把关）
   *
   * 以一行全量数据为样本校验；空表时跳过（无冲突可言）
   */
  protected async _assertCountField(countField: string | undefined): Promise<void> {
    if (!countField) return;
    const sample = await this.getOneNode(
      this._sql(`SELECT * FROM ${this.tableName} WHERE {__TREE_ID__} 1=1 LIMIT 1`),
    );
    if (sample && countField in sample) {
      throw new FlexTreeError(`countField "${countField}" conflicts with an existing node field`);
    }
  }
}
