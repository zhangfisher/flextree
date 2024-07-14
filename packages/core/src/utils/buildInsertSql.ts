

import { FlexTreeManagerOptions } from "../manager";
import { NonUndefined } from "../types";
import sqlString from "sqlstring"


/**
 * 构建立即插入的sql语句
 * 
 * buildInsertIntoSql('tbl',{id:1,name:'test',age:20})
 * 
 * INSERT INTO test2 (id,name,age)
 * VALUES ('test',20)
 * ON CONFLICT(id) 
 * DO UPDATE SET id = 1, name='test', age=20
 * 
 * 
 * @param record 
 * @param tableName 
 * @options 
 *  - fieldNames: 字段名称
 *  - treeId: 树的id字段名称
 *  - upsert: 是否只插入，= true 时，不会更新已有的数据  
 *  - conflict: 冲突字段，默认为 id
 *  
 * @returns 
 */
export function buildInsertSql(tableName:string,record:Record<string,any>,options:{
    upsert?:boolean,
    conflict?:string[],
    fieldNames: Required<NonUndefined<FlexTreeManagerOptions['fields']>>,
    treeId?:string}
){
    const { fieldNames,treeId,upsert } =Object.assign({
        upsert:false,
    },options)
    const conflict = (options.conflict ||  [fieldNames.id]).map(f=>sqlString.escapeId(f)).join(',')
    const keys = []  
    const values = []  
    let setValues = Object.entries(record).map(([key,value])=>{
        const k = sqlString.escapeId(key)
        const v = sqlString.escape(value)
        keys.push(k)
        values.push(v)
        return `${k}=${v}`
    }).join(',')

    if(treeId){
        const treeKey = sqlString.escapeId(fieldNames.treeId)
        const treeValue = sqlString.escape(treeId)
        keys.push(treeKey)
        values.push(treeValue)
        setValues += `,${treeKey}=${treeValue}`
    }
    const sql = `INSERT INTO ${tableName} (${keys.join(',')})
        VALUES (${values.join(',')})
        ${upsert ?  `ON CONFLICT(${conflict})  DO UPDATE SET ${setValues}` : ''}
    `
    return sql
}