import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined } from '../types'

export class SqlMixin<
	Fields extends Record<string, any> = object,
	KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
	TreeNode extends IFlexTreeNode<Fields, KeyFields> = IFlexTreeNode<Fields, KeyFields>,
	NodeId = NonUndefined<KeyFields['id']>[1],
	TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    /**
     * 执行读取操作
     * @param {string} sql  执行的sql
     * @returns  返回查询结果
     */
    async onExecuteReadSql(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sql: string): Promise<any> {
        await this.assertDriverReady()
        return await this.driver.getRows(sql)
    }

    /**
     * 执行操作，无返回值
     * @param {string[]} sqls
     * @returns 返回执行结果
     */
    async onExecuteSql(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sqls: string[]): Promise<any> {
        await this.assertDriverReady()
        return await this.driver.exec(sqls)
    }

    async onExecuteWriteSql(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sqls: string[]): Promise<any> {
        await this.assertDriverReady()
        return await this.driver.exec(sqls)
    }

    async onGetScalar(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sql: string): Promise<any> {
        await this.assertDriverReady()
        return await this.driver.getScalar(sql)
    }

    /**
     * 构建sql时调用，进行一些额外的处理
     *
     *
     * @param sql
     */
    protected _sql(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sql: string) {
        // 在一表多树时,需要增加额外的树判定
        if (this.treeId) {
            const treeId = typeof (this.treeId) == 'string' ? `'${this.treeId}'` : this.treeId
            sql = sql.params({ __TREE_ID__: `${this.keyFields.treeId}=${treeId} AND ` || '' })
        } else {
            sql = sql.params({ __TREE_ID__: '' })
        }
        return sql
    }

    protected async getOneNode(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sql: string): Promise<TreeNode | null> {
        const result = await this.onExecuteReadSql(sql)
        return result.length > 0 ? result[0] as TreeNode : null
    }

    protected async getNodeList(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sql: string): Promise<TreeNode[]> {
        return await this.onExecuteReadSql(sql)
    }

    protected async getScalar<T = number>(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sql: string): Promise<T> {
        return await this.driver.getScalar(sql) as T
    }
}
