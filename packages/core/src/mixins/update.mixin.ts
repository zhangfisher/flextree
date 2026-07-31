/**
 *
 * 更新节点数据
 *
 */
import sqlstring from "sqlstring";
import { FlexTreeInvalidUpdateError, FlexTreeNodeError } from "../errors";
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
   * @param this
   * @param node
   */
  async update(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: Partial<TreeNode> | Partial<TreeNode>[],
  ) {
    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);

    const nodes = Array.isArray(node) ? node : [node];
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
  }
}
