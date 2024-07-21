import {type FlexTreeManager } from "../manager";
import { CustomTreeKeyFields, DefaultTreeKeyFields, FlexNodeRelPosition, FlexTreeNodeRelation, IFlexTreeNode, NonUndefined } from "../types";
import { FlexTreeError } from "../errors"


export class IsNodeMixin<
    Data extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
>{ 
    
    /**
     * 
     * 判断输入的节点对象是否是根节点
     * 
     */
    isRoot(node:TreeNode){
        return node.level == 0 && node.leftValue == 1
    }
    
    /**
     * 返回两个节点是否在同一棵树中
     */
    isSameTree(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,srcNode:TreeNode,targetNode:TreeNode){
        if(this.isMultiTree){
            return srcNode[this.keyFields.treeId] == targetNode[this.keyFields.treeId]
        }else{
            return true        
        }
    }
    isSameNode(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,node1:TreeNode,node2:TreeNode){
        return node1[this.keyFields.id] == node2[this.keyFields.id]
    }

    /**
    * 判断给定的节点是否有效
    * @description
    * 用于检查传入的节点参数是否符合预期，确保节点存在且类型正确。这通常在处理与节点相关的操作之前进行，以避免潜在的错误。
    * @param {any} node - 需要判断的节点
    * @returns {boolean} - 如果节点有效，返回true；否则返回false
    * @example
    * isValidNode('123'); // 返回false，因为'123'不是一个有效的节点ID或TreeNode对象
    * isValidNode({ id: 123, label: '节点' }); // 返回true，因为这是一个有效的TreeNode对象
    */
    isValidNode(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,node:any):boolean{
        if(!node) return false
        if(typeof(node)!=='object') return false
        if(Object.keys(node).some(k=>!(k in this.keyFields))) return false
        if(!node[this.keyFields.id]) return false 
        if(!(typeof(node[this.keyFields.leftValue])=='number' && node[this.keyFields.leftValue]>=1)) return false 
        if(!(typeof(node[this.keyFields.rightValue])=='number' && node[this.keyFields.rightValue]>=1)) return false
        if(node[this.keyFields.leftValue]>=node[this.keyFields.rightValue]) return false
        if(!(typeof(node.level)=='number' || node.level>=0)) return false
        return true
    }
}