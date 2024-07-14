import sqlString from "sqlstring"
 
export function escapeSqlString(value:any){
   return sqlString.escape(value)
}