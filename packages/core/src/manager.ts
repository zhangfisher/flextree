 
/**
 * 
 * 树管理器
 * 
 * const manager = new FlexTreeManager('tree',options)
 * 
 * 
 * 
 * 
 */
import {  FlexTreeUpdater, IFlexTreeNode } from "./types"
import { Dict } from "flex-tools/types"
import { deepMerge } from "flex-tools/object/deepMerge"
import mitt from 'mitt'
import { FlexTreeNode } from "./node"
import {RequiredDeep } from "type-fest"
import { FlexTreeNotFound } from "./errors"

// export type DeepRequired<T extends Dict = Dict> = {
//     [P in keyof T]-?:
//             T[P] extends Dict
//             ? T[P]
//             : Required<T[P]>        
//   };

export type FlexTreeEvents = {
    update:string
}
 

export interface FlexTreeManagerOptions{

    sort?: string,                  // 同级节点内的排序字段
    // 指定表字段名称
    fields?:{
        treeId?    : string
        pk?        : string
        title?     : string,
        level?     : string,
        leftValue? : string,
        rightValue?: string,
        order?     : string,
        status?    : string
    }
    onRead(sqls:string[]):Promise<Dict<string>[]>
    onWrite(sqls:string[]):Promise<any>
}

export class FlexTreeManager<T extends Record<string,any>=IFlexTreeNode> {
    private _options:RequiredDeep<FlexTreeManagerOptions>
    private _isUpdating = false
    private _emitter = mitt<FlexTreeEvents>()
    private _tableName:string 
    private _treeIdField:string
    private _pkField:string
    private _titleField:string
    private _levelField:string
    private _leftValueField:string
    private _rightValueField:string
    private _orderField:string
    constructor(tableName:string,options?:FlexTreeManagerOptions){
        this._tableName = tableName
        this._options = deepMerge({
            fields:{
                treeId    : 'tree_id',
                pk        : 'id',
                title     : 'tree_title',
                level     : 'tree_level',
                leftValue : 'tree_left',
                rightValue: 'tree_right',
                order     : 'tree_order'
            }
        },options) as RequiredDeep<FlexTreeManagerOptions>
        this._treeIdField = this._options.fields.treeId
        this._pkField = this._options.fields.pk
        this._titleField = this._options.fields.title
        this._levelField = this._options.fields.level
        this._leftValueField = this._options.fields.leftValue
        this._rightValueField = this._options.fields.rightValue
        this._orderField = this._options.fields.order
    } 
    get options(){ return this._options }    
    get updating(){ return this._isUpdating }
    get on(){ return this._emitter.on.bind(this) }
    get off(){ return this._emitter.off.bind(this) }
    get emit(){ return this._emitter.emit.bind(this) }

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
     * 执行读取操作
     * @param sqls 
     * @returns 
     */
    private async _executeReadSql(sqls:string[]):Promise<Dict<string>[]>{
        if(typeof this._options.onRead !== 'function') throw new Error('onRead is not a function')
        return await this._options.onRead(sqls)    
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
    async getNode(treeId:string,nodeId:string,options?:{level?:number}):Promise<FlexTreeNode<T> | undefined>{
        const sql =  `SELECT * FROM ${this._tableName} 
            WHERE ${this._treeIdField}=${treeId} AND ${this._levelField}=0 AND ${this._pkField}=${nodeId}`
        const result = await this._executeReadSql([sql])
        if(result.length === 0) throw new FlexTreeNotFound()
        return new FlexTreeNode(result[0])   
    }

    /**
     * 获取根节点
     * 
     * @param options
     * - level: 指定加载的层级,如=1代表仅加载第一级,依此类推.
     * 
     */
    async getRootNode(treeId:string):Promise<FlexTreeNode<T> | undefined>{
        const sql =  `SELECT * FROM ${this._tableName} 
                        WHERE ${this._treeIdField}=${treeId} AND ${this._levelField}=0`
        const result = await this._executeReadSql([sql])
        if(result.length === 0) throw new FlexTreeNotFound()
        return new FlexTreeNode(result[0])
    }

    /**
     * 
     * 获取树节点列表
     * 
     * @param treeId   树id,如果没有指定tree_id，则返回所有树
     * @param level    限定层级
     * @returns        返回节点列表
     */
    async getNodes(treeId:string,level:number=0):Promise<FlexTreeNode<T>[]>{
        let sql:string = ''
        if(treeId){
            if(level===0){
                sql = `SELECT * FROM ${this._tableName} 
                        WHERE ${this._treeIdField}=${treeId} ORDER BY ${this._leftValueField}`                
            }else{
                sql = `SELECT * FROM ${this._tableName}
                        WHERE ${this._treeIdField}=${treeId} AND ${this._levelField}<=${level} ORDER BY ${this._leftValueField}`
            }
        }else{
            if(level===0){
                sql = `SELECT * FROM ${this._tableName} 
                        WHERE ${this._treeIdField}=${treeId} ORDER BY ${this._treeIdField},${this._leftValueField}`                
            }else{
                sql = `SELECT * FROM ${this._tableName}
                        WHERE ${this._treeIdField}=${treeId} AND ${this._levelField}<=${level} ORDER BY ${this._treeIdField},${this._leftValueField}`
            }
        }
        
        const nodes =  await this._executeReadSql([sql])
        return nodes.map(node=>new FlexTreeNode(node))
    }



}