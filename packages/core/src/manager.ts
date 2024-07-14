 
/**
 * 
 * 树管理器,负责核心的树操作
 * 
 * const manager = new FlexTreeManager('<表名称>',{
 *  onRead(sql){
 *     return execute(sql) 返回查询结果
 *  }
 *  onWrite(sqls:string[]){
 *      执行写入操作
 *  }
 * 
 * })
 * 
 * manager.getRootNode()
 * 
 * 
 * 
 * 
 * 
 */
import {  FlexNodeRelPosition, IFlexTreeNode } from "./types"
import { Dict } from "flex-tools/types"
import { deepMerge } from "flex-tools/object/deepMerge"
import mitt from 'mitt'
import { FlexTreeNode } from "./node"
import {RequiredDeep } from "type-fest"
import { FlexNodeNotFound, FlexTreeError, FlexTreeNotExists, FlexTreeNotFound } from "./errors"
import { isLikeNode } from "./utils/isLikeNode"
import { isValidNode } from './utils/isValidNode';
import sqlstring from 'sqlstring'
import { b } from "vitest/dist/suite-IbNSsUWN"
import { buildInsertSql } from "./utils/buildInsertSql"
import { escapeSqlString } from "./utils/escapeSqlString"
import { FlexTreeEvents } from "./tree"


export interface FlexTreeManagerOptions<Node extends Record<string,any>={},IdType=string,TreeIdType=number>{
    treeId?     : TreeIdType                    // 使用支持单表多树时需要提供
    fields?: {                                  // 配置树相关的字段名称
        id?        : string
        treeId?    : string
        name?      : string
        level?     : string
        leftValue? : string
        rightValue?: string 
    }
    onBeforeRead?(sql:string):string                                           
    onRead?(sql:string):Promise<Dict<string>[]>
    onBeforeWrite?(sqls:string[]):string                             
    onWrite?(sqls:string[]):Promise<any>
}

/**
 * 
 * 
 * 
 * 
 */
export class FlexTreeManager<Node extends Record<string,any>={},IdType=string,TreeIdType=number> {
    private _options:RequiredDeep<FlexTreeManagerOptions<Node,IdType,TreeIdType>>
    private _isUpdating = false
    private _emitter = mitt<FlexTreeEvents>()
    private _tableName:string  
    private _idField:string
    private _treeIdField:string
    private _nameField:string
    private _levelField:string
    private _leftValueField:string
    private _rightValueField:string 
    private _treeId:any
    constructor(tableName:string,options?:FlexTreeManagerOptions<Node,IdType,TreeIdType>){
        this._tableName = tableName
        this._options = deepMerge({
            treeId        : undefined,          
            fields:{
                id        : 'id',
                name      : 'name',
                treeId    : 'tree',                
                level     : 'level',
                leftValue : 'leftValue',
                rightValue: 'rightValue'
            }
        },options) as RequiredDeep<FlexTreeManagerOptions<Node,IdType,TreeIdType>>
        this._idField = this._options.fields.id
        this._treeIdField =this._options.fields.treeId
        this._nameField = this._options.fields.name        
        this._levelField = this._options.fields.level
        this._leftValueField = this._options.fields.leftValue
        this._rightValueField = this._options.fields.rightValue 
        this._treeId = this.options.treeId
    } 
    get options(){ return this._options }    
    get updating(){ return this._isUpdating }
    get on(){ return this._emitter.on.bind(this) }
    get off(){ return this._emitter.off.bind(this) }
    get emit(){ return this._emitter.emit.bind(this) }
    get isMultiTree(){ return this._treeId !== undefined }
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
    // update(updater:FlexTreeUpdater<IFlexTreeNode<Node,IdType,TreeIdType>>){
    //     if(this._isUpdating) throw new Error('FlexTree is updating')
    // }

    /***************************** 获取Sql读操作 *****************************/

    /**
     * 执行读取操作
     * @param sqls 
     * @returns 
     */
    async onExecuteReadSql(sql:string):Promise<any>{
        if(typeof this._options.onRead !== 'function') throw new Error('options.onRead is not a function')
        return await this._options.onRead(sql)    
    } 
    /**
     * 当构建完sql后调用,供子类继承,以便可以对在执行SQL前对Sql进行处理
     * 
     *
     * @param sql 
     */
    onBeforeRead(sql:string){
        // 在一表多树时,需要增加额外的树判定
        if(this._treeId){
            const treeId = typeof(this._treeId)=='string' ? `'${this._treeId}'` : this._treeId  
            sql = sql.params({__TREE_ID__: `${this._treeIdField}=${treeId} AND ` ||''})
        }else{
            sql = sql.params({__TREE_ID__:''})
        }                
        if(typeof(this.options.onBeforeRead)=='function'){
            sql =  this.options.onBeforeRead(sql)
        }
        return sql
    }
    /***************************** 获取Sql写操作 *****************************/
    onBeforeWrite(sqls:string[]){             
        if(typeof(this.options.onBeforeWrite)=='function'){
            this.options.onBeforeWrite(sqls)
        }
        return sqls
    }

        /**
     * 执行读取操作
     * @param sqls 
     * @returns 
     */
    async onExecuteWriteSql(sqls:string[]):Promise<any>{
        if(typeof this._options.onWrite !== 'function') throw new Error('options.onWrite is not a function')
        return await this._options.onWrite(sqls)    
    } 
    /***************************** 获取树节点 *****************************/
    /**
     * 获取指定的id节点
     * 
     * @param id 
     */
    async getNode(nodeId:IdType):Promise<IFlexTreeNode<Node,IdType,TreeIdType> | undefined>{ 
        const sql = this.onBeforeRead(`SELECT * FROM ${this._tableName} 
            WHERE {__TREE_ID__} (${this._idField}=${escapeSqlString(nodeId)})`)
        const result = await this.onExecuteReadSql(sql)
        if(result.length === 0) throw new FlexNodeNotFound()
        return result[0] as IFlexTreeNode<Node,IdType,TreeIdType>
    } 

    /**
     * 获取指定节点的所有后代
     * 
     * @param node 
     * @param options 
     *  - level:        限制返回的级别
     *  - includeSelf:  返回结果是否包括自身
     */
    async getDescendants(nodeId:IdType,options?:{level?:number,includeSelf?:boolean}):Promise<IFlexTreeNode[]>{
        const { level,includeSelf} =Object.assign({includeSelf:false,level:0},options)
        let sql:string =''
        if(level==0){  //不限定层级
            sql=this.onBeforeRead(`SELECT Node.* FROM ${this._tableName} Node
                JOIN ${this._tableName} RelNode ON RelNode.${this._idField} = ${escapeSqlString(nodeId)}
                WHERE 
                  {__TREE_ID__} 
                  ((Node.${this._leftValueField} > RelNode.${this._leftValueField}
                  AND Node.${this._rightValueField} < RelNode.${this._rightValueField})                  
                  ${includeSelf ? `OR Node.${this._idField} = ${escapeSqlString(nodeId)}` : ''})     
                ORDER BY ${this._leftValueField}             
                `)
        }else{ //限定层级
            sql=this.onBeforeRead(`SELECT Node.* FROM ${this._tableName} Node
                JOIN ${this._tableName} RelNode ON RelNode.${this._idField} = ${escapeSqlString(nodeId)}
                WHERE 
                {__TREE_ID__} 
                ((Node.${this._leftValueField} > RelNode.${this._leftValueField}
                AND Node.${this._rightValueField} < RelNode.${this._rightValueField}
                -- 限定层级
                AND Node.${this._levelField} > RelNode.${this._levelField}
                AND Node.${this._levelField} <= RelNode.${this._levelField}+${level})
                ${includeSelf ? `OR Node.${this._idField} = ${escapeSqlString(nodeId)}` : ''})
                ORDER BY ${this._leftValueField}             
            `)
        }
        // 得到的平面形式的节点列表
        return await this.onExecuteReadSql(sql)      
    }
    /**
     * 获取后代节点数量
     */
    async getDescendantCount(nodeId:IdType){ 
        const sql = this.onBeforeRead(`SELECT COUNT(*) FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.${this._idField} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
                (   
                    Node.${this._leftValueField} > RelNode.${this._leftValueField}
                    AND Node.${this._rightValueField} < RelNode.${this._rightValueField}
                )       
        `)        
        return await this.getScalar(sql)
    } 

    private async getOneNode(sql:string):Promise<IFlexTreeNode<Node,IdType,TreeIdType>>{        
        const result = await this.onExecuteReadSql(sql)  
        if(result.length === 0) throw new FlexNodeNotFound()
        return result[0] as IFlexTreeNode<Node,IdType,TreeIdType>
    }
    
    private async getNodeList(sql:string):Promise<IFlexTreeNode<Node,IdType,TreeIdType>[]>{        
        return await this.onExecuteReadSql(sql)  
    }
    private async getScalar<T=number>(sql:string):Promise<T>{        
        return await this.onExecuteReadSql(sql)  as T
    }

    /**
     * 仅获取子节点
     * 
     * @param nodeId 
     * @returns 
     */
    async getChildren(nodeId:IdType){
        return await this.getDescendants(nodeId,{level:1})
    }

    /**
     * 获取所有祖先节点,包括父节点
     * @param node 
     * @param options 
     */
    async getAncestors(nodeId:IdType,options?:{includeSelf?:boolean}){
        const { includeSelf } = Object.assign({includeSelf:false},options)
        const sql = this.onBeforeRead(`SELECT Node.* FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.${this._idField} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
            (
                (   
                    Node.${this._leftValueField} < RelNode.${this._leftValueField}
                    AND Node.${this._rightValueField} > RelNode.${this._rightValueField}
                )   
                ${includeSelf ? `OR Node.${this._idField} = ${escapeSqlString(nodeId)}` : ''})
            ) 
            ORDER BY ${this._leftValueField}     
        `)        
        return await this.getNodeList(sql)  
    }
    /**
     *  获取祖先节点数量(不包括自身)
     * @param nodeId
     */
    async getAncestorsCount(nodeId:IdType){
        const sql = this.onBeforeRead(`SELECT COUNT(*) FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.${this._idField} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
                (   
                    Node.${ this._leftValueField} < RelNode.${ this._leftValueField }
                    AND Node.${ this._rightValueField} > RelNode.${ this._rightValueField }
                )       
        `)        
        return await this.getScalar(sql)  
    }

    /**
     * 获取父节点
     * @param nodeId 
     * @returns 
     */
    async getParent(nodeId:IdType):Promise<IFlexTreeNode<Node,IdType,TreeIdType>>{ 
        const sql = this.onBeforeRead(`SELECT Node.* FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.${this._idField} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__}  
            (   
                Node.${this._leftValueField} < RelNode.${this._leftValueField}
                AND Node.${this._rightValueField} > RelNode.${this._rightValueField}
            )  
            ORDER BY ${this._leftValueField} DESC LIMIT 1     
        `)        
        const result = await this.onExecuteReadSql(sql)  
        if(result.length === 0) throw new FlexNodeNotFound()
        return result[0] as IFlexTreeNode<Node,IdType,TreeIdType>
    }
    /**
     * 获取所有兄弟节点
     * 
     * SELECT Node.* FROM user Node
        JOIN (
        SELECT Node.* FROM user Node
        JOIN user RelNode ON RelNode.id = 'd'
        WHERE (Node.tree_left < RelNode.tree_left 
        AND Node.tree_right > RelNode.tree_right  ) 
        ORDER BY Node.tree_left DESC LIMIT 1
        ) ParentNode
        WHERE 
            (
                Node.tree_left > ParentNode.tree_left 
                AND Node.tree_right < ParentNode.tree_right  
                AND Node.tree_level =  ParentNode.tree_level +1
            ) 
        ORDER BY Node.tree_left 


     * @param node 
     * @param options 
     */
    async getSiblings(nodeId:IdType,options?:{includeSelf?:boolean}){
        const { includeSelf } = Object.assign({includeSelf:false},options)
        const sql = this.onBeforeRead(`SELECT Node.* FROM ${this._tableName} Node
            JOIN (
                SELECT Node.* FROM ${this._tableName} Node
                JOIN ${this._tableName} RelNode ON RelNode.${this._idField} = ${escapeSqlString(nodeId)}
                WHERE 
                    (Node.${this._leftValueField} < RelNode.${this._leftValueField} 
                    AND Node.${this._rightValueField} > RelNode.${this._rightValueField} )
                ORDER BY Node.${this._leftValueField} DESC LIMIT 1
            ) ParentNode
            WHERE {__TREE_ID__}  
            (
                (
                    Node.${this._leftValueField} > ParentNode.${this._leftValueField} 
                    AND Node.${this._rightValueField} < ParentNode.${this._rightValueField}
                    AND Node.${this._levelField} = ParentNode.${this._levelField}+1
                    ${includeSelf ? '' : `AND Node.${this._idField} != ${escapeSqlString(nodeId)}`}
                )                
            )
            ORDER BY ${this._leftValueField}     
        `)        
        return await this.getNodeList(sql) 
    }
    
    /**
     * 获取下一个兄弟节点
     * 
       下一节点应满足：同一级别，同一棵树,Left要大于node.tree_left,且具有同一个

       SELECT Node.* FROM user Node
        JOIN user RelNode ON RelNode.id = 'g'
        WHERE 
            (Node.tree_left = RelNode.tree_right+1   
        AND Node.tree_id=0
        ) LIMIT 1  


     * @param nodeId 
     * @param options 
     */
    async getNextSiblings(nodeId:IdType){
        const sql = this.onBeforeRead(`SELECT Node.* FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.id = ${escapeSqlString(nodeId)}             
            WHERE {__TREE_ID__}  
                (
                    Node.${this._leftValueField} = RelNode.${this._rightValueField}+1  
                )     
            LIMIT 1`)     
        return await this.getOneNode(sql)   
    }

    /**
     * 获取上一个兄弟节点
     * @param nodeId 
     * @param options 
     */
    async getPreviousSibling(nodeId:IdType){
        const sql = this.onBeforeRead(`SELECT Node.* FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.id = ${escapeSqlString(nodeId)}             
            WHERE {__TREE_ID__}  
                (
                    Node.${this._rightValueField} = RelNode.${this._leftValueField}-1  
                )     
            LIMIT 1`)        
        return await this.getOneNode(sql)   
    }
    


    /**
     * 获取根节点
     * 
     * 一棵树仅有一个根节点,所以只需要获取leftValue=1的节点即可 
     * 
     */
    async getRoot(){
        const sql = this.onBeforeRead(`SELECT * FROM ${this._tableName} 
                        WHERE {__TREE_ID__} ${this._leftValueField}=1`)
        return await this.getOneNode(sql)   
    }

    /**
     * 
     * 获取树所有节点列表
     * 
     * @param level    限定层级
     * @returns        返回节点列表
     */
    async getAll(options?:{level?:number}){
        const { level } = Object.assign({level:0},options)
        const sql = `SELECT * FROM ${this._tableName}
                        WHERE {__TREE_ID__} 
                        ${this._levelField}<=${level} 
                        ORDER BY ${this._leftValueField}                    `
        return await this.getNodeList(sql)
    }

    isRoot(node:IFlexTreeNode<Node,IdType,TreeIdType>){
        return node.level == 0 && node.leftValue == 1
    }

    private handleNodeData(nodes:IFlexTreeNode<Node,IdType,TreeIdType>[]){

    }
    


    /***************************** 添加树节点 *****************************/


    /**
     * 创建根节点
     * 
     * 如果根节点已经存在，则抛出异常
     * 
     * 
     * createRoot({id:1,name:'root'})  // 如果根节点已经存在，则抛出异常
     * 
     * 
     * @param node 
     */
    async createRoot(node:IFlexTreeNode<Node,IdType,TreeIdType>,options?:{upsert?:boolean}){        
        const { upsert } = Object.assign({upsert:true},options)
        // 1. 创建根节点数据
        const nodeData =Object.assign({},node,{                
            [this._leftValueField]: 1,
            [this._rightValueField]: 2,
            [this._levelField]: 0
        })
        const sqls = [
            buildInsertSql(this._tableName,nodeData,{
                fieldNames: this._options.fields,
                treeId: this._treeId,
                upsert,
                conflict: this._treeId ? [this._treeId,this._idField] : [this._idField]
            })            
        ]
        await this._options.onWrite(sqls)
    }

    /**
     * 
     * 增加多个节点
     * 
     * addNode([{},{}],'nodeId',FlexNodeRelPosition.LastChild)
     * 
     * @param nodes
     * @param targetNode     添加到的目标节点的指定位置，默认根节点
     * @param pos            添加的位置，默认为最后一个子节点
     * 
     */
    async addNodes(nodes:IFlexTreeNode<Node,IdType,TreeIdType>[],targetNode:IdType | IFlexTreeNode<Node,IdType,TreeIdType>,pos:FlexNodeRelPosition = FlexNodeRelPosition.LastChild){
        
        // 1. 先获取要添加的目标节点的信息，得到目标节点的leftValue,rightValue,level等
        let relNode:IFlexTreeNode<Node,IdType,TreeIdType>
        
        // 如果输入的是节点对象已经包含了节点信息，可以直接使用
        if(targetNode==undefined){// 未指定目标节点，则添加到根节点
            relNode = await this.getRoot() as IFlexTreeNode<Node,IdType,TreeIdType>
            if(!relNode) throw new FlexTreeNotExists()
        }else if(isLikeNode(targetNode,this._options.fields)){
            relNode = targetNode as IFlexTreeNode<Node,IdType,TreeIdType>
        }else if(['string','number'].includes(typeof(targetNode))){     // 否则需要根据ID获取节点信息
            relNode = await this.getNode(targetNode as IdType) as IFlexTreeNode<Node,IdType,TreeIdType>
        }else{
            throw new FlexTreeError('Invalid target node parameter')
        }
        if(isValidNode(relNode!)){
            throw new FlexNodeNotFound('Invalid target node')
        }

        // 2. 处理添加位置
        if(this.isRoot(relNode!)){ 
            if(pos == FlexNodeRelPosition.NextSibling || pos == FlexNodeRelPosition.PreviousSibling){
                throw new FlexTreeError('Root node can not have next and previous sibling node')
            }
        }





           

        
        // 

        // //2. 处理节点数据

        // let sqls:string[] = []
        // // 1. 处理节点数据
        // nodes.forEach((node,index)=>{
        //     return {
        //         ...node,
        //         [this._treeIdField]: this._treeId,
        //         [this._levelField]: 0,
        //         [this._leftValueField]: 0,
        //         [this._rightValueField]: 0
        //     }
        // })
        // if(pos== FlexNodeRelPosition.LastChild){
        //     sqls.push(this.onBeforeRead(`
        //         INSERT INFO ${this._tableName} VALUES 
        //     `))

        // }else if(pos==FlexNodeRelPosition.FirstChild){

        // }else if(pos== FlexNodeRelPosition.NextSibling){

        // }else if(pos == FlexNodeRelPosition.PreviousSibling){

        // }
    }

}
