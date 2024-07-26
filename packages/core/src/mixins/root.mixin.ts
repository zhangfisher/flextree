import sqlString from 'sqlString'
import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined } from '../types'
import { FlexTreeNodeError } from '../errors'
import { escapeSqlString } from '../utils/escapeSqlString'

export class RootNodeMixin<
	Fields extends Record<string, any> = object,
	KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
	TreeNode extends IFlexTreeNode<Fields, KeyFields> = IFlexTreeNode<Fields, KeyFields>,
	NodeId = NonUndefined<KeyFields['id']>[1],
	TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    /**
     *
     * 返回是否存在根节点
     *
     * @returns  {boolean} 如果存在根节点，返回true；否则返回false
     *
     */
    async hasRoot(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>) {
        const sql = this._sql(`select count(*) from ${this.tableName} 
            where {__TREE_ID__} ${this.keyFields.leftValue}=1 and ${this.keyFields.level}=0`)
        return await this.getScalar(sql) === 1
    }

    /**
     *
     * 判断输入的节点对象是否是根节点
     *
     */
    isRoot(node: TreeNode) {
        return node.level === 0 && node.leftValue === 1
    }

    /**
     * 创建根节点
     *
     *
     * createRoot({name:"A"})
     *
     *
     * @param node   节点数据
     */
    async createRoot(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: Partial<TreeNode>) {
        this._assertWriteable()
        if (await this.hasRoot()) {
            throw new FlexTreeNodeError('Root node already exists')
        }
        // 1. 创建根节点数据
        const record = Object.assign({}, node, {
            [this.keyFields.leftValue]: 1,
            [this.keyFields.rightValue]: 2,
            [this.keyFields.level]: 0,
        }) as TreeNode
        this.withTreeId(record)
        const keys = Object.keys(record).map(key => sqlString.escapeId(key)).join(',')
        const values = Object.values(record).map(v => escapeSqlString(v)).join(',')
        const sql = `INSERT INTO ${this.tableName} (${keys}) VALUES (${values})`
        await this.onExecuteWriteSql([sql])
    }
}
