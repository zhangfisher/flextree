import type { Database as SqlJsDatabase, Statement } from "sql.js";
import type { FlexTreeManager, IFlexTreeAdapter } from "flextree";
import { FlexTreeSqljsPersistError } from "./errors";

export type SqljsDatabase = SqlJsDatabase;
export { FlexTreeSqljsPersistError };

/**
 * 适配器配置
 */
export interface FlexTreeSqljsAdapterOptions {
  /**
   * 持久化钩子：仅在有写操作的事务成功 COMMIT 后被 await 触发。
   *
   * sql.js 是纯内存数据库，写入不会自动落盘。此钩子给调用方一个统一的持久化时机：
   * 何时导出（db.export()）、导出到哪（localStorage/IndexedDB/下载）完全由调用方决定。
   * 钩子抛错时事务已提交，错误包装为 FlexTreeSqljsPersistError 向上传播。
   */
  onPersist?: (db: SqlJsDatabase) => void | Promise<void>;
}

export default class FlexTreeSqljsAdapter implements IFlexTreeAdapter {
  _db: SqlJsDatabase;
  _connected: boolean;
  _treeManager?: FlexTreeManager;
  type = "sqlite" as const;
  private _options: FlexTreeSqljsAdapterOptions;
  private _inTransaction = false;
  private _txDirty = false; // 当前事务内是否发生过写操作（exec 被调用过）

  /**
   * 构造一个 FlexTreeSqljsAdapter。
   *
   * 数据库实例由调用方自行初始化并传入（注入实例模式）：sql.js 的初始化是异步的
   * （initSqlJs 需先加载 wasm），且 locateFile 的正确写法因 bundler 而异，
   * 这些环境相关细节不归适配器管。生命周期（close）亦由调用方管理。
   *
   * @param db 已初始化的 sql.js Database 实例
   * @param options 适配器配置，见 FlexTreeSqljsAdapterOptions
   */
  constructor(db: SqlJsDatabase, options: FlexTreeSqljsAdapterOptions = {}) {
    this._db = db;
    this._connected = !!db;
    this._options = options;
  }

  get connected() {
    return this._connected;
  }
  get db(): SqlJsDatabase {
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
  open(): Promise<SqlJsDatabase> {
    this._connected = !!this._db;
    return Promise.resolve(this._db);
  }

  assertDbIsOpen() {
    if (!this._db) {
      throw new Error("Sql.js database is not opened.");
    }
  }

  /**
   * 执行查询并把 sql.js 的 [columns, values] 二维数组转为「列名 → 对象」行数组。
   */
  private _queryObjects(sql: string): Record<string, any>[] {
    const stmt: Statement = this.db.prepare(sql);
    try {
      const rows: Record<string, any>[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      return rows;
    } finally {
      stmt.free();
    }
  }

  async getRows<T>(sql: string): Promise<T[]> {
    this.assertDbIsOpen();
    return this._queryObjects(sql) as T[];
  }

  async getScalar<T>(sql: string): Promise<T> {
    this.assertDbIsOpen();
    const rows = this._queryObjects(sql);
    if (rows.length === 0) {
      throw new Error("No scalar value found");
    }
    return Object.values(rows[0])[0] as T;
  }

  /**
   * 执行多条 SQL（不自带事务）。
   *
   * 原子性由外层 transaction 保证。exec 本身只负责顺序执行，并标记当前事务为「有写操作」。
   */
  async exec(sqls: string | string[]): Promise<void> {
    this.assertDbIsOpen();
    if (typeof sqls === "string") {
      sqls = [sqls];
    }
    for (const sql of sqls) {
      this.db.exec(sql);
    }
    this._txDirty = true;
  }

  /**
   * 在数据库事务中执行异步回调。
   *
   * 用显式 BEGIN/COMMIT/ROLLBACK 包裹 callback：原子提交，抛错整体回滚。嵌套调用时复用外层事务。
   *
   * 持久化：仅当事务内有写操作（exec 被调用过）且成功 COMMIT 后，await onPersist(db)——
   * ROLLBACK 与纯读事务不触发。钩子在事务状态完全结束（_inTransaction 已复位）后执行：
   * 其失败是对已提交数据的快照失败，不触发 ROLLBACK，直接以 FlexTreeSqljsPersistError 上抛。
   */
  async transaction(callback: () => Promise<void>): Promise<void> {
    this.assertDbIsOpen();
    if (this._inTransaction) {
      await callback();
      return;
    }
    this._inTransaction = true;
    this._txDirty = false; // 事务外的 exec（如建表）不参与本事务的脏判定
    this.db.exec("BEGIN");
    let dirty = false;
    try {
      await callback();
      this.db.exec("COMMIT");
      dirty = this._txDirty;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      this._txDirty = false;
      this._inTransaction = false;
    }
    if (dirty) {
      await this._persist();
    }
  }

  private async _persist(): Promise<void> {
    if (!this._options.onPersist) {
      return;
    }
    try {
      await this._options.onPersist(this.db);
    } catch (e) {
      throw new FlexTreeSqljsPersistError(e);
    }
  }
}
