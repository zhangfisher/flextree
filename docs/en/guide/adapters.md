# Adapter

 `FlexTree` is essentially an abstract tree storage repository that converts operations such as querying, deleting, moving, and updating the tree into `SQL` and then hands them off to the database engine to execute. Therefore `FlexTree` does not operate on the database directly — it does so through a database adapter.

## Adapter Interface

When the user invokes a `FlexTree` API, the database adapter's methods are called to operate the database. The database adapter is an object that implements the `IFlexTreeAdapter` interface; it is responsible for executing `SQL` statements and returning results.

The `IFlexTreeAdapter` interface is defined as follows:

```ts
interface IFlexTreeAdapter {
    // Whether the database is connected
    connected: boolean
    // Bind the tree manager
    bind: (treeManager: manager.FlexTreeManager) => void
    // Execute SQL and return the result
    exec: (sqls: string | string[]) => Promise<void>
    // Execute a query and return the result set
    getRows: (sql: string) => Promise<any[]>
    // Execute a query and return a scalar
    getScalar: <T = number>(sql: string) => Promise<T>
    open: (config?: any) => Promise<any>
    // Execute an async callback inside a database transaction: atomic commit, full rollback on error (supports async)
    transaction: (callback: () => Promise<void>) => Promise<void>
    // Database type, one of: "sqlite" | "mysql" | "postgresql" | "oracle" | "sqlserver"; defaults to postgresql
    type?: DatabaseType
}
```


### connected

When the database adapter is connected and ready, the `connected` property is `true`; otherwise it is `false`.

### bind

The `bind` method is used to bind the tree manager. When a `FlexTree` is created, the `bind` method is called to bind the tree manager to the adapter.

### exec

Executes `SQL` statements. The `exec` method accepts a single `SQL` statement or an array of `SQL` statements, and then executes them.

### getRows

Executes a query and returns the result set. The `getRows` method takes a `SQL` statement, runs the query, and returns the result set.

### getScalar

Executes a query and returns a scalar. The `getScalar` method takes a `SQL` statement, runs the query, and returns a scalar value.


### open

When `FlexTree` is initialized, the `open` method is called to open the database connection.

### transaction

Executes a callback function inside a database transaction. When `FlexTreeManager` performs a write operation (`write`), it uses this method to wrap the entire batch of updates in one transaction to guarantee atomicity — if any statement fails, the whole batch rolls back. The adapter must handle nested calls itself (when a transaction is opened inside another transaction, it reuses the outer transaction instead of starting a new one).

### type

Declares the type of database the adapter connects to. The value is one of `"sqlite"`, `"mysql"`, `"postgresql"`, `"oracle"`, or `"sqlserver"`; when not specified it defaults to `postgresql`. `FlexTree` uses this to pick the corresponding SQL dialect and to perform differentiated handling such as identifier escaping.


## Adapter Implementation Example

The following is the implementation of `flextree-sqlite-adapter`.


```ts
import type { FlexTreeManager, IFlexTreeAdapter } from 'flextree'
import Database from 'better-sqlite3' 

export type SqliteDatabase = Database.Database
export default class SqliteAdapter implements IFlexTreeAdapter {
    _db?: SqliteDatabase
    _options: Database.Options
    _filename?: string
    _treeManager?: FlexTreeManager
    type = 'sqlite' as const
    private _inTransaction = false

    constructor(filename?: string, options?: Database.Options) {
        this._options = Object.assign({}, options)
        this._filename = filename || ':memory:'
    }

    get connected() { return !!this._db }
    get db() { return this._db! as SqliteDatabase }
    get treeManager() { return this._treeManager! }
    get tableName() { return this.treeManager.tableName }

    bind(treeManager: FlexTreeManager) {
        this._treeManager = treeManager
    }

    open(options?: Database.Options) {
        return new Promise((resolve, reject) => {
            try {
                this._db = new Database(this._filename, Object.assign({}, this._options, options))
                resolve(this._db)
            } catch (e: any) {
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

    /**
     * Execute multiple SQL statements (with no transaction of its own).
     * Atomicity is guaranteed by the outer transaction; exec itself only runs them in order.
     */
    async exec(sqls: string | string[]): Promise<void> {
        this.assertDbIsOpen()
        if (typeof sqls === 'string') {
            sqls = [sqls]
        }
        for (const sql of sqls) {
            this.db.exec(sql)
        }
    }

    /**
     * Execute an async callback inside a database transaction.
     * Wraps the callback with explicit BEGIN/COMMIT/ROLLBACK: atomic commit, full rollback on error.
     * Nested calls (a transaction opened inside another) reuse the outer transaction.
     */
    async transaction(callback: () => Promise<void>): Promise<void> {
        this.assertDbIsOpen()
        if (this._inTransaction) {
            await callback()
            return
        }
        this._inTransaction = true
        this.db.exec('BEGIN')
        try {
            await callback()
            this.db.exec('COMMIT')
        } catch (e) {
            this.db.exec('ROLLBACK')
            throw e
        } finally {
            this._inTransaction = false
        }
    }
}

```

