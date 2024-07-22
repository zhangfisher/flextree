
import {  CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined } from "./types" 
import type { FlexTree} from "./tree"
import { FlexTreeNodeNotFoundError } from './errors';
export class FlexTreeNode<
        Data extends Record<string,any>={},
        KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
        TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
        NodeId = NonUndefined<KeyFields['id']>[1],
        TreeId = NonUndefined<KeyFields['treeId']>[1]
    >{
    private _id:NodeId
    private _tree:FlexTree<Data,KeyFields,TreeNode,NodeId,TreeId>
    private _node: IFlexTreeNode<Data,KeyFields>
    constructor(id:NodeId,tree:FlexTree<Data,KeyFields,TreeNode,NodeId,TreeId>){
        this._id = id
        this._tree = tree
        if(!this._tree.nodes.has(id)) throw new FlexTreeNodeNotFoundError(`Node ${id} not found`)
        this._node = this._tree.nodes.get(id) as IFlexTreeNode<Data,KeyFields>
    }

    get id():NodeId{ return this._id  }
    get name(){ return this._node.name }
    get level(){  return this._node.level }
    get leftValue(){ return this._node.leftValue }
    get rightalue(){ return this._node.rightValue } 
    get treeId(){ return this._node.rightValue }
    get outdated(){ return this._node.outdated } 

    async load(){  
        
    }

    /**
     * 返回所有子节点
     */
    async getChildren(){
        return await this._tree.manager.getChildren(this._id)
    }

    async getParent(){
        return await this._tree.manager.getParent(this._id)
    } 

    async getPrevious(){
        return await this._tree.manager.getPreviousSibling(this._id)
    }
    async getNext(){
        return await this._tree.manager.getNextSibling(this._id)

    }
    // async getFirstChild(){
    //     return this._tree.manager.getFirstChild(this._id)
    // }
    // async getLastChild(){
    //     return this._tree.manager.getLastChild(this._id)
    // }

    async addChild(){
        
    }
    async removeChild(){

    }
    async insertBefore(){

    }
    async insertAfter(){

    }
    async moveUp(){

    }
    async moveDown(){

    }
    async moveTo(){

    }
}