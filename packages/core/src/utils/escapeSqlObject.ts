import sqlString from "sqlstring"
 
export function escapeSqlObject(record:Record<string,any>){ 
   Object.entries(record).forEach(([key,value])=>{
      let v = typeof(value)=='number' ? value: sqlString.escape(value)
      record[key] = v
   })  
   return record
}