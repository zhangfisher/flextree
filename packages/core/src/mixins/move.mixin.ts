import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNodeFields, NonUndefined } from '../types'
import { FlexNodeRelPosition, FlexTreeNodeRelation } from '../types'
import { FlexTreeError, FlexTreeNodeInvalidOperationError } from '../errors'

export class MoveNodeMixin<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    /**
     *
     * 返回node是否允许移动到atNode的指定的位置
     *
     *
     * 当满足以下条件时不允许移动
     *
     *  - 两个节点是一样的
     *  - toNode是node的后代
     *
     * @example
     *
     *   canMoveNode(node1,node2)       node1能否移动到node2的后面，即下一个兄弟节点
     *
     * @param node
     * @param toNode
     * @returns  {boolean} true 允许移动，false 不允许移动
     */
    async canMoveTo(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: NodeId | TreeNode, toNode?: NodeId | TreeNode) {
        const srcNode = await this.getNodeData(node) as unknown as TreeNode
        const targetNode = await this.getNodeData(toNode) as unknown as TreeNode

        let isAllow: boolean = true
        //
        if (!this.isMultiTree || (this.isMultiTree && targetNode[this.keyFields.treeId] === srcNode[this.keyFields.treeId])) {
            if (targetNode[this.keyFields.id] === srcNode[this.keyFields.id]) {
                isAllow = false
            } else {
                const r = await this.getNodeRelation(targetNode, node)
                if (r === FlexTreeNodeRelation.Descendants) {
                    isAllow = false
                }
            }
        }
        return isAllow
    }

    /**
     * 移动到下一个节点
     */
    private _moveToNextSibling(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, fromNode: TreeNode, toNode: TreeNode) {
        const movedLength = fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1

        const leftValue = fromNode[this.keyFields.leftValue]

        const sqls: string[] = [
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.leftValue} = ${this.keyFields.leftValue} + ${movedLength}                              
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.leftValue} > (SELECT ${this.keyFields.rightValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )                
            `),
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} = ${this.keyFields.rightValue} + ${movedLength}   
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.rightValue} > (SELECT ${this.keyFields.rightValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )                    
            `),

            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.leftValue} = (SELECT ${this.keyFields.rightValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
                                                 + (-${this.keyFields.leftValue} - ${leftValue} ) + 1 ,
                    ${this.keyFields.level} = ${toNode[this.keyFields.level]} +  ${this.keyFields.level} - ${fromNode[this.keyFields.level]} 
                WHERE 
                    {__TREE_ID__} ${this.keyFields.leftValue} < 0  
            `),

            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} =  (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${fromNode[this.keyFields.id]} )
                                                 + (-${this.keyFields.rightValue} - ${leftValue} ) 
                WHERE 
                    {__TREE_ID__} ${this.keyFields.rightValue} < 0
            `),
        ]

        return sqls
    }

    private _moveToPreviousSibling(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, fromNode: TreeNode, toNode: TreeNode) {
        const movedLength = fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1

        const leftValue = fromNode[this.keyFields.leftValue]
        const sqls: string[] = [
            // 调整目标节点及其后代节点的左右值
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.leftValue} = ${this.keyFields.leftValue} + ${movedLength}                              
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.leftValue} >= (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} ) 
            `),
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} =  ${this.keyFields.rightValue} + ${movedLength}
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.rightValue} > (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
                                                - ${movedLength}
            `),
            // 修复源节点的左右值
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.leftValue} = (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
                                                  - ${movedLength} + (-${this.keyFields.leftValue} - ${leftValue}  ) ,
                    ${this.keyFields.level} = ${toNode[this.keyFields.level]} +  ${this.keyFields.level} - ${fromNode[this.keyFields.level]} 
                WHERE 
                    {__TREE_ID__} ${this.keyFields.leftValue} < 0  
            `),

            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} =  (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${fromNode[this.keyFields.id]} )
                                                 + (-${this.keyFields.rightValue} - ${leftValue} )                 
                WHERE 
                    {__TREE_ID__} ${this.keyFields.rightValue} < 0
            `),
        ]
        return sqls
    }

    private _moveToLastChild(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, fromNode: TreeNode, toNode: TreeNode) {
        const movedLength = fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1

        const leftValue = fromNode[this.keyFields.leftValue]

        const sqls: string[] = [
            // 调整目标节点及其后代节点的左右值
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.leftValue} = ${this.keyFields.leftValue} + ${movedLength}                              
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.leftValue} > (SELECT ${this.keyFields.rightValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )                
            `),
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} =  ${this.keyFields.rightValue} + ${movedLength}
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.rightValue} >= (SELECT ${this.keyFields.rightValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
            `),
            // 修复源节点的左右值
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.leftValue} = (SELECT ${this.keyFields.rightValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
                                                  -  ${movedLength} + (-${this.keyFields.leftValue} - ${leftValue}),                                                  
                    ${this.keyFields.level} = ${toNode[this.keyFields.level]} +  ${this.keyFields.level} - ${fromNode[this.keyFields.level]} + 1
                WHERE 
                    {__TREE_ID__} ${this.keyFields.leftValue} < 0  
            `),

            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} = (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${fromNode[this.keyFields.id]} ) 
                    + (-${this.keyFields.rightValue} -${leftValue}) 
                WHERE 
                    {__TREE_ID__} ${this.keyFields.rightValue} < 0
            `),
        ]
        return sqls
    }

    private _moveToFirstChild(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, fromNode: TreeNode, toNode: TreeNode) {
        const movedLength = fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1

        const leftValue = fromNode[this.keyFields.leftValue]

        const sqls: string[] = [
            // 调整目标节点及其后代节点的左右值
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.leftValue} = ${this.keyFields.leftValue} + ${movedLength}                              
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.leftValue} > (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )                
            `),
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} =  ${this.keyFields.rightValue} + ${movedLength}
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.rightValue} >= (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
            `),
            //  修复源节点的左右值
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.leftValue} = (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
                                                 + (-${this.keyFields.leftValue} - ${leftValue}) + 1 ,                                                  
                    ${this.keyFields.level} = ${toNode[this.keyFields.level]} +  ${this.keyFields.level} - ${fromNode[this.keyFields.level]} + 1
                WHERE 
                    {__TREE_ID__} ${this.keyFields.leftValue} < 0  
            `),

            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} = (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${fromNode[this.keyFields.id]} ) 
                    + (-${this.keyFields.rightValue} -${leftValue})  
                WHERE 
                    {__TREE_ID__} ${this.keyFields.rightValue} < 0
            `),
        ]

        return sqls
    }

    /**
     *
     * 移动node到atNode节点lastChild,firstChild,NextSibling,PreviousSibling
     *
     *
     * 算法如下：
     *
     * 1. 获取到源节点和目标节点的基本数据，即leftValue、rightValue、level
     * 2. 判断是否允许移动
     * 3. 更新源节点及所有后代节点的leftValue、rightValue、level为新的值
     *          - 根据目标节点及移动位置计算出源节点的leftValue、rightValue、level
     *          - 重点：将源节点的leftValue、rightValue全部转换为负数,
     *            这样才可以保证不会在后续更新目标节点的leftValue、rightValue时不会出现冲突
     *  4. 更新目标节点及所有后代节点的leftValue、rightValue、level为新的值
     *  5. 将源节点的leftValue、rightValue转换为正数，并在目标节点的leftValue、rightValue之间插入
     *
     */
    async moveNode(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: NodeId | TreeNode, toNode?: NodeId | TreeNode, pos: FlexNodeRelPosition = FlexNodeRelPosition.NextSibling) {
        this._assertWriteable()
        if (!node || !toNode) {
            throw new Error('invalid node param')
        }

        const srcNode = await this.getNodeData(node) as unknown as TreeNode
        const targetNode = await this.getNodeData(toNode) as unknown as TreeNode

        if (!(await this.canMoveTo(srcNode, targetNode))) {
            throw new FlexTreeError(`Can not move node<${srcNode[this.keyFields.id]}> to target node<${targetNode[this.keyFields.id]}>`)
        }

        if (this.isRoot(targetNode)) {
            if (pos === FlexNodeRelPosition.NextSibling || pos === FlexNodeRelPosition.PreviousSibling) {
                throw new FlexTreeError('Root node can not have next and previous sibling node')
            }
        }

        const sqls: string[] = []
        // 1. 将源节点及其子节点标记为已删除, 没有真正删除，只是标记为已删除, 执行后要移动的节点就从树中脱离，但是数据还在，仅是左右值变成负数
        await this.deleteNode(srcNode.id, {
            onlyMark: true, onExecuteBefore: (delSqls) => {
                sqls.push(...delSqls)
                return false
            }
        })

        if (pos === FlexNodeRelPosition.LastChild) {
            sqls.push(...this._moveToLastChild(srcNode, targetNode))
        } else if (pos === FlexNodeRelPosition.FirstChild) {
            sqls.push(...this._moveToFirstChild(srcNode, targetNode))
        } else if (pos === FlexNodeRelPosition.NextSibling) {
            sqls.push(...this._moveToNextSibling(srcNode, targetNode))
        } else if (pos === FlexNodeRelPosition.PreviousSibling) {
            sqls.push(...this._moveToPreviousSibling(srcNode, targetNode))
        }

        await this.onExecuteWriteSql(sqls)
    }

    /**
     * 节点上移
     * 
     * 当移动的节点没有前一个兄弟节点时，将节点移动到父节点的下一个兄弟节点
     * 
     * @param node
     */
    async moveUpNode(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: NodeId | TreeNode) {
        this._assertWriteable()
        const srcNode = await this.getNodeData(node) as unknown as TreeNode
        let preNode = await this.getPreviousSibling(srcNode)
        if (preNode) {
            await this.moveNode(srcNode.id, preNode.id, FlexNodeRelPosition.PreviousSibling)
        } else {
            const parentNode = await this.getParent(srcNode.id)
            if (parentNode) {
                try {
                    await this.moveNode(srcNode.id, parentNode.id, FlexNodeRelPosition.PreviousSibling)
                } catch {
                    throw new FlexTreeNodeInvalidOperationError()
                }
            } else {
                throw new FlexTreeNodeInvalidOperationError()
            }
        }
    }

    /**
     *
     * 节点下移
     *
     * @param node
     */
    async moveDownNode(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: NodeId | TreeNode) {
        this._assertWriteable()
        const srcNode = await this.getNodeData(node) as unknown as TreeNode
        let nextNode = await this.getNextSibling(srcNode)
        if (nextNode) {
            await this.moveNode(srcNode.id, nextNode.id, FlexNodeRelPosition.NextSibling)
        } else {
            const parentNode = await this.getParent(srcNode.id)
            if (parentNode) {
                try {
                    await this.moveNode(srcNode.id, parentNode.id, FlexNodeRelPosition.NextSibling)
                } catch {
                    throw new FlexTreeNodeInvalidOperationError()
                }
            } else {
                throw new FlexTreeNodeInvalidOperationError()
            }
        }
    }
}
