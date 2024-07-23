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
            const nodes = await this.manager.getNodes()
            if(!nodes || nodes.length==0){
                throw new FlexTreeNotFoundError()
            }
            this._root = new FlexTreeNode(nodes[0],undefined,this as any)
            const pnodes:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>[] = [this._root]
            let preNode = this._root 
            for(let node of nodes){  
                if(node.level == 0) continue              
                if(node.level == preNode.level){
                    const parent = pnodes[pnodes.length-1]
                    const nodeObj = new FlexTreeNode(node,parent,this as any)
                    parent.children!.push(nodeObj) 
                    preNode = nodeObj
                }else if(node.level > preNode.level  ){
                    if(node.level == preNode.level + 1){                        
                        const nodeObj = new FlexTreeNode(node,preNode,this as any)
                        preNode.children!.push(nodeObj) 
                        preNode = nodeObj
                        if(node.rightValue-node.leftValue > 1){                            
                            pnodes.push(preNode)
                        }
                    }else{
                        throw new FlexTreeInvalidError(`Invalid tree structure`)
                    }                    
                }else if(node.level < preNode.level){
                    while(true){
                        let parent = pnodes[pnodes.length-1]
                        if(parent && node.level == parent.level + 1){
                            const nodeObj = new FlexTreeNode(node,parent,this as any)
                            parent.children!.push(nodeObj) 
                            preNode = nodeObj
                            if(node.rightValue-node.leftValue > 1){                            
                                pnodes.push(preNode)
                            }
                            break
                        }else if(pnodes.length == 0){
                            break
                        }else{
                            pnodes.pop()                        
                        }
                    }
                    
                }
            }
            this._status = 'loaded'
        }catch(e){
            this._status = 'error'
        }        
    } 

    getByPath(path:string,options?:{byField?:string,delimiter?:string}):FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId> | undefined{
        return this.root?.getByPath(path,options)
    }

    async update(path:string,data:Partial<TreeNode>){        
        const node = this.getByPath(path)   
        if(!node) throw new FlexTreeNotFoundError(`Node ${path} not found`)            
        await node.update(data)
    }

    /**
     * 删除指定的节点
     */
    async delete(nodeId: NodeId | ((node:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>)=>boolean) ){        
        if(typeof nodeId == 'function'){            
            const nodes = this.find(node=>(nodeId as any)(node)).map(node=>node.id)
            await this.manager.write(async ()=>{
                for(let id of nodes){
                    await this.manager.deleteNode(id) 
                }   
            })
        }else{

            await this.manager.deleteNode(nodeId)    
        }   
    }
    /**
     * 根据节点id获取节点实例
     */
    get(nodeId:NodeId){
        if(nodeId == this._root?.id){
            return this._root
        }else{
            return this._root?.get(nodeId,true)
        }
    }
    /**
     * 
     * @param condition 
     * @returns 
     */
    find(condition:(node:FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>)=>boolean):FlexTreeNode<Data,KeyFields,TreeNode,NodeId,TreeId>[]{
        return this._root!.find(condition,true)
    }
    /**
     * 
     * 重置节点
     * 
     * - 将节点从树中移除
     * - 重新加载节点
     * 
     * @param nodeId
     */
    reset(nodeId:NodeId){
        const node = this.get(nodeId)
        if(node){
            let parent = node.parent
            let index = -1
            if( parent && parent.children){
                index = parent.children?.findIndex(n=>n.id!=node.id)
                if(index>=0){
                    parent.children?.splice(index,1)
                }
            }
            this.load()            
        }
    }

}