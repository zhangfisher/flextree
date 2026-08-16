/**
 * sql.js 类型声明（最小面，与 packages/sqljs/src/sql-js.d.ts 保持一致）
 */
declare module "sql.js" {
  export interface Statement {
    step(): boolean
    getAsObject(params?: Record<string, any>): Record<string, any>
    free(): boolean
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null)
    exec(sql: string): QueryExecResult[]
    prepare(sql: string): Statement
    export(): Uint8Array
    close(): void
  }

  export interface QueryExecResult {
    columns: string[]
    values: any[][]
  }

  export interface SqlJsStatic {
    Database: typeof Database
  }

  export interface SqlJsConfig {
    locateFile?: (file: string) => string
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
}
