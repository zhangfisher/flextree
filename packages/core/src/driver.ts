/**
 * 提供访问数据库的接口
 */

import { type FlexTreeManager } from "./manager"


export interface IDatabaseDriver{
    // 当数据库打开准备就绪时 
    ready:boolean             
    // 绑定树管理器
    bind(treeManager:FlexTreeManager):void
    // 执行sql，并返回结果
    exec<T=any>(sqls: string | string[]):Promise<void>    
    // 执行查询并返回结果
    getRows(sql:string):Promise<any[]>
    // 执行查询并返回标量
    getScalar<T=number>(sql:string):Promise<T> 
    delete(sql:string):Promise<any>    
    open(config?:any):Promise<any>
    // 返回一个数据库实例对象
    db:any
}
