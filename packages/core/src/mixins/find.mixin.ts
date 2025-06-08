import sqlstring from 'sqlstring'
import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNodeFields, NonUndefined } from '../types'
import { FlexTreeError, FlexTreeNodeNotFoundError } from '../errors'
import { escapeSqlString } from '../utils/escapeSqlString'

export class FindNodeMixin<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
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
     */
    async findNode(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: NodeId | Partial<TreeNode>): Promise<TreeNode> {
        let nodes: TreeNode[] = []
        if (typeof (node) === 'object') {
            nodes = await this.findNodes(node as Partial<TreeNode>)
        } else {
            nodes = await this.findNodes({ [this.keyFields.id]: node } as Partial<TreeNode>)
        }
        if (nodes.length === 0) { throw new FlexTreeNodeNotFoundError() }
        return nodes[0] as TreeNode
    }

    /**
     *
     * 返回满足条件的节点
     *  只提供简单的条件查询语法，更复杂的查询请使用数据库查询
     * findNodes({name:"A"})          根据name查找节点
     * findNodes({name:"A",level:1})  根据组合AND条件查找节点
     *
     */
    async findNodes(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, condition: Partial<TreeNode>): Promise<TreeNode[]> {
        const keys = Object.keys(condition)
        if (keys.length === 0) { throw new FlexTreeError('Invalid condition') }
        const sql = this._sql(`select * from ${this.tableName}
            where  {__TREE_ID__} ${keys.map((key) => {
            return `${sqlstring.escapeId(key)}=${escapeSqlString(condition[key])}`
        }).join(' AND ')}
        `)
        return await this.onExecuteReadSql(sql)
    }
}
