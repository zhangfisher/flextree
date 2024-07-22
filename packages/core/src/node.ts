
import {  CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined,FlexNodeRelPosition } from "./types" 
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
    private _children:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>[] = []
    private _parent:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> | undefined
    constructor(id:TreeNode,parent:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> | undefined ,tree:FlexTree<Data,KeyFields,TreeNode,NodeId,TreeId>){
        this._id = id
        this._tree = tree
        this._parent = parent
        if(!this._tree.nodes.has(id)) throw new FlexTreeNodeNotFoundError(`Node ${id} not found`)
        this._node = this._tree.nodes.get(id) as IFlexTreeNode<Data,KeyFields>

    }

    get id():NodeId{ return this._id  }
    get name(){ return this._node.name }
    get level(){  return this._node.level }
    get leftValue(){ return this._node.leftValue }
    get rightalue(){ return this._node.rightValue } 
    get treeId(){ return this._node.rightValue } 
    get parent(){ return this._parent }
    get children(){ return this._children }

    async load(){  
        const node = await this._tree.manager.getNode(this._id)
        if(!node) throw new FlexTreeNodeNotFoundError(`Node ${this._id} not found`)
        this._tree.nodes.set(this._id,node)
    } 
}