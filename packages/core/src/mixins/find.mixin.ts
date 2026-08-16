import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexTreeError } from "../errors";

export class FindNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 返回满足条件的节点
   *
   * 只返回第一个满足条件的节点
   *
   * findNode(1)                   根据ID查找节点
   * findNode({name:"A"})          根据name查找节点
   * findNode({name:"A",level:1})  根据组合AND条件查找节点
   *
   * 启用回收站时默认排除 bin 及其后代（数据库端过滤），includeRecyclebin=true 时包含
   * @param options.countField 指定后附加后代数量字段
   */
  async findNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: NodeId | Partial<TreeNode>,
    options?: { includeRecyclebin?: boolean; countField?: string },
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
    return nodes[0] as TreeNode;
  }

  /**
   *
   * 返回满足条件的节点
   *  只提供简单的条件查询语法，更复杂的查询请使用数据库查询
   * findNodes({name:"A"})          根据name查找节点
   * findNodes({name:"A",level:1})  根据组合AND条件查找节点
   *
   * 启用回收站时默认排除 bin 及其后代（数据库端过滤），includeRecyclebin=true 时包含
   * @param options.countField 指定后每条节点数据附加该字段，值为后代节点数量（可见口径）
   */
  async findNodes(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    condition: Partial<TreeNode>,
    options?: { includeRecyclebin?: boolean; countField?: string },
  ): Promise<TreeNode[]> {
    const keys = Object.keys(condition);
    if (keys.length === 0) {
      throw new FlexTreeError("Invalid condition");
    }
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin);
    await this._assertCountField(options?.countField);
    const countExpr = await this._countExpr(options?.countField, !!options?.includeRecyclebin);
    const sql = this._sql(`select *${countExpr ? `,${countExpr}` : ""} from ${this.tableName}
            where  {__TREE_ID__} ${keys
              .map((key) => {
                return `${this.escaper.escapeId(key)}=${this.escaper.escape(condition[key])}`;
              })
              .join(" AND ")}${binFilter}
        `);
    return (await this.getRows(sql)) as TreeNode[];
  }
}
