# 适配器

 `FlexTree`本质上就是将对树的查询、删除、移动、更新等操作转换为`SQL`，然后交给数据库引擎去执行。所以`FlexTree`是一个抽象的树存储库，它并不直接操作数据库，而是通过数据库适配器来操作数据库。

## 适配器接口

当用户调用`FlexTree`的API后，会调用数据库适配器的方法来操作数据库。数据库适配器是一个实现了`IFlexTreeAdapter`接口的对象，它负责执行`SQL`语句并返回结果。

`IFlexTreeAdapter`接口定义如下：

```ts
interface IFlexTreeAdapter {
    // 当数据库打开准备就绪时
    ready: boolean
    // 绑定树管理器
    bind: (treeManager: manager.FlexTreeManager) => void
    // 执行sql，并返回结果
    exec: (sqls: string | string[]) => Promise<void>
    // 执行查询并返回结果
    getRows: (sql: string) => Promise<any[]>
    // 执行查询并返回标量
    getScalar: <T = number>(sql: string) => Promise<T>
    open: (config?: any) => Promise<any>
    // 返回一个数据库实例对象
    db: any
}
```


### ready

当数据库适配器准备就绪时，`ready`属性为`true`，否则为`false`。

### bind

`bind`方法用于绑定树管理器，当`FlexTree`创建时，会调用`bind`方法将树管理器绑定到适配器上。

### exec

执行`SQL`语句，`exec`方法接收一个`SQL`语句或`SQL`语句数组，然后执行`SQL`语句。

### getRows

执行查询并返回结果集，`getRows`方法接收一个`SQL`语句，然后执行查询并返回结果集。

### getScalar

执行查询并返回标量，`getScalar`方法接收一个`SQL`语句，然后执行查询并返回标量。


### open

当`FlexTree`初始化时，会调用`open`方法打开数据库连接。

### db

返回一个数据库实例对象，仅仅在测试中使用。


## 适配器实现示例

以下是`flextree-sqlite-adapter`的实现代码。


```ts
import type { FlexTreeManager, IFlexTreeAdapter } from 'flextree'
import Database from 'better-sqlite3' 

export type SqliteDatabase = Database.Database
export default class SqliteAdapter implements IFlexTreeAdapter {
    _db?: SqliteDatabase
    _options: Database.Options
    _ready: boolean = false
    _filename?: string
    _treeManager?: FlexTreeManager
    constructor(filename?: string, options?: Database.Options) {
        this._options = Object.assign({}, options)
        this._filename = filename || ':memory:'
    }

    get ready() { return this._ready }
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

```


