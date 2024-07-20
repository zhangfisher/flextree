import {type FlexTreeManager } from "../manager";
import { CustomTreeKeyFields, DefaultTreeKeyFields, FlexNodeRelPosition, FlexTreeNodeRelation, IFlexTreeNode, NonUndefined } from "../types";
import { FlexTreeError } from "../errors"


export class MoveNodeMixin<
    Data extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
>{
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
     *   canMoveNode(node1,node2,FlexNodeRelPosition.LastChild)  node1能否移动为node2的最后一个子节点
     * 
     * @param this 
     * @param node 
     * @param toNode 
     * @param pos 
     * @returns 
     */
    async canMoveTo(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,node:NodeId | TreeNode,toNode?:NodeId | TreeNode, pos:FlexNodeRelPosition = FlexNodeRelPosition.NextSibling) {
        
        const srcNode = await this.getNodeData(node) as unknown as TreeNode
        const targetNode = await this.getNodeData(toNode) as unknown as TreeNode        

        let isAllow:boolean = true        
        // 
        if(!this.isMultiTree || (this.isMultiTree && targetNode[this.keyFields.treeId]==srcNode[this.keyFields.treeId])){        
            if(targetNode[this.keyFields.id]==srcNode[this.keyFields.id]){
                isAllow=false
            }else{                
                const r = await this.getNodeRelation(targetNode, node)
                if(r == FlexTreeNodeRelation.Descendants){
                    isAllow =false
                }
            }
        }
        return isAllow
    }

    /**
     * 移动到下一个节点
     */
    private _moveToNextSibling(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,fromNode: TreeNode,toNode: TreeNode){
        
        const movedLength = fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1
        
        const leftValue = fromNode[this.keyFields.leftValue]
        const rightValue = fromNode[this.keyFields.rightValue]

        const sqls:string[] = [] 

        sqls.push(...[
                // UPDATE tree SET  leftValue = leftValue + 12 + 1 WHERE leftValue > 26

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
                    ${this.keyFields.leftValue} = (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
                                                 + ${movedLength} + (-${this.keyFields.leftValue} - ${leftValue}  ) 
                WHERE 
                    {__TREE_ID__} ${this.keyFields.leftValue} < 0  
            `),         
            
            this._sql(`
                UPDATE ${this.tableName} 
                SET 
                    ${this.keyFields.rightValue} =  (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${fromNode[this.keyFields.id]} )
                                                 + (-${this.keyFields.rightValue} - ${leftValue } ) 
                WHERE 
                    {__TREE_ID__} ${this.keyFields.rightValue} < 0
            `),          
        ])
        
        return sqls
    }


    private _moveToPreviousSibling(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,fromNode: TreeNode,toNode: TreeNode){
        
        const movedLength = fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1
        
        const leftValue = fromNode[this.keyFields.leftValue]
        const rightValue = fromNode[this.keyFields.rightValue]

        const sqls:string[] = [] 

        sqls.push(...[
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
                    ${this.keyFields.rightValue} =  ${this.keyFields.rightValue}  +  ${movedLength}  
                WHERE 
                    {__TREE_ID__} 
                    ${this.keyFields.rightValue} <= ${toNode[this.keyFields.rightValue]}                               
            `),
            // // 修复源节点的左右值
            // this._sql(`
            //     UPDATE ${this.tableName} 
            //     SET 
            //         ${this.keyFields.leftValue} = (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${toNode[this.keyFields.id]} )
            //                                       - ${movedLength} + (-${this.keyFields.leftValue} - ${leftValue}  ) 
            //     WHERE 
            //         {__TREE_ID__} ${this.keyFields.leftValue} < 0  
            // `),         
            
            // this._sql(`
            //     UPDATE ${this.tableName} 
            //     SET 
            //         ${this.keyFields.rightValue} =  (SELECT ${this.keyFields.leftValue} FROM ${this.tableName} WHERE {__TREE_ID__} ${this.keyFields.id}=${fromNode[this.keyFields.id]} )
            //                                      + (-${this.keyFields.rightValue} - ${leftValue } ) 
            //     WHERE 
            //         {__TREE_ID__} ${this.keyFields.rightValue} < 0
            // `),          
        ])                    
        return sqls
    }

    private _moveToLastChild(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,fromNode:NodeId | TreeNode,toNode:TreeNode){

        return []
    }
    private _moveToFirstChild(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,fromNode:NodeId | TreeNode,toNode?:NodeId | TreeNode){
        return []  
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
    async moveNode(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,node:NodeId | TreeNode,toNode?:NodeId | TreeNode , pos:FlexNodeRelPosition = FlexNodeRelPosition.NextSibling){
        this._assertUpdating()
        if(!node || !toNode) throw new Error('invalid node param')
        
        let srcNode = await this.getNodeData(node) as unknown as TreeNode
        let targetNode =await this.getNodeData(toNode) as unknown as TreeNode

        if(this.isRoot(targetNode)){ 
            if(pos == FlexNodeRelPosition.NextSibling || pos == FlexNodeRelPosition.PreviousSibling){
                throw new FlexTreeError('Root node can not have next and previous sibling node')
            }
        }

        let sqls:string[] = []
        // 1. 将源节点及其子节点标记为已删除, 没有真正删除，只是标记为已删除, 执行后要移动的节点就从树中脱离，但是数据还在，仅是左右值变成负数
        await this.deleteNode(srcNode.id,{onlyMark:true,onExecuteBefore:(delSqls)=>{
            sqls.push(...delSqls)
            return false
        }})
  
        if(pos== FlexNodeRelPosition.LastChild){           
            sqls.push(...this._moveToLastChild(srcNode,targetNode))
        }else if(pos==FlexNodeRelPosition.FirstChild){
            sqls.push(...this._moveToFirstChild(srcNode,targetNode))
        }else if(pos== FlexNodeRelPosition.NextSibling){
            sqls.push(...this._moveToNextSibling(srcNode,targetNode))
        }else if(pos == FlexNodeRelPosition.PreviousSibling){
            sqls.push(...this._moveToPreviousSibling(srcNode,targetNode))
        }

        await this.onExecuteWriteSql(sqls)
    }
    
    moveUpNode(node:NodeId | TreeNode){

    }
    moveDownNode(node:NodeId | TreeNode){
        
    }
}