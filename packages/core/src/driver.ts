/**
 * 提供访问数据库的接口
 */


export interface IDatabaseDriver{
    ready:boolean               // 当数据库打开准备就绪时 
    exec(sql:string):Promise<{lastId?:any,changes?:number}>    
    getRows(sql:string):Promise<any[]>
    insert(sqls:string[]):Promise<any>
    insert(sqls:string[]):Promise<any>
    delete(sql:string):Promise<any>    
    open(config?:any):Promise<any>
}
