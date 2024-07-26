import type { FlexTreeManager, IDatabaseDriver } from 'flextree'
import Database from 'better-sqlite3'

export default class SqliteDriver implements IDatabaseDriver {
    _db?: Database.Database
    _options: Database.Options
    _ready: boolean = false
    _filename?: string
    _treeManager?: FlexTreeManager
    constructor(filename?: string, options?: Database.Options) {
        this._options = Object.assign({}, options)
        this._filename = filename || ':memory:'
    }

    get ready() { return this._ready }
    get db() { return this._db! }
    get treeManager() { return this._treeManager! }
    get tableName() { return this.treeManager.tableName }
    bind(treeManager: FlexTreeManager) {
        this._treeManager = treeManager
    }

    open(options?: Database.Options) {
        return new Promise((resolve, reject) => {
            try {
                this._db = new Database(this._filename, Object.assign({}, this._options, options))
                this._ready = true
                resolve(this._db)
            } catch (e: any) {
                this._ready = false
                reject(e)
            }
        })
    }

    assertDbIsOpen() {
        if (!this.db) {
            throw new Error('Sqlite database is not opened.')
        }
    }

    async getRows<T>(sql: string): Promise<T[]> {
        this.assertDbIsOpen()
        return await this.db.prepare<unknown[], T>(sql).all()
    }

    async getScalar<T>(sql: string): Promise<T> {
        this.assertDbIsOpen()
        return await this.db.prepare(sql).pluck().get() as T
    }

    async exec(sqls: string | string[]) {
        this.assertDbIsOpen()
        if (typeof sqls === 'string') {
            sqls = [sqls]
        }
        const stmts = sqls.map(sql => this.db.prepare(sql))
        const trans = this.db.transaction(() => {
            for (const stmt of stmts) {
                stmt.run()
            }
        })
        trans()
    }
}
