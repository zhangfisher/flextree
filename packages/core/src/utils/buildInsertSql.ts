 import sqlString from "sqlString"

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
 *  
 * @returns 
 */
export function buildInsertSql(tableName:string,record:Record<string,any>){ 
    const keys = Object.keys(record).map(key=>sqlString.escapeId(key)).join(",")
    const values = Object.values(record).join(",") 
    return `INSERT INTO ${tableName} (${keys}) VALUES (${values})`
}