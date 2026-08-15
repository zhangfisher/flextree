/**
 *
 * 更新节点数据
 *
 */
import { FlexTreeInvalidUpdateError, FlexTreeNodeError, FlexTreeNodeNotFoundError } from "../errors";
import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";

export class UpdateNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   *
   * 更新节点数据，除了关键字段外的其他字段
   *
   * 启用回收站时默认对站内节点（bin 及其后代）抛 NotFound（Logical Invisibility 门控，
   * id 路径按节点数据点查判定）；includeRecyclebin=true 时进入回收站视角照常更新
   *
   * @param this
   * @param node
   * @param options.includeRecyclebin 默认 false
   */
  async update(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: Partial<TreeNode> | Partial<TreeNode>[],
    options?: { includeRecyclebin?: boolean },
  ) {
    this._assertWriteable();
    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);

    const nodes = Array.isArray(node) ? node : [node];
    // 回收站门控：默认视角下站内节点的更新拒绝（update 原先不读库直接 UPDATE，此为显式门控）
    if (this.recycleBinEnabled && !options?.includeRecyclebin) {
      for (const n of nodes) {
        // 参数经 any 中转：Partial<TreeNode> 联合会触发 TS2590（联合类型过于复杂）
        if (await this.isInRecycleBin(n as any)) {
          throw new FlexTreeNodeNotFoundError();
        }
      }
    }
    const sqls: string[] = nodes.map((node) => {
      const id = node[this.keyFields.id];
      if (!id) {
        throw new FlexTreeNodeError(`Node ${this.keyFields.id} is required`);
      }
      const fields: string[] = [];
      Object.entries(node).forEach(([k, v]) => {
        if (!(k in this.keyFields) || k === "name") {
          fields.push(`${this.escaper.escapeId(k)}=${this.escaper.escape(v)}`);
        }
      });
      if (fields.length === 0) {
        throw new FlexTreeInvalidUpdateError();
      }
      return `UPDATE ${this.tableName} SET ${fields.join(",")} WHERE ${idField}=${this.escaper.escape(id)}`;
    });
    await this.onExecuteSql(sqls);
    this.emit("node:updated", { tree: this.treeId, node });
  }
}
