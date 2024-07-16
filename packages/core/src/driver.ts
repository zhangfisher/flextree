/**
 * 提供访问数据库的接口
 */


export interface IDatabaseDriver{
    exec(sql:string):Promise<{lastId?:any,changes?:number}>
    getRows(sql:string):Promise<any[]>
    update(sqls:string[]):Promise<any>
    ready:boolean               // 当数据库打开准备就绪时 
    open(config?:any):Promise<any>
}
