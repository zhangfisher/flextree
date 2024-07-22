import {type FlexTreeManager } from "../manager";
import { CustomTreeKeyFields, DefaultTreeKeyFields,  IFlexTreeNode, NonUndefined } from "../types";

export class DeleteNodeMixin<
    Data extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
>{
    /**
     * 
     * 删除指定节点及其子节点
     * 
     * @param this 
     * @param nodeId  
     * @param options
     *  - onlyMark  只是标记删除，不实际删除：将删除的记录的leftValue和rightValue设置为负数即可
     *  - onExecuteBefore(sql): 执行前回调，返回false则不执行
     * @returns 
     */
    async deleteNode(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId | TreeNode,options?:{onlyMark?:boolean,onExecuteBefore?:(sqls:string[])=>boolean}) {        
        const { onlyMark,onExecuteBefore} = Object.assign({mark:false,},options)
        const nodeData = await this.getNodeData(nodeId) as unknown as TreeNode
        let leftValue = nodeData[this.keyFields.leftValue]
        let rightValue = nodeData[this.keyFields.rightValue]        
        const sqls:string[] = []
        if(onlyMark){
            sqls.push(this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${this.keyFields.leftValue} = -${this.keyFields.leftValue},
                    ${this.keyFields.rightValue} = -${this.keyFields.rightValue}
                WHERE {__TREE_ID__}
                ${this.keyFields.leftValue}>=${leftValue} AND ${this.keyFields.rightValue}<=${rightValue}
            `))    
        }else{
            sqls.push(this._sql(`
                DELETE FROM ${this.tableName}
                WHERE {__TREE_ID__}
                ${this.keyFields.leftValue}>=${leftValue} AND ${this.keyFields.rightValue}<=${rightValue}
            `))
        }
        // 删除节点及其子节点
        sqls.push(this._sql(`
                UPDATE ${this.tableName}
                SET 
                    ${this.keyFields.leftValue} = ${this.keyFields.leftValue} - (${rightValue} - ${leftValue} + 1)
                WHERE {__TREE_ID__}
                ${this.keyFields.leftValue}>${leftValue}
            `)
        )
        sqls.push(this._sql(`
                UPDATE ${this.tableName}
                SET 
                    ${this.keyFields.rightValue} = ${this.keyFields.rightValue} - (${rightValue} - ${leftValue} + 1)
                WHERE {__TREE_ID__}
                ${this.keyFields.rightValue}>${rightValue}
            `)
        )
        if(typeof(onExecuteBefore)=='function'){
            if(onExecuteBefore(sqls)===false) return
        }
        return await this.driver.exec(sqls)
    }

}