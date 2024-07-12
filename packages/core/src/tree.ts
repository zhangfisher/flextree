import { FlexTreeOptions, FlexTreeUpdater, IFlexTreeNode } from "./types"
// import { DeepRequired } from "flex-tools/types"
import { deepMerge } from "flex-tools/object/deepMerge"
import { Dict } from "flex-tools/types"

import mitt from 'mitt'
import { FlexTreeManager } from "./manager";

export type DeepRequired<T extends Dict = Dict> = {
    [P in keyof T]-?: T[P] extends Dict
            ? DeepRequired<T[P]>
            : Required<T[P]>
 };

export type FlexTreeEvents = {
    update:string
}

export type FlexTreeStatus = 'initial' | 'loading' | 'loaded' | 'error'

export class FlexTree<T extends Record<string,any>=IFlexTreeNode> {
    private _options:DeepRequired<FlexTreeOptions>
    private _isUpdating = false
    private _emitter = mitt<FlexTreeEvents>()
    private _treeId:string
    private _nodes:Map<string,IFlexTreeNode<T>> = new Map()
    private _status: FlexTreeStatus = 'initial'
    private _manager?:FlexTreeManager
    constructor(id:string,options?:FlexTreeOptions){
        this._treeId = id
        this._options = deepMerge({
            fields:{
                id        : 'id',
                name      : 'title',
                level     : 'level',
                leftValue : 'leftValue',
                rightValue: 'rightValue',
                order     : 'order'
            }
        },options) as DeepRequired<FlexTreeOptions>
    } 
    get options(){ return this._options }    
    get updating(){ return this._isUpdating }
    get on(){ return this._emitter.on.bind(this) }
    get off(){ return this._emitter.off.bind(this) }
    get emit(){ return this._emitter.emit.bind(this) }
    get manager(){ return this._manager!}
    [Symbol.iterator](){return this._nodes[Symbol.iterator]}
     

    /**
     * 返回根节点
     */
    get root(){
        return null
    }
    /**
     * 执行更新操作
     * 
     * 
     * tree.update(async ()=>{
     *    
     * })
     * 
     * @param callback 
     */
    update(updater:FlexTreeUpdater<IFlexTreeNode<T>>){
        if(this._isUpdating) throw new Error('FlexTree is updating')
        updater(this)
            .then(()=>{
            })            
            .finally(()=>{
                this._isUpdating = false
            })
    }
    /**
     * 加载树
     * 
     * @param options
     *  - level: 指定加载的层级
     *           如果没有指定,默认值=0,则只加载当前层级
     *           =1代表仅加载第一级,依此类推.
     * 
     *  
     * 
     * 
     */
    load(nodes:IFlexTreeNode[],options?:{level?:number}){

    }
    /**
     * 获取指定的节点
     * 
     * @param id
     * @param options
     * - level: 指定加载的层级,如=1代表仅加载第一级,依此类推.
     * 
     * 
     */
    getNode(id:string,options?:{level?:number}):IFlexTreeNode<T> | undefined{
        return undefined
    }



}