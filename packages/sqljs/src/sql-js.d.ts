/**
 * sql.js 类型声明（最小面）
 *
 * sql.js 官方包未自带类型，@types/sql.js 已停更且与 1.x 运行时有出入。
 * 此处只声明适配器实际使用的 API，避免引入过时第三方类型。
 */
declare module "sql.js" {
  /** 预编译 SQL 语句 */
  export interface Statement {
    /** 执行一步，返回是否还有数据行 */
    step(): boolean
    /** 以「列名 → 值」对象返回当前行 */
    getAsObject(params?: Record<string, any>): Record<string, any>
    /** 释放语句底层内存 */
    free(): boolean
  }

  /** sql.js 数据库实例（wasm SQLite） */
  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null)
    /** 执行单条/多条 SQL，返回查询结果集（不用于参数化查询） */
    exec(sql: string): QueryExecResult[]
    /** 预编译 SQL 语句 */
    prepare(sql: string): Statement
    /** 导出整库快照 */
    export(): Uint8Array
    /** 关闭数据库并释放 wasm 内存 */
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

  /** 初始化入口：加载 wasm 后解析为 SqlJsStatic */
  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>
}
