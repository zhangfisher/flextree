/**
 * RecycleMixin - 回收站过滤基础设施
 *
 * 核心：Logical Invisibility（逻辑不存在）——includeRecyclebin=false（默认）时，
 * Bin 及其后代在所有 API 中与不存在的节点表现一致。
 *
 * 铁律：排除回收站的语义一律以 leftValue/rightValue WHERE 条件进入 SQL，
 * 由数据库端完成过滤，禁止拉取到应用层再过滤。
 * 例外：写操作对单个目标节点的存在性门控（按 id 点查）与既有的
 * "先读节点再生成 SQL"模式同构，不属于批量过滤。
 *
 * 位置不变量：Bin 恒为根节点的子节点（顺序不限、可在根孩子层重排），
 * 不允许移往树中其他位置或跨树迁出。
 */
import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexNodeRelPosition } from "../types";
import { FlexTreeError } from "../errors";

export class RecycleMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 是否启用了回收站功能（配置了 recyclebin 即启用）
   */
  get recycleBinEnabled(): boolean {
    return !!(this as any).options.recyclebin;
  }

  /**
   * 解析回收站节点的 id（处理函数式 id：多树下每树各自建站）
   */
  protected _getBinId(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>) {
    const rbOptions = this.options.recyclebin;
    if (!rbOptions) return undefined;
    return typeof rbOptions.id === "function" ? (rbOptions.id as any)(this.treeId) : rbOptions.id;
  }

  /**
   * 读取（或从缓存取）回收站节点的左右值区间
   *
   * - 缓存失效时机：每次 write() 事务提交后（_invalidateBinRange）
   * - Bin 不存在（懒创建前）返回 undefined——此时过滤条件为空、不排除任何节点，
   *   与"未启用"行为一致；Bin 创建后区间即有效
   */
  protected async _getBinRange(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<{ left: number; right: number } | undefined> {
    if (!this.recycleBinEnabled) return undefined;
    if (this._binRange !== null) return this._binRange;
    const idField = this.escaper.escapeId(this.keyFields.id);
    const binId = this._getBinId()!;
    const sql = this._sql(`SELECT * FROM ${this.tableName}
            WHERE {__TREE_ID__} ${idField}=${this.escaper.escape(binId as any)}`);
    const node = await this.getOneNode(sql);
    this._binRange = node
      ? {
          left: node[this.keyFields.leftValue],
          right: node[this.keyFields.rightValue],
        }
      : undefined;
    return this._binRange;
  }

  /**
   * 失效 bin 区间缓存（write() 提交/回滚后调用）
   */
  protected _invalidateBinRange(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>) {
    this._binRange = null;
  }

  /**
   * 构建 bin 区间过滤 SQL 片段（数据库端过滤的唯一出口）
   *
   * @param includeRecyclebin true=不过滤（返回空串）；false=返回闭区间排除条件
   * @param alias 字段别名前缀（如 "Node."），空串表示无别名
   * @returns SQL WHERE 片段（以 " AND" 开头，或空串）
   */
  protected async _buildBinFilter(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    includeRecyclebin: boolean,
    alias = "",
  ): Promise<string> {
    // recycleBinDisableFilter：manager.toJson/toList 的 includeRecyclebin=true 视角
    // （FlexTree 内部 manager 的读路径无参数透传通道，用实例级开关实现）
    if (includeRecyclebin || !this.recycleBinEnabled || (this as any).recycleBinDisableFilter) {
      return "";
    }
    const range = await this._getBinRange();
    if (!range) return "";
    const leftField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightField = this.escaper.escapeId(this.keyFields.rightValue);
    // 闭区间：同时排除 Bin 自身与全部后代（Logical Invisibility，无中间态）
    return ` AND NOT (${alias}${leftField}>=${range.left} AND ${alias}${rightField}<=${range.right})`;
  }

  /**
   * 确保 bin 节点存在（首次 write() 时调用）
   *
   * - 已存在同 id 行：须在根孩子层（level=1），否则抛配置错误（位置不变量校验）
   * - 不存在：创建到根的 LastChild 位置
   * - 表中无根节点（空树）：跳过，待有根后的下次 write 再创建
   */
  protected async _ensureBinNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    if (!this.recycleBinEnabled || this._binEnsured) return;
    const idField = this.escaper.escapeId(this.keyFields.id);
    const binId = this._getBinId()!;
    const existing = await this.getOneNode(
      this._sql(`SELECT * FROM ${this.tableName}
            WHERE {__TREE_ID__} ${idField}=${this.escaper.escape(binId as any)}`),
    );
    if (existing) {
      if (existing[this.keyFields.level] !== 1) {
        throw new FlexTreeError(
          `Recyclebin node<${binId}> exists but is not a child of root (level=${existing[this.keyFields.level]})`,
        );
      }
      this._binEnsured = true;
      return;
    }
    const root = await this.getRoot();
    if (!root) return; // 空树：尚无根，待下次 write 再创建
    await this.addNodes(
      [
        {
          [this.keyFields.id]: binId,
          [this.keyFields.name]: this.options.recyclebin!.name,
        },
      ] as any,
      root,
      FlexNodeRelPosition.LastChild,
    );
    this._binEnsured = true;
  }
}
