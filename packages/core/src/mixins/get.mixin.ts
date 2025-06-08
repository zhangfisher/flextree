import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNodeFields, NonUndefined } from '../types'
import { FlexTreeError, FlexTreeNodeNotFoundError, FlexTreeNotExists } from '../errors'
import { escapeSqlString } from '../utils/escapeSqlString'
import { isLikeNode } from '../utils/isLikeNode'
import { isValidNode } from '../utils/isValidNode'
import { isNull } from '../utils/isNull'

export class GetNodeMixin<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    /**
     *
     * 根据输入参数返回节点数据
     *
     * - 如果node==undefined 返回根节点
     * - 如果node是节点对象，则直接返回
     * - 如果node是字符串或数字，则根据ID获取节点信息
     *
     */
    async getNodeData(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, param: any) {
        let node: TreeNode
        // 如果输入的是节点对象已经包含了节点信息，可以直接使用
        if (isNull(param)) { // 未指定目标节点，则添加到根节点
            node = await this.getRoot() as TreeNode
            if (!node) { throw new FlexTreeNotExists() }
        } else if (isLikeNode(param, this.keyFields)) {
            node = param as TreeNode
        } else if (['string', 'number'].includes(typeof (param))) { // 否则需要根据ID获取节点信息
            node = await this.getNode(param as any) as TreeNode
        } else {
            throw new FlexTreeError('Invalid node parameter')
        }
        if (isValidNode(node!)) {
            throw new FlexTreeNodeNotFoundError('Invalid node parameter')
        }
        return node
    }

    /**
     * 获取节点列表
     * @param {object} options                    选项
     * @param {number}  [options.level]            限定返回的层级,0表示不限制,1表示只返回根节点，2表示返回根节点和其子节点, 依次类推
     * @returns TreeNode[]
     */
    async getNodes(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, options?: { level?: number, fields?: keyof TreeNode }): Promise<TreeNode[]> {
        const { level, fields } = Object.assign({ level: 0, fields: [] }, options)
        const fieldList = fields.length > 0 ? fields.map(f => `${f}`).join(',') : '*'
        const sql = this._sql(`SELECT ${fieldList} FROM ${this.tableName} 
            WHERE {__TREE_ID__} ${this.keyFields.leftValue}>0 AND ${this.keyFields.rightValue}>0
                ${level > 0 ? `AND ${this.keyFields.level}<=${level}` : ''}
            ORDER BY ${this.keyFields.leftValue}
        `)
        return await this.onExecuteReadSql(sql)
    }

    /**
     * 根据id获取节点
     * @param nodeId
     */
    async getNode(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId): Promise<TreeNode | undefined> {
        const sql = this._sql(`SELECT * FROM ${this.tableName} 
            WHERE {__TREE_ID__} (${this.keyFields.id}=${escapeSqlString(nodeId)})`)
        const result = await this.onExecuteReadSql(sql)
        if (result.length === 0) { throw new FlexTreeNodeNotFoundError() }
        return result[0] as TreeNode
    }

    /**
     * 获取第几个子节点
     *
     * getChildNode(nodeId,1)  //获取第一个子节点
     * getChildNode(nodeId,-1) //获取最后一个子节点
     * getChildNode(nodeId,3)  //获取第三个子节点
     *
     * @param this
     * @param node
     */
    async getNthChild(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: NodeId | TreeNode, index: number = 1): Promise<TreeNode | undefined> {
        const relNodeId = escapeSqlString(isLikeNode(node, this.keyFields) ? (node as any)[this.keyFields.id] : node)
        const sql = this._sql(`SELECT Node.* FROM ${this.tableName}  Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}
            WHERE {__TREE_ID__} 
                (
                    Node.${this.keyFields.leftValue} > RelNode.${this.keyFields.leftValue}
                    AND Node.${this.keyFields.rightValue} < RelNode.${this.keyFields.rightValue}
                    AND Node.${this.keyFields.level} = RelNode.${this.keyFields.level} + 1
                )
            ORDER BY Node.${this.keyFields.leftValue} ${index < 0 ? 'DESC' : ''}
            LIMIT 1 OFFSET ${Math.abs(index) - 1}
        `)
        const result = await this.onExecuteReadSql(sql)
        return result.length > 0 ? result[0] as TreeNode : undefined
    }

    /**
     * 
     * 获取指定节点的所有后代
     *
     * @param nodeId                              节点ID或节点数据对象,如果nodeId=undefined,则返回所有节点,相当于getNodes()
     * @param {object} options                    选项
     * @param {number}  [options.level]           限制返回的级别
     * @param {boolean} [options.includeSelf]     返回结果是否包括自身
     */
    async getDescendants(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId?: NodeId | TreeNode, options?: { level?: number, includeSelf?: boolean }): Promise<IFlexTreeNodeFields<Fields, KeyFields>[]> {
        if (isNull(nodeId)) {
            return await this.getNodes(options)
        }
        const { level, includeSelf } = Object.assign({ includeSelf: false, level: 0 }, options)
        const relNode = await this.getNodeData(nodeId)
        const relNodeId = escapeSqlString(relNode[this.keyFields.id])
        let sql: string = ''
        if (level === 0) { // 不限定层级
            sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}
                WHERE 
                  {__TREE_ID__} 
                  ((Node.${this.keyFields.leftValue} > RelNode.${this.keyFields.leftValue}
                  AND Node.${this.keyFields.rightValue} < RelNode.${this.keyFields.rightValue})                  
                  ${includeSelf ? `OR Node.${this.keyFields.id} = ${relNodeId}` : ''})     
                ORDER BY ${this.keyFields.leftValue}             
                `)
        } else { // 限定层级
            sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}
                WHERE 
                {__TREE_ID__} 
                ((Node.${this.keyFields.leftValue} > RelNode.${this.keyFields.leftValue}
                AND Node.${this.keyFields.rightValue} < RelNode.${this.keyFields.rightValue}
                -- 限定层级
                AND Node.${this.keyFields.level} > RelNode.${this.keyFields.level}
                AND Node.${this.keyFields.level} <= RelNode.${this.keyFields.level}+${level})
                ${includeSelf ? `OR Node.${this.keyFields.id} = ${relNodeId}` : ''})
                ORDER BY ${this.keyFields.leftValue}             
            `)
        }
        // 得到的平面形式的节点列表
        return await this.onExecuteReadSql(sql)
    }

    /**
     * 获取后代节点数量
     */
    async getDescendantCount(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId | TreeNode, options?: { level?: number }) {
        const { level } = Object.assign({ level: 0 }, options)
        const relNode = await this.getNodeData(nodeId)
        const relNodeId = escapeSqlString(relNode[this.keyFields.id])
        const relNodeLevel = relNode[this.keyFields.level]

        const sql = this._sql(`SELECT COUNT(*) FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}
            WHERE {__TREE_ID__} 
                (   
                    Node.${this.keyFields.leftValue} > RelNode.${this.keyFields.leftValue}
                    AND Node.${this.keyFields.rightValue} < RelNode.${this.keyFields.rightValue}
                ) ${level > 0 ? `AND Node.${this.keyFields.level} <= ${relNodeLevel + level} ` : ''}       
        `)
        return await this.getScalar(sql)
    }

    /**
     * 获取子节点集合
     *
     * @param nodeId  节点ID或节点数据
     * @returns  返回子节点集合,不包括后代节点
     */
    async getChildren(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId | TreeNode) {
        return await this.getDescendants(nodeId, { level: 1 })
    }

    /**
     * 获取所有祖先节点,包括父节点
     * @param nodeId
     * @param {object} options
     * @param {boolean} [options.includeSelf] 是否包括自身
     *
     */
    async getAncestors(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId | TreeNode, options?: { includeSelf?: boolean }) {
        const { includeSelf } = Object.assign({ includeSelf: false }, options)

        const relNode = await this.getNodeData(nodeId)
        const relNodeId = escapeSqlString(relNode[this.keyFields.id])

        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}
            WHERE {__TREE_ID__} 
            (
                (   
                    Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue}
                    AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue}
                )   
                ${includeSelf ? `OR Node.${this.keyFields.id} = ${relNodeId}` : ''}
            ) 
            ORDER BY ${this.keyFields.leftValue}     
        `)
        return await this.getNodeList(sql)
    }

    /**
     *  获取祖先节点数量(不包括自身)
     * @param nodeId
     * @returns {number}  返回祖先节点数量
     */
    async getAncestorsCount(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId) {
        const sql = this._sql(`SELECT COUNT(*) FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
                (   
                    Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue}
                    AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue}
                )       
        `)
        return await this.getScalar(sql)
    }

    /**
     * 获取父节点
     * @param nodeId
     * @returns
     */
    async getParent(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId | TreeNode): Promise<TreeNode> {
        const relNode = await this.getNodeData(nodeId)
        const relNodeId = escapeSqlString(relNode[this.keyFields.id])
        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}
            WHERE {__TREE_ID__}  
            (   
                Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue}
                AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue}
            )  
            ORDER BY ${this.keyFields.leftValue} DESC LIMIT 1     
        `)
        const result = await this.onExecuteReadSql(sql)
        if (result.length === 0) { throw new FlexTreeNodeNotFoundError() }
        return result[0] as TreeNode
    }

    /**
     * 获取所有兄弟节点
     *
     * SELECT Node.* FROM user Node
        JOIN (
        SELECT Node.* FROM user Node
        JOIN user RelNode ON RelNode.id = 'd'
        WHERE (Node.tree_left < RelNode.tree_left
        AND Node.tree_right > RelNode.tree_right  )
        ORDER BY Node.tree_left DESC LIMIT 1
        ) ParentNode
        WHERE
            (
                Node.tree_left > ParentNode.tree_left
                AND Node.tree_right < ParentNode.tree_right
                AND Node.tree_level =  ParentNode.tree_level +1
            )
        ORDER BY Node.tree_left

     * @param node
     * @param options
     */
    async getSiblings(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId | TreeNode, options?: { includeSelf?: boolean }) {
        const { includeSelf } = Object.assign({ includeSelf: false }, options)
        const relNode = await this.getNodeData(nodeId)
        const relNodeId = escapeSqlString(relNode[this.keyFields.id])
        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN (
                SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}
                WHERE 
                    (Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue} 
                    AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue} )
                ORDER BY Node.${this.keyFields.leftValue} DESC LIMIT 1
            ) ParentNode
            WHERE {__TREE_ID__}  
            (
                (
                    Node.${this.keyFields.leftValue} > ParentNode.${this.keyFields.leftValue} 
                    AND Node.${this.keyFields.rightValue} < ParentNode.${this.keyFields.rightValue}
                    AND Node.${this.keyFields.level} = ParentNode.${this.keyFields.level}+1
                    ${includeSelf ? '' : `AND Node.${this.keyFields.id} != ${relNodeId}`}
                )                
            )
            ORDER BY ${this.keyFields.leftValue}     
        `)
        return await this.getNodeList(sql)
    }

    /**
     * 获取下一个兄弟节点
     *
     *    下一节点应满足：同一级别，同一棵树,Left要大于node.tree_left,且具有同一个
     *
     *    SELECT Node.* FROM user Node
     *     JOIN user RelNode ON RelNode.id = 'g'
     *     WHERE
     *         (Node.tree_left = RelNode.tree_right+1
     *     AND Node.tree_id=0
     *     ) LIMIT 1
     *
     *
     */
    async getNextSibling(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId | TreeNode) {
        const relNode = await this.getNodeData(nodeId)
        const relNodeId = escapeSqlString(relNode[this.keyFields.id])

        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}             
            WHERE {__TREE_ID__}  
                (
                    Node.${this.keyFields.leftValue} = RelNode.${this.keyFields.rightValue}+1  
                    AND Node.${this.keyFields.level} = RelNode.${this.keyFields.level}
                )     
            LIMIT 1`)
        return await this.getOneNode(sql)
    }

    /**
     * 获取上一个兄弟节点
     * @param nodeId
     */
    async getPreviousSibling(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodeId: NodeId | TreeNode) {
        const relNode = await this.getNodeData(nodeId)
        const relNodeId = escapeSqlString(relNode[this.keyFields.id])

        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${relNodeId}             
            WHERE {__TREE_ID__}  
                (
                    Node.${this.keyFields.rightValue} = RelNode.${this.keyFields.leftValue}-1  
                )     
            LIMIT 1`)
        return await this.getOneNode(sql)
    }

    /**
     * 获取根节点
     *
     * 一棵树仅有一个根节点,所以只需要获取leftValue=1的节点即可
     *
     */
    async getRoot(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>) {
        const sql = this._sql(`SELECT * FROM ${this.tableName} 
                        WHERE {__TREE_ID__} ${this.keyFields.leftValue}=1`)
        return (await this.getOneNode(sql))!
    }
}
