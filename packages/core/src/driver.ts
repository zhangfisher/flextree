/**
 * 提供访问数据库的接口
 */


export interface IDatabaseDriver{
    onRead(sql:string):Promise<any[]>
    onWrite(sqls:string[]):Promise<any>
    ready:boolean               // 当数据库打开准备就绪时 
    open(config?:any):Promise<any>
}
