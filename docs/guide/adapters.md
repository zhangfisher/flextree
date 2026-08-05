# 适配器

`FlexTree`本质上就是将对树的查询、删除、移动、更新等操作转换为`SQL`，然后交给数据库引擎去执行。所以`FlexTree`是一个抽象的树存储库，它并不直接操作数据库，而是通过数据库适配器来操作数据库。

## 适配器接口

当用户调用`FlexTree`的API后，会调用数据库适配器的方法来操作数据库。数据库适配器是一个实现了`IFlexTreeAdapter`接口的对象，它负责执行`SQL`语句并返回结果。

`IFlexTreeAdapter`接口定义如下：

```ts
interface IFlexTreeAdapter {
  // 当数据库是否已连接
  connected: boolean;
  // 绑定树管理器
  bind: (treeManager: manager.FlexTreeManager) => void;
  // 执行sql，并返回结果
  exec: (sqls: string | string[]) => Promise<void>;
  // 执行查询并返回结果
  getRows: (sql: string) => Promise<any[]>;
  // 执行查询并返回标量
  getScalar: <T = number>(sql: string) => Promise<T>;
  open: (config?: any) => Promise<any>;
  // 在数据库事务中执行异步回调：原子提交，回调抛错则整体回滚（支持 async）
  transaction: (callback: () => Promise<void>) => Promise<void>;
  // 数据库类型，取值: "sqlite" | "mysql" | "postgresql" | "oracle" | "sqlserver"，默认 postgresql
  type?: DatabaseType;
}
```

### connected

当数据库适配器连接就绪时，`connected`属性为`true`，否则为`false`。

### bind

`bind`方法用于绑定树管理器，当`FlexTree`创建时，会调用`bind`方法将树管理器绑定到适配器上。

### exec

执行`SQL`语句，`exec`方法接收一个`SQL`语句或`SQL`语句数组，然后执行`SQL`语句。

### getRows

执行查询并返回结果集，`getRows`方法接收一个`SQL`语句，然后执行查询并返回结果集。

### getScalar

执行查询并返回标量，`getScalar`方法接收一个`SQL`语句，然后执行查询并返回标量。

### open

当`FlexTree`初始化时，如果`connected=true`，则会调用`open`方法打开数据库连接。

### transaction

在数据库事务中执行回调函数。`FlexTreeManager`在执行写操作（`write`）时，会用此方法将整批更新包裹在一个事务中，以保证原子性——任一语句失败则整体回滚。适配器需自行处理嵌套调用（事务内再开事务时复用外层事务，不重复开启）。

### type

声明适配器所连接的数据库类型，取值为`"sqlite"`、`"mysql"`、`"postgresql"`、`"oracle"`、`"sqlserver"`之一，未指定时默认`postgresql`。`FlexTree`会据此选择对应的 SQL 方言，进行标识符转义等差异化处理。

## 适配器实现示例

以下是`flextree-sqlite-adapter`的实现代码。

```ts
import type { FlexTreeManager, IFlexTreeAdapter } from "flextree";
import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;
export default class SqliteAdapter implements IFlexTreeAdapter {
  _db?: SqliteDatabase;
  _options: Database.Options;
  _filename?: string;
  _treeManager?: FlexTreeManager;
  type = "sqlite" as const;
  private _inTransaction = false;

  constructor(filename?: string, options?: Database.Options) {
    this._options = Object.assign({}, options);
    this._filename = filename || ":memory:";
  }

  get connected() {
    return !!this._db;
  }
  get db() {
    return this._db! as SqliteDatabase;
  }
  get treeManager() {
    return this._treeManager!;
  }
  get tableName() {
    return this.treeManager.tableName;
  }

  bind(treeManager: FlexTreeManager) {
    this._treeManager = treeManager;
  }

  open(options?: Database.Options) {
    return new Promise((resolve, reject) => {
      try {
        this._db = new Database(this._filename, Object.assign({}, this._options, options));
        resolve(this._db);
      } catch (e: any) {
        reject(e);
      }
    });
  }

  assertDbIsOpen() {
    if (!this.db) {
      throw new Error("Sqlite database is not opened.");
    }
  }

  async getRows<T>(sql: string): Promise<T[]> {
    this.assertDbIsOpen();
    return await this.db.prepare<unknown[], T>(sql).all();
  }

  async getScalar<T>(sql: string): Promise<T> {
    this.assertDbIsOpen();
    return (await this.db.prepare(sql).pluck().get()) as T;
  }

  /**
   * 执行多条 SQL（不自带事务）。
   * 原子性由外层 transaction 保证，exec 本身只负责顺序执行。
   */
  async exec(sqls: string | string[]): Promise<void> {
    this.assertDbIsOpen();
    if (typeof sqls === "string") {
      sqls = [sqls];
    }
    for (const sql of sqls) {
      this.db.exec(sql);
    }
  }

  /**
   * 在数据库事务中执行异步回调。
   * 用显式 BEGIN/COMMIT/ROLLBACK 包裹 callback：原子提交，抛错整体回滚。
   * 嵌套调用（事务内再开事务）时复用外层事务，不重复开启。
   */
  async transaction(callback: () => Promise<void>): Promise<void> {
    this.assertDbIsOpen();
    if (this._inTransaction) {
      await callback();
      return;
    }
    this._inTransaction = true;
    this.db.exec("BEGIN");
    try {
      await callback();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      this._inTransaction = false;
    }
  }
}
```
