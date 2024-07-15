
import { IDatabaseDriver } from "flextree"
import sqlite3 from "sqlite3"
import {open,Database, ISqlite} from "sqlite"


export default class SqliteDriver implements IDatabaseDriver{
    db?:Database
    config:ISqlite.Config
    _ready:boolean = false
    constructor(config?:ISqlite.Config){
        this.config = Object.assign({ 
            filename: ":memory:",
            driver: sqlite3.Database   
        },config) 
    } 
    get ready(){return this._ready}
    open(config?:ISqlite.Config){
        return new Promise((resolve,reject)=>{
            open(Object.assign({},this.config,config)).then((db:Database)=>{
                this.db = db
                this._ready = true
                resolve(db)
            }).catch(e=>{
                this._ready = false
                reject(e)
            })
        })
    }
    assertDbIsOpen(){
        if(!this.db)  throw new Error('Sqlite database is not opened.')
    }
    async onRead(sql: string): Promise<any[]> {
        this.assertDbIsOpen()
        return await this.db!.all(sql)
    }
    async onWrite(sqls: string[]): Promise<any> {
        this.assertDbIsOpen()
        return await this.db!.run(sqls.join(';'))
    }
    
}



