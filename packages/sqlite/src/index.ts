import type { FlexTreeManager, IFlexTreeAdapter } from "flextree";
import type { Database } from "better-sqlite3";

export type SqliteDatabase = Database;
export default class SqliteAdapter implements IFlexTreeAdapter {
  _db: SqliteDatabase;
  _connected: boolean = true;
  _treeManager?: FlexTreeManager;
  type = "sqlite" as const;

  /**
   * 构造一个 SqliteAdapter。
   *
   * 数据库实例由调用方自行创建并传入，其生命周期（open/close）亦由调用方管理。
   * 本适配器不再自行创建 Database，因此 `better-sqlite3` 仅作为 peerDependency，
   * 安装本包时不会触发原生模块的编译。
   *
   * @param db 已创建的 better-sqlite3 Database 实例
   */
  constructor(db: SqliteDatabase) {
    this._db = db;
    this._connected = !!db;
  }

  get connected() {
    return this._connected;
  }
  get db(): SqliteDatabase {
    return this._db;
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

  /**
   * 数据库实例由外部传入并管理其生命周期，此处仅校验连接状态以实现 IFlexTreeAdapter。
   */
  open(): Promise<SqliteDatabase> {
    this._connected = !!this._db;
    return Promise.resolve(this._db);
  }

  assertDbIsOpen() {
    if (!this._db) {
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
   *
   * 原子性由外层 transaction 保证。exec 本身只负责顺序执行。
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

  private _inTransaction = false;
  /**
   * 在数据库事务中执行异步回调。
   *
   * 用显式 BEGIN/COMMIT/ROLLBACK 包裹 callback：原子提交，抛错整体回滚。通过 await callback
   * 等待异步操作，async exec 的错误经 Promise 链正确触发 ROLLBACK。嵌套调用时复用外层事务。
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
