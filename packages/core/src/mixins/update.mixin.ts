/**
 *
 * 更新节点数据
 *
 */
import sqlstring from 'sqlstring'
import { FlexTreeInvalidUpdateError, FlexTreeNodeError } from '../errors'
import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined } from '../types'
import { escapeSqlString } from '../utils/escapeSqlString'

export class UpdateNodeMixin<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Fields, KeyFields> = IFlexTreeNode<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    /**
     *
     * 更新节点数据，除了关键字段外的其他字段
     *
     * @param this
     * @param node
     */
    async update(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: Partial<TreeNode> | Partial<TreeNode>[]) {
        this._assertWriteable()
        const nodes = Array.isArray(node) ? node : [node]
        const sqls: string[] = nodes.map((node) => {
            const id = escapeSqlString(node[this.keyFields.id])
            if (!id) {
                throw new FlexTreeNodeError(`Node ${this.keyFields.id} is required`)
            }
            const fields: string[] = []
            Object.entries(node).forEach(([k, v]) => {
                if (!(k in this.keyFields) || k === 'name') {
                    fields.push(`${sqlstring.escapeId(k)}=${escapeSqlString(v)}`)
                }
            })
            if (fields.length === 0) {
                throw new FlexTreeInvalidUpdateError()
            }
            return `UPDATE ${this.tableName} SET ${fields.join(',')} WHERE ${this.keyFields.id}=${id}`
        })
        await this.onExecuteSql(sqls)
    }
}
