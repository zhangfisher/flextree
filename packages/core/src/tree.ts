import {  CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined,FlexTreeEvents } from "./types" 
import  {  FlexTreeManager,type FlexTreeManagerOptions } from "./manager";
import { FlexTreeNode } from "./node"
import { FlexTreeNotFoundError,FlexTreeInvalidError } from "./errors" 

import {RequiredDeep } from "type-fest"

export type FlexTreeOptions<TreeIdType=number> = FlexTreeManagerOptions<TreeIdType>

export type FlexTreeStatus = 'initial' | 'loading' | 'loaded' | 'error'

export class FlexTree<
    Data extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
    > {
    private _options:RequiredDeep<FlexTreeOptions<KeyFields['treeId']>>
    private _treeId:TreeId    
    private _status: FlexTreeStatus = 'initial'
    private _manager:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>
    private _root?:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>
    nodes:Map<NodeId,IFlexTreeNode<Data,KeyFields>> = new Map()

    constructor(tableName:string,options?:FlexTreeOptions<KeyFields['treeId']>){        
        this._manager = new FlexTreeManager(tableName,options)
        this._treeId = this._manager.treeId
        this._options = this._manager.options as RequiredDeep<FlexTreeOptions<KeyFields['treeId']>>
    }     
    get options(){ return this._options }    
    get on(){ return this._manager.on.bind(this) }
    get off(){ return this._manager.off.bind(this) }
    get emit(){ return this._manager.emit.bind(this) }
    get manager(){ return this._manager!} 
    get root(){
        return this._root 
    }
    /**
     * 返回树的id
     */
    get id(){return this._treeId} 
    /**
     * 返回根节点
     */
    /**
     * 加载树到内存中
        * @param options
     *  - level: 指定加载的层级
     *           如果没有指定,默认值=0,则只加载当前层级
     *           =1代表仅加载第一级,依此类推.
     */
    async load(){ 
        if(this._status == 'loading') return
        this._status = 'loading'
        // 加载根节点
        try{
            this.nodes.clear()
            const nodes = await this.manager.getNodes()
            if(!nodes || nodes.length==0){
                throw new FlexTreeNotFoundError()
            }
            this._root = new FlexTreeNode(nodes[0],undefined,this as any)
            const pnodes:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>[] = [this._root]
            let preNode = this._root 
            for(let node of nodes){                
                if(node.level == preNode.level){
                    const parent = pnodes[pnodes.length-1]
                    const nodeObj = new FlexTreeNode(node,parent,this as any)
                    parent!.children.push(nodeObj) 
                    preNode = nodeObj
                }else if(node.level > preNode.level  ){
                    if(node.level == preNode.level + 1){                        
                        const nodeObj = new FlexTreeNode(node,preNode,this as any)
                        preNode.children.push(nodeObj) 
                        preNode = nodeObj
                        pnodes.push(preNode)
                    }else{
                        throw new FlexTreeInvalidError(`Invalid tree structure`)
                    }                    
                }else if(node.level < preNode.level){
                    while(true){
                        let parent = pnodes.pop()
                        if(parent && node.level == parent.level + 1){
                            const nodeObj = new FlexTreeNode(node,parent,this as any)
                            parent.children.push(nodeObj) 
                            preNode = nodeObj
                            pnodes.push(preNode)
                            break
                        }else if(pnodes.length == 0){
                            break
                        }
                    }
                    
                }
            }
            this._status = 'loaded'
        }catch(e){
            this._status = 'error'
        }        
    } 

    async getNode(nodeId:NodeId){
        if(this.nodes.has(nodeId)){
            return new FlexTreeNode(nodeId,this)
        }else{
            if(this.nodes.has(nodeId)){

            }
            let node = await this.manager.getNode(nodeId)
            if(node){
                this.nodes.set(nodeId,node)
                return new FlexTreeNode(nodeId,this)
            }
        }
    }


}