import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";

export class DeleteNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   *
   * 删除指定节点及其子节点
   *
   * @param nodeId
   * @param {object} options
   * @param {boolean} [options.onlyMark]   只是标记删除，不实际删除：将删除的记录的leftValue和rightValue设置为负数即可
   * @param {Function} [options.onExecuteBefore]  - onExecuteBefore(sql): 执行前回调，返回false则不执行
   *
   * @returns {void}
   *
   */
  async deleteNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: { onlyMark?: boolean; onExecuteBefore?: (sqls: string[]) => boolean },
  ): Promise<void> {
    this._assertWriteable();
    const { onlyMark, onExecuteBefore } = Object.assign({ mark: false }, options);
    const nodeData = (await this.getNodeData(nodeId)) as unknown as TreeNode;
    const leftValue = nodeData[this.keyFields.leftValue];
    const rightValue = nodeData[this.keyFields.rightValue];

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    const sqls: string[] = [];
    if (onlyMark) {
      sqls.push(
        this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = -${leftValueField},
                    ${rightValueField} = -${rightValueField}
                WHERE {__TREE_ID__}
                ${leftValueField}>=${leftValue} AND ${rightValueField}<=${rightValue}
            `),
      );
    } else {
      sqls.push(
        this._sql(`
                DELETE FROM ${this.tableName}
                WHERE {__TREE_ID__}
                ${leftValueField}>=${leftValue} AND ${rightValueField}<=${rightValue}
            `),
      );
    }
    // 删除节点及其子节点后，调整其他节点
    sqls.push(
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} - (${rightValue} - ${leftValue} + 1)
                WHERE {__TREE_ID__}
                ${leftValueField}>${leftValue}
            `),
    );
    sqls.push(
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} - (${rightValue} - ${leftValue} + 1)
                WHERE {__TREE_ID__}
                ${rightValueField}>${rightValue}
            `),
    );

    if (typeof onExecuteBefore === "function") {
      if (onExecuteBefore(sqls) === false) {
        return;
      }
    }
    return await this.adapter.exec(sqls);
  }

  /**
   * 清除树所有节点,包括根节点
   */
  async clear(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>) {
    this._assertWriteable();
    let sql: string = "";
    if (this.treeId) {
      sql = this._sql(`DELETE FROM ${this.tableName} WHERE {__TREE_ID__}`);
    } else {
      sql = `DELETE FROM ${this.tableName}`;
    }
    return await this.onExecuteSql([sql]);
  }
}
