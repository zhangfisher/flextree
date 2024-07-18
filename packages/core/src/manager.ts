 
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
import {  CustomTreeKeyFields, DefaultTreeKeyFields, FlexNodeRelPosition, FlexTreeNodeRelation, FlexTreeUpdater, IFlexTreeNode, NonUndefined } from "./types" 
import { deepMerge } from "flex-tools/object/deepMerge"
import mitt from 'mitt' 
import {RequiredDeep } from "type-fest"
import { FlexTreeNodeError, FlexTreeNodeNotFoundError, FlexTreeDriverError, FlexTreeError, FlexTreeNotExists, FlexTreeInvalidUpdateError } from "./errors"
import { isLikeNode } from "./utils/isLikeNode"
import { isValidNode } from './utils/isValidNode'; 
import { escapeSqlString } from './utils/escapeSqlString';
import { FlexTreeEvents } from "./tree"
import { IDatabaseDriver } from "./driver"
import sqlString from "sqlString" 

export interface FlexTreeManagerOptions<TreeIdType=number>{
    treeId?     : TreeIdType                    // 使用支持单表多树时需要提供
    fields?: {
        id?        : string
        name?      : string
        treeId?    : string
        level?     : string
        leftValue? : string
        rightValue?: string
    }
    driver: IDatabaseDriver 
}


/**
 * 
 * 
 * 
 * 泛型:
 *  - Node:  除了关键字段外的其他字段
 *  - NodeId:  id字段的类型
 *  - TreeIdType:  treeId字段的类型
 *  - KeyFields: 当自定义的关键字段名称,需要提供该类型
 * 
 */
export class FlexTreeManager<
        Data extends Record<string,any>={},
        KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
        TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
        NodeId = NonUndefined<KeyFields['id']>[1],
        TreeId = NonUndefined<KeyFields['treeId']>[1]
    >{
    private _options:RequiredDeep<FlexTreeManagerOptions<TreeId>>
    private _isUpdating = false
    private _emitter = mitt<FlexTreeEvents>()
    private _tableName:string       
    private _treeId:any
    private _fields:RequiredDeep<NonUndefined<FlexTreeManagerOptions['fields']>>
    private _driver:IDatabaseDriver
    private _ready:boolean = false                          // 当driver准备就绪时,ready为true时,才允许执行读写操作
    constructor(tableName:string,options?:FlexTreeManagerOptions<KeyFields['treeId']>){
        this._tableName = tableName
        this._options = deepMerge({
            treeId        : undefined,          
            fields:{
                id        : 'id',
                name      : 'name',
                treeId    : 'treeId',                
                level     : 'level',
                leftValue : 'leftValue',
                rightValue: 'rightValue'
            }
        },options) as RequiredDeep<FlexTreeManagerOptions<TreeId>>
        if(!this._options.driver){
            throw new FlexTreeError('not found database driver')
        } 
        this._fields = this._options.fields 
        this._treeId = this.options.treeId
        this._driver = this.options.driver
        this._driver.bind(this as FlexTreeManager)
    } 
    get options(){ return this._options }    
    get updating(){ return this._isUpdating }
    get tableName(){ return this._tableName }
    get on(){ return this._emitter.on.bind(this) }
    get off(){ return this._emitter.off.bind(this) }    
    get emit(){ return this._emitter.emit.bind(this) }
    get driver(){  return this._options.driver!}
    get treeId(){ return this._treeId}
    get isMultiTree(){ return this._treeId !== undefined}

    async ready(){
        if(this._driver && this._ready) return true
        return false
    }
    
    


    /***************************** SQL 操作 *****************************/

    async assertDriverReady(){
        try{
            if(!this._driver) throw new FlexTreeDriverError()
            if(!this._driver.ready){
                await this._driver.open()
            }
        }catch(e:any){
            throw new FlexTreeDriverError(e.message)
        }   
        if(!this._driver.ready) throw new FlexTreeDriverError()
    }

    /**
     * 执行读取操作
     * @param sqls 
     * @returns 
     */    
    async onExecuteReadSql(sql:string):Promise<any>{
        await this.assertDriverReady()        
        return await this._driver.getRows(sql)
    } 
     
    
    /**
     * 执行操作，无返回值
     * @param sqls 
     * @returns 
     */
    async onExecuteSql(sqls:string[]):Promise<any>{        
        await this.assertDriverReady()        
        return await this._driver.exec(sqls) 
    } 

    async onExecuteWriteSql(sqls:string[]):Promise<any>{        
        await this.assertDriverReady()        
        return await this._driver.exec(sqls) 
    } 
    async onGetScalar(sql:string):Promise<any>{        
        await this.assertDriverReady()        
        return await this._driver.getScalar(sql) 
    } 
    /**
     * 构建sql时调用，进行一些额外的处理
     * 
     *
     * @param sql 
     */
    private _sql(sql:string){
        // 在一表多树时,需要增加额外的树判定
        if(this._treeId){
            const treeId = typeof(this._treeId)=='string' ? `'${this._treeId}'` : this._treeId  
            sql = sql.params({__TREE_ID__: `${this._fields.treeId}=${treeId} AND ` ||''})
        }else{
            sql = sql.params({__TREE_ID__:''})
        }      
        return sql
    }

    
    /**
     * 执行更新操作
     * 
     * 由于树更新操作需要破坏树的leftValue,rightValue等，
     * 所以需要严格禁止并发操作，因此所有的树更新操作需要通过update方法进行
     * 
     * update方法通过设置isUpdating标志位来阻止并发操作
     * 
     * tree.update(async ()=>{
     *    
     * })
     * 
     * @param callback 
     */
    async update(updater:FlexTreeUpdater){
        if(this._isUpdating) throw new Error('The tree update operation must be performed within update(async ()=>{....})')
        this._isUpdating = true     
        try{
            await updater(this as FlexTreeManager)
        }catch(e){
            throw e        
        }finally{
            this._isUpdating = false
        }
    }

    /***************************** SQL 写操作 *****************************/
 
    /**
     * 获取节点列表
     * 
     * 说明：
     *  - 在多树表中,onBeforeRead方法里面会将{__TREE_ID__}替换为实际的 树ID AND，所以{__TREE_ID__} 1
     * 
     * @returns 
     */
    async getNodes():Promise<TreeNode[]>{
        const sql =this._sql(`SELECT * FROM ${this._tableName} ${this.isMultiTree ? `WHERE {__TREE_ID__} 1` : ''} ORDER BY ${this._fields.leftValue}`)
        return await this.onExecuteReadSql(sql) 
    }

    /***************************** 获取树节点 *****************************/

    /**
     * 根据id获取节点
     * @param nodeId 
     */
    async getNode(nodeId:NodeId):Promise<TreeNode | undefined>{ 
        const sql = this._sql(`SELECT * FROM ${this._tableName} 
            WHERE {__TREE_ID__} (${this._fields.id}=${escapeSqlString(nodeId)})`)
        const result = await this.onExecuteReadSql(sql)
        if(result.length === 0) throw new FlexTreeNodeNotFoundError()
        return result[0] as TreeNode
    } 

    /**
     * 获取指定节点的所有后代
     * 
     * @param node 
     * @param options 
     *  - level:        限制返回的级别
     *  - includeSelf:  返回结果是否包括自身
     */
    async getDescendants(nodeId:NodeId,options?:{level?:number,includeSelf?:boolean}):Promise<IFlexTreeNode[]>{
        const { level,includeSelf} =Object.assign({includeSelf:false,level:0},options)
        let sql:string =''
        if(level==0){  //不限定层级
            sql=this._sql(`SELECT Node.* FROM ${this._tableName} Node
                JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id} = ${escapeSqlString(nodeId)}
                WHERE 
                  {__TREE_ID__} 
                  ((Node.${this._fields.leftValue} > RelNode.${this._fields.leftValue}
                  AND Node.${this._fields.rightValue} < RelNode.${this._fields.rightValue})                  
                  ${includeSelf ? `OR Node.${this._fields.id} = ${escapeSqlString(nodeId)}` : ''})     
                ORDER BY ${this._fields.leftValue}             
                `)
        }else{ //限定层级
            sql=this._sql(`SELECT Node.* FROM ${this._tableName} Node
                JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id} = ${escapeSqlString(nodeId)}
                WHERE 
                {__TREE_ID__} 
                ((Node.${this._fields.leftValue} > RelNode.${this._fields.leftValue}
                AND Node.${this._fields.rightValue} < RelNode.${this._fields.rightValue}
                -- 限定层级
                AND Node.${this._fields.level} > RelNode.${this._fields.level}
                AND Node.${this._fields.level} <= RelNode.${this._fields.level}+${level})
                ${includeSelf ? `OR Node.${this._fields.id} = ${escapeSqlString(nodeId)}` : ''})
                ORDER BY ${this._fields.leftValue}             
            `)
        }
        // 得到的平面形式的节点列表
        return await this.onExecuteReadSql(sql)      
    }
    /**
     * 获取后代节点数量
     */
    async getDescendantCount(nodeId:NodeId){ 
        const sql = this._sql(`SELECT COUNT(*) FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
                (   
                    Node.${this._fields.leftValue} > RelNode.${this._fields.leftValue}
                    AND Node.${this._fields.rightValue} < RelNode.${this._fields.rightValue}
                )       
        `)        
        return await this.getScalar(sql)
    } 

    private async getOneNode(sql:string):Promise<TreeNode>{        
        const result = await this.onExecuteReadSql(sql)  
        if(result.length === 0) throw new FlexTreeNodeNotFoundError()
        return result[0] as TreeNode
    }
    
    private async getNodeList(sql:string):Promise<TreeNode[]>{        
        return await this.onExecuteReadSql(sql)  
    }
    private async getScalar<T=number>(sql:string):Promise<T>{        
        return await this.driver.getScalar(sql)  as T
    }

    /**
     * 仅获取子节点
     * 
     * @param nodeId 
     * @returns 
     */
    async getChildren(nodeId:NodeId){
        return await this.getDescendants(nodeId,{level:1})
    }

    /**
     * 获取所有祖先节点,包括父节点
     * @param node 
     * @param options 
     */
    async getAncestors(nodeId:NodeId,options?:{includeSelf?:boolean}){
        const { includeSelf } = Object.assign({includeSelf:false},options)
        const sql = this._sql(`SELECT Node.* FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
            (
                (   
                    Node.${this._fields.leftValue} < RelNode.${this._fields.leftValue}
                    AND Node.${this._fields.rightValue} > RelNode.${this._fields.rightValue}
                )   
                ${includeSelf ? `OR Node.${this._fields.id} = ${escapeSqlString(nodeId)}` : ''})
            ) 
            ORDER BY ${this._fields.leftValue}     
        `)        
        return await this.getNodeList(sql)  
    }
    /**
     *  获取祖先节点数量(不包括自身)
     * @param nodeId
     */
    async getAncestorsCount(nodeId:NodeId){
        const sql = this._sql(`SELECT COUNT(*) FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
                (   
                    Node.${ this._fields.leftValue} < RelNode.${ this._fields.leftValue }
                    AND Node.${ this._fields.rightValue} > RelNode.${ this._fields.rightValue }
                )       
        `)        
        return await this.getScalar(sql)  
    }

    /**
     * 获取父节点
     * @param nodeId 
     * @returns 
     */
    async getParent(nodeId:NodeId):Promise<TreeNode>{ 
        const sql = this._sql(`SELECT Node.* FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__}  
            (   
                Node.${this._fields.leftValue} < RelNode.${this._fields.leftValue}
                AND Node.${this._fields.rightValue} > RelNode.${this._fields.rightValue}
            )  
            ORDER BY ${this._fields.leftValue} DESC LIMIT 1     
        `)        
        const result = await this.onExecuteReadSql(sql)  
        if(result.length === 0) throw new FlexTreeNodeNotFoundError()
        return result[0] as TreeNode
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
    async getSiblings(nodeId:NodeId,options?:{includeSelf?:boolean}){
        const { includeSelf } = Object.assign({includeSelf:false},options)
        const sql = this._sql(`SELECT Node.* FROM ${this._tableName} Node
            JOIN (
                SELECT Node.* FROM ${this._tableName} Node
                JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id} = ${escapeSqlString(nodeId)}
                WHERE 
                    (Node.${this._fields.leftValue} < RelNode.${this._fields.leftValue} 
                    AND Node.${this._fields.rightValue} > RelNode.${this._fields.rightValue} )
                ORDER BY Node.${this._fields.leftValue} DESC LIMIT 1
            ) ParentNode
            WHERE {__TREE_ID__}  
            (
                (
                    Node.${this._fields.leftValue} > ParentNode.${this._fields.leftValue} 
                    AND Node.${this._fields.rightValue} < ParentNode.${this._fields.rightValue}
                    AND Node.${this._fields.level} = ParentNode.${this._fields.level}+1
                    ${includeSelf ? '' : `AND Node.${this._fields.id} != ${escapeSqlString(nodeId)}`}
                )                
            )
            ORDER BY ${this._fields.leftValue}     
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
    async getNextSiblings(nodeId:NodeId){
        const sql = this._sql(`SELECT Node.* FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.id = ${escapeSqlString(nodeId)}             
            WHERE {__TREE_ID__}  
                (
                    Node.${this._fields.leftValue} = RelNode.${this._fields.rightValue}+1  
                )     
            LIMIT 1`)     
        return await this.getOneNode(sql)   
    }

    /**
     * 获取上一个兄弟节点
     * @param nodeId 
     * @param options 
     */
    async getPreviousSibling(nodeId:NodeId){
        const sql = this._sql(`SELECT Node.* FROM ${this._tableName} Node
            JOIN ${this._tableName} RelNode ON RelNode.id = ${escapeSqlString(nodeId)}             
            WHERE {__TREE_ID__}  
                (
                    Node.${this._fields.rightValue} = RelNode.${this._fields.leftValue}-1  
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
        const sql = this._sql(`SELECT * FROM ${this._tableName} 
                        WHERE {__TREE_ID__} ${this._fields.leftValue}=1`)
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
                        ${this._fields.level}<=${level} 
                        ORDER BY ${this._fields.leftValue}                    `
        return await this.getNodeList(sql)
    }
    /**
     * 
     * 判断输入的节点对象是否是根节点
     * 
     */
    isRoot(node:TreeNode){
        return node.level == 0 && node.leftValue == 1
    }
    /**
     * 返回是否存在根节点
     * @returns 
     */
    async hasRoot(){
        const sql = this._sql(`select count(*) from ${this._tableName} 
            where {__TREE_ID__} ${this._fields.leftValue}=1 and ${this._fields.level}=0`)
        return await this.getScalar(sql) == 1 
    }
    /**
     * 返回满足条件的节点
     * 
     * 只返回第一个满足条件的节点
     * 
     * findNode(1)                   根据ID查找节点
     * findNode({name:"A"})          根据name查找节点 
     * findNode({name:"A",level:1})  根据组合AND条件查找节点
     * 
     */
    async findNode(node:NodeId | Partial<TreeNode>):Promise<TreeNode>{
        let nodes:TreeNode[]=[]
        if(typeof(node) == 'object'){
            nodes = await this.findNodes(node as Partial<TreeNode>)
        }else{
            nodes = await this.findNodes({[this._fields.id]:node} as Partial<TreeNode>)
        }
        
        if(nodes.length == 0) throw new FlexTreeNodeNotFoundError()
        return nodes[0] as TreeNode
    }
    /**
     * 
     * 返回满足条件的节点
     
       只提供简单的条件查询语法，更复杂的查询请使用数据库查询

     * findNodes({name:"A"})          根据name查找节点 
     * findNodes({name:"A",level:1})  根据组合AND条件查找节点
     * 
     */
    async findNodes(condition: Partial<TreeNode>):Promise<TreeNode[]>{
        const keys = Object.keys(condition)
        if(keys.length == 0) throw new FlexTreeError('Invalid condition')
        const sql = this._sql(`select * from ${this._tableName}
            where  {__TREE_ID__} ${keys.map(key=>{ 
                return `${sqlString.escapeId(key)}=${escapeSqlString(condition[key])}`
            }).join(' AND ')}
        `)
        return await this.onExecuteReadSql(sql)

    }
    /***************************** 添加节点 *****************************/

    /**
     * 在多树表中，需要在记录中注入treeId字段
     */
    private withTreeId(record:Record<string,any>){
        if(this.isMultiTree){
            record[this._fields.treeId] = sqlString.escape(this._treeId)
        }
    }
    /**
     * 创建根节点  
     * 
     * 
     * createRoot({name:"A"})
     * 
     * 
     * @param node   节点数据
     */
    async createRoot(node:Partial<TreeNode>){       
        this._assertUpdating()
        if(await this.hasRoot()) throw new FlexTreeNodeError('Root node already exists')
        // 1. 创建根节点数据
        const record =Object.assign({},node,{                
            [this._fields.leftValue] : 1,
            [this._fields.rightValue]: 2,
            [this._fields.level]     : 0
        }) as TreeNode         
        this.withTreeId(record)         
        const keys = Object.keys(record).map(key=>sqlString.escapeId(key)).join(",")
        const values = Object.values(record).map(v=>escapeSqlString(v)).join(",")
        const sql = `INSERT INTO ${this._tableName} (${keys}) VALUES (${values})`
        await this.onExecuteWriteSql([sql])  
    }

    private _assertUpdating(){
        if(!this._isUpdating) throw new FlexTreeInvalidUpdateError()
    }
    
    /**
     * 根据atNode参数返回目标节点的信息
     * - 如果atNode==undefined 代表根据节点
     * - 如果atNode是节点对象，则直接返回
     * - 如果atNode是字符串或数字，则根据ID获取节点信息
     */
    private async _getRelNode(atNode:any){
        let relNode:TreeNode        
        // 如果输入的是节点对象已经包含了节点信息，可以直接使用
        if(atNode==undefined){// 未指定目标节点，则添加到根节点
            relNode = await this.getRoot() as TreeNode
            if(!relNode) throw new FlexTreeNotExists()
        }else if(isLikeNode(atNode,this._options.fields)){
            relNode = atNode as TreeNode
        }else if(['string','number'].includes(typeof(atNode))){     // 否则需要根据ID获取节点信息
            relNode = await this.getNode(atNode as any) as TreeNode
        }else{
            throw new FlexTreeError('Invalid node parameter')
        }
        if(isValidNode(relNode!)){
            throw new FlexTreeNodeNotFoundError('Invalid node parameter')
        }
        return relNode
    }
    /**
     * 
     * 将nodes添加到relNode的子节点集的最后面
     * 
     * @param relNode 
     * @param nodes 
     * @param fields 
     * @returns 
     */
    private _addLastChilds(relNode:TreeNode,nodes:Partial<TreeNode>[],fields:string[]){ 
        const values = nodes.map((node,i)=>{
            let row = [
                relNode[this._fields.level] + 1,
                relNode[this._fields.rightValue] + i*2,
                relNode[this._fields.rightValue] + i*2 +1
            ]
            for(let i=3;i<fields.length;i++){
                row.push(escapeSqlString(node[fields[i]]))
            } 
            return `(${row.join(',')})`
        }).join(',')
        return [
            this._sql(`
                UPDATE ${this._tableName} SET ${this._fields.leftValue} = ${this._fields.leftValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this._fields.leftValue} >= ${relNode[this._fields.rightValue]}
            `),
            this._sql(`
                UPDATE ${this._tableName} SET ${this._fields.rightValue} = ${this._fields.rightValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this._fields.rightValue} >= ${relNode[this._fields.rightValue]}
            `),                     
            this._sql(`
                INSERT INTO ${this._tableName} ( ${fields.map(f=>escapeSqlString(f)).join(",")}) 
                VALUES ${values}
            `)
        ]
    }
    /**
     * 
     * 将nodes添加到relNode的子节点集的最前面
     * 
     */
    private _addFirstChilds(relNode:TreeNode,nodes:Partial<TreeNode>[],fields:string[]){ 
        const values = nodes.map((node,i)=>{
            let row = [
                relNode[this._fields.level] + 1,
                relNode[this._fields.leftValue] + i*2 +1,
                relNode[this._fields.leftValue] + i*2 +2
            ]
            for(let i=3;i<fields.length;i++){
                row.push(escapeSqlString(node[fields[i]]))
            } 
            return `(${row.join(',')})`
        }).join(',')
        return [
            this._sql(`
                UPDATE ${this._tableName} SET ${this._fields.leftValue} = ${this._fields.leftValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this._fields.leftValue} > ${relNode[this._fields.leftValue]}
            `),
            this._sql(`
                UPDATE ${this._tableName} SET ${this._fields.rightValue} = ${this._fields.rightValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this._fields.rightValue} >= ${relNode[this._fields.leftValue]+1}
            `),                     
            this._sql(`
                INSERT INTO ${this._tableName} ( ${fields.map(f=>escapeSqlString(f)).join(",")}) 
                VALUES ${values}
            `)
        ]

    }
    private _addNextSiblings(relNode:TreeNode,nodes:Partial<TreeNode>[],fields:string[]){ 
        const values = nodes.map((node,i)=>{
            let row = [
                relNode[this._fields.level],
                relNode[this._fields.rightValue] + i*2 +1,
                relNode[this._fields.rightValue] + i*2 +2
            ]
            for(let i=3;i<fields.length;i++){
                row.push(escapeSqlString(node[fields[i]]))
            } 
            return `(${row.join(',')})`
        }).join(',')
        return [
            this._sql(`
                UPDATE ${this._tableName} SET ${this._fields.leftValue} = ${this._fields.leftValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this._fields.leftValue} > ${relNode[this._fields.rightValue]}
            `),
            this._sql(`
                UPDATE ${this._tableName} SET ${this._fields.rightValue} = ${this._fields.rightValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this._fields.rightValue} > ${relNode[this._fields.rightValue]}
            `),                     
            this._sql(`
                INSERT INTO ${this._tableName} ( ${fields.map(f=>escapeSqlString(f)).join(",")}) 
                VALUES ${values}
            `)
        ]
    }
    private _addPreviousSiblings(relNode:TreeNode,nodes:Partial<TreeNode>[],fields:string[]){ 
        const values = nodes.map((node,i)=>{
            let row = [
                relNode[this._fields.level],
                relNode[this._fields.leftValue] + i*2,
                relNode[this._fields.leftValue] + i*2 +1
            ]
            for(let i=3;i<fields.length;i++){
                row.push(escapeSqlString(node[fields[i]]))
            } 
            return `(${row.join(',')})`
        }).join(',')
        return [
            this._sql(`
                UPDATE ${this._tableName} SET ${this._fields.leftValue} = ${this._fields.leftValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this._fields.leftValue} >= ${relNode[this._fields.leftValue]}
            `),
            this._sql(`
                UPDATE ${this._tableName} SET ${this._fields.rightValue} = ${this._fields.rightValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this._fields.rightValue} > ${relNode[this._fields.leftValue]}
            `),                     
            this._sql(`
                INSERT INTO ${this._tableName} ( ${fields.map(f=>escapeSqlString(f)).join(",")}) 
                VALUES ${values}
            `)
        ]

    }
    /**
     * 
     * 增加多个节点
     * 
     * addNodes([
     *  {...},
     *  {...}
     * ],'nodeId',FlexNodeRelPosition.LastChild)
     * 
     * 
     * 1. 批量插入时，需要保证节点数据的字段名称是一样的，比如
     *    addNode([{id:1,name:'test'},{id:2,xname:'test2'}])  // ❌错误
     * 2. 所有关键字段中(id,name,treeId,leftValue,rightValue,level)中，
     *      leftValue,rightValue,level是自动计算的，不需要手动输入
     *      id字段则取决于数据库表设计，如果是自增则不必设置，否则需要
     *      treeId则是在
     * 
     * 
     * ，id是自增的，则可以不必指定，是可选的
     * 3. 如果是单树表，可以不必指定treeId,如果是多树表，则必须指定
     * 
     * 
     * 
     * @param nodes
     * @param atNode     添加到的目标节点的指定位置， undefined代表根节点
     * @param pos            添加的位置，默认为最后一个子节点
     * 
     */
    async addNodes(nodes:Partial<TreeNode>[],atNode?:NodeId | TreeNode | null, pos:FlexNodeRelPosition = FlexNodeRelPosition.LastChild){
        this._assertUpdating()

        if(nodes.length == 0) return

        // 1. 先获取要添加的目标节点的信息，得到目标节点的leftValue,rightValue,level等
        const relNode = await this._getRelNode(atNode) 

        // 2. 检查添加位置是否合法
        if(this.isRoot(relNode!)){ 
            if(pos == FlexNodeRelPosition.NextSibling || pos == FlexNodeRelPosition.PreviousSibling){
                throw new FlexTreeError('Root node can not have next and previous sibling node')
            }
        }

        // 2. 处理节点数据:   单树表不需要增加treeId字段
        const fields:string[] = [
            this._fields.level,
            this._fields.leftValue,
            this._fields.rightValue
        ]
        if(this.isMultiTree) fields.push(this._fields.treeId)        
        fields.push(...Object.keys(nodes[0]).filter(f=>!fields.includes(f)))// 添加其他字段


        let sqls:string[] = []
        
        if(pos== FlexNodeRelPosition.LastChild){           
            sqls = this._addLastChilds(relNode,nodes,fields) 
        }else if(pos==FlexNodeRelPosition.FirstChild){
            sqls = this._addFirstChilds(relNode,nodes,fields) 
        }else if(pos== FlexNodeRelPosition.NextSibling){
            sqls= this._addNextSiblings(relNode,nodes,fields)
        }else if(pos == FlexNodeRelPosition.PreviousSibling){
            sqls = this._addPreviousSiblings(relNode,nodes,fields)
        }
        await this.onExecuteWriteSql(sqls)
    } 
    /***************************** 移动节点 *****************************/ 
    private async _moveToLastChild(node:NodeId | TreeNode,atNode:TreeNode){
        return []
    }
    private async _moveToFirstChild(node:NodeId | TreeNode,atNode?:NodeId | TreeNode){
        return []  
    }
    private async _moveToNextSibling(node:NodeId | TreeNode,atNode?:NodeId | TreeNode){
        return []  
    }
    private async _moveToPreviousSibling(node:NodeId | TreeNode,atNode?:NodeId | TreeNode){
        return []  
    }

    /**
     * 
     * 返回node是否允许移动到atNode的指定的位置
     * 
     * 
     * 当满足以下条件时不允许移动
     * 
     *  - 两个节点是一样的
     * - toNode是node的后代
     *
     * @example
     * 
     *   canMoveNode(node1,node2)       node1能否移动到node2的后面，即下一个兄弟节点
     *   canMoveNode(node1,node2,FlexNodeRelPosition.LastChild)  node1能否移动为node2的最后一个子节点
     * 
     */
    async canMoveNode(node:NodeId | TreeNode,toNode?:NodeId | TreeNode, pos:FlexNodeRelPosition = FlexNodeRelPosition.NextSibling){
        const fromNode = this._getRelNode(node) as unknown as TreeNode
        toNode = this._getRelNode(toNode) as unknown as TreeNode
        
        let isAllow:boolean = true
        
        if(!this.isMultiTree || (this.isMultiTree && toNode[this._fields.treeId]==fromNode[this._fields.treeId])){        
            if(toNode[this._fields.id]==fromNode[this._fields.id]){
                isAllow=false
            }else{
                const r = await this.getNodeRelation(toNode,node)
                if(r == FlexTreeNodeRelation.Descendants){
                    isAllow =false
                }
            }
        }

        return isAllow
    }
    /**
     * 
     * 移动node到atNode节点lastChild,firstChild,NextSibling,PreviousSibling
     * 
     */
    async moveNode(node:NodeId | TreeNode,toNode?:NodeId | TreeNode, pos:FlexNodeRelPosition = FlexNodeRelPosition.NextSibling){
        this._assertUpdating()
        if(!node || !toNode) throw new Error('invalid param')
        
        let relNode = this._getRelNode(toNode) as unknown as TreeNode
        if(this.isRoot(relNode)){ 
            if(pos == FlexNodeRelPosition.NextSibling || pos == FlexNodeRelPosition.PreviousSibling){
                throw new FlexTreeError('Root node can not have next and previous sibling node')
            }
        }





        let sqls:string[] = []
        if(pos== FlexNodeRelPosition.LastChild){           
            sqls = await  this._moveToLastChild(node,relNode) 
        }else if(pos==FlexNodeRelPosition.FirstChild){
            sqls = await this._moveToFirstChild(node,relNode) 
        }else if(pos== FlexNodeRelPosition.NextSibling){
            sqls=await  this._moveToNextSibling(node,relNode)
        }else if(pos == FlexNodeRelPosition.PreviousSibling){
            sqls = await this._moveToPreviousSibling(node,relNode)
        }


    }
    
    moveUpNode(node:NodeId | TreeNode){

    }
    moveDownNode(node:NodeId | TreeNode){
        
    }
    /**
     * 返回两个节点是否在同一棵树中
     */
    isSameTree(srcNode:TreeNode,targetNode:TreeNode){
        if(this.isMultiTree){
            return srcNode[this._fields.treeId] == targetNode[this._fields.treeId]
        }else{
            return true        
        }
    }
    isSameNode(node1:TreeNode,node2:TreeNode){
        return node1[this._fields.id] == node2[this._fields.id]
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
    isValidNode(node:any):boolean{
        if(!node) return false
        if(typeof(node)!=='object') return false
        if(Object.keys(node).some(k=>!(k in this._fields))) return false
        if(!node[this._fields.id]) return false 
        if(!(typeof(node[this._fields.leftValue])=='number' && node[this._fields.leftValue]>=1)) return false 
        if(!(typeof(node[this._fields.rightValue])=='number' && node[this._fields.rightValue]>=1)) return false
        if(node[this._fields.leftValue]>=node[this._fields.rightValue]) return false
        if(!(typeof(node.level)=='number' || node.level>=0)) return false
        return true
    }

    /**
     * 获取两个节点之间的关系。
     * 
     * @param {Node} srcNode - 第一个节点。
     * @param {Node} targetNode - 第二个节点。
     * @returns {string} 返回两个节点之间的关系。可能的值包括 "Parent"、"Child"、"Sibling"、"Ancestor"、"Descendant" 或 "Unrelated"。
     * 
     * @example
     * const relation = getNodeRelation(node1, node2);
     * console.log(relation);  // 输出: FlexTreeNodeRelation.Child
     */
    async getNodeRelation(srcNode:NodeId | TreeNode,targetNode:NodeId | TreeNode):Promise<FlexTreeNodeRelation>{
        const node = this.isValidNode(srcNode) ? srcNode as TreeNode: (await this.getNode(srcNode as NodeId)) as TreeNode
        const relNode = this.isValidNode(targetNode) ? targetNode as TreeNode : (await this.getNode(targetNode as NodeId)) as TreeNode


        let result: FlexTreeNodeRelation = FlexTreeNodeRelation.Unknow

        const nodeId = node[this._fields.id]
        const relNodeId = relNode[this._fields.id]
        
        const leftValue = node[this._fields.leftValue]
        const rightValue = node[this._fields.rightValue]
        const level = node[this._fields.level]

        const relLeftValue = relNode[this._fields.leftValue]
        const relRightValue = relNode[this._fields.rightValue]
        const relLevel = relNode[this._fields.level]

        if(this.isSameTree(node,relNode)){
            if(this.isSameNode(node ,relNode)){ 
                result = FlexTreeNodeRelation.Self          // 两个节点相等
            }else if (leftValue > relLeftValue && rightValue < relRightValue && level == relLevel +1 ) {
                result = FlexTreeNodeRelation.Child;        // 一个节点是另一个节点的子节点
            } else if (leftValue > relLeftValue && rightValue < relRightValue) {
                result = FlexTreeNodeRelation.Descendants;  // 一个节点是另一个节点的后代
            } else if (leftValue < relLeftValue && rightValue > relRightValue && level == relLevel - 1) {
                result = FlexTreeNodeRelation.Parent;       // 一个节点是另一个节点的父节点
            } else if (leftValue < relLeftValue && rightValue > relRightValue) {
                result = FlexTreeNodeRelation.Ancestors;   // 一个节点是另一个节点的祖先
            }else{                  
                const sql = this._sql(`SELECT 
                CASE 
                    WHEN t1.${this._fields.id}  = t2.${this._fields.id}  THEN 1 ELSE 0
                END as isSiblings
                FROM 
                    ( SELECT Node.* FROM  ${this._tableName} Node
                        JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id} = ${nodeId}
                        WHERE ( {__TREE_ID__}
                        Node.${this._fields.leftValue} < RelNode.${this._fields.leftValue}
                        AND Node.${this._fields.rightValue} > RelNode.${this._fields.rightValue}
                        ) ORDER BY ${this._fields.leftValue} DESC LIMIT 1
                    ) AS t1,
                    ( SELECT Node.* FROM  ${this._tableName} Node
                        JOIN ${this._tableName} RelNode ON RelNode.${this._fields.id}  = ${relNodeId}
                        WHERE ( {__TREE_ID__}
                        Node.${this._fields.leftValue} < RelNode.${this._fields.leftValue}
                        AND Node.${this._fields.rightValue} > RelNode.${this._fields.rightValue}
                        ) ORDER BY ${this._fields.leftValue} DESC LIMIT 1
                    ) AS t2`)
                const r = await this.onGetScalar(sql)   // 两个节点在同一棵树中
                if(r == 1){
                    result = FlexTreeNodeRelation.Siblings;     // 两个节点是兄弟节点
                }else if(level == relLevel) {
                    result = FlexTreeNodeRelation.SameLevel;    // 两个节点是同级节点            
                }else{
                    result = FlexTreeNodeRelation.SameTree;    // 
                }
            } 
        }else{
            result = FlexTreeNodeRelation.DiffTree          // 两个节点在不同的树中
        }
        return result
    }

}

 