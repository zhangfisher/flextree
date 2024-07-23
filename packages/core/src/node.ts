
import {  CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined } from "./types" 
import type { FlexTree} from "./tree"
import { FlexTreeNodeNotFoundError } from './errors';
import { filterObject } from "./utils/filterObject";
import { getRelNodePath } from "./utils/getRelNodePath";

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
    private _children?:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>[]  
    private _parent:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> | undefined
    constructor(node:TreeNode,parent:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> | undefined ,tree:FlexTree<Data,KeyFields,TreeNode,NodeId,TreeId>){
        this._id = node[tree.manager.keyFields.id]
        this._tree = tree
        this._parent = parent
        this._node = node
        if(node.rightValue-node.leftValue>1){
            this._children = []
        }
    } 
    get id():NodeId{ return this._id  }
    get name(){ return this._node.name }
    set name(value:string){ this._node.name = value }
    get level(){  return this._node.level }    
    get leftValue(){ return this._node.leftValue }
    get rightalue(){ return this._node.rightValue } 
    get treeId(){ return this._node.rightValue }     
    get tree(){ return this._tree }
    get children(){ return this._children }
    get data(){ return this._node as TreeNode }
    get root(){ return this._tree.root }
    get parent(){ return this._parent }


    /**
     * 从数据库中同步数据 
     */
    async sync(includeDescendants:boolean = false){  
        const node = await this._tree.manager.getNode(this._id)
        if(!node) throw new FlexTreeNodeNotFoundError(`Node ${this._id} not found`)
        this._node = node
        if(this._children && includeDescendants){     
            Promise.all(this._children.map(n=>n.sync(includeDescendants)))                   
        }
    } 
    /**
     * 
     * 更新节点数据
     * 
     * 不包括关键字段
     * 
     * 
     */
    async update(data:Partial<TreeNode>){        
        const nodeData =  filterObject(data,(k,v)=>{
            return !(k in this._tree.manager.keyFields) 
            || k===this._tree.manager.keyFields.name         
        })
        nodeData[this._tree.manager.keyFields.id] = this._id
        await this._tree.manager.write(async ()=>{
            await this._tree.manager.update(nodeData)
        }) 
        Object.assign(this._node,nodeData)
    }

    /**
     * 
     * 根据输入的路径获取节点
     * 
     * 1. 以当前节点开始
     *    getByPath("A-1/A-1-1")        
     *    getByPath("A-1/A-1-1")
     * 2. ./代表当前节点
     *    getByPath("./A-1/A-1-1")
     * 3. ../代表父节点
     *    getByPath("../A-1-1")
     *    getByPath("../../A-1-1")
     * 4. /代表根节点
     *    getByPath("/A-1-1") 
     * 
     * 
     * 
     * 
     * @param path 
     * @param ofe 
     */
    getByPath(path:string,options?:{byField?:string,delimiter?:string}):FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> | undefined{
        
        const {byField,delimiter} = Object.assign({byField:this._tree.manager.keyFields.name,delimiter:"/"},options)

        let [entryNode,entryPath] = getRelNodePath(this as any,path,delimiter) as  [FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> ,string]

        for(let subpath of entryPath.split(delimiter)){
            if(subpath=='') continue
            if(entryNode.children){
                const index = entryNode.children.findIndex((n:any)=>n[byField] == subpath)
                if(index>=0){
                    entryNode = entryNode.children[index]
                }else{
                    return undefined
                }
            }else{
                return undefined
            }
        }
        return entryNode as FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> 
    }
    /**
    * 获取该节点下id=nodeId的节点实例
    */
    get(nodeId:NodeId,includeDescendants:boolean=false):FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> | undefined{
        if(this.id===nodeId) return this
        if(this._children){
            for(let node of this._children){
                if(node.id == nodeId){
                    return node
                }else{                   
                    if(includeDescendants){
                        const n = node.get(nodeId,includeDescendants)
                        if(n) return n
                    }
                }
            }
        }
    }
    /**
     * 返回符合条件的子节点和后代节点集合
     * @param fn 
     * @returns 
     */
    find(fn:(node:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>)=>boolean,includeDescendants:boolean=false):FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>[] {
        const nodes:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>[] = []
        if(this._children){
            for(let node of this._children){
                if(fn(node)){
                    nodes.push(node)                
                }
                if(includeDescendants){
                    nodes.push(...node.find(fn,includeDescendants))                
                }
            }
        }
        return nodes
    }   

    toString(){
        return `${this.name}(${this._id})`
    }
}