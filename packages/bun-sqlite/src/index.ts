import type { FlexTreeManager, IFlexTreeAdapter } from "flextree";
import { Database } from "bun:sqlite";

export type BunSqliteDatabase = Database;
export default class BunSqliteAdapter implements IFlexTreeAdapter {
  _db?: BunSqliteDatabase;
  _connected: boolean = false;
  _treeManager?: FlexTreeManager;
  type = "sqlite" as const;
  private _externalDb: boolean = false; // 标记是否使用外部传入的数据库
  private _dbPath?: string; // 数据库文件路径

  constructor(db?: Database | string) {
    if (typeof db === "string") {
      // 传入的是数据库文件路径
      this._dbPath = db;
      this._connected = false;
    } else if (db instanceof Database) {
      // 传入的是已有的 Database 对象
      this._db = db;
      this._externalDb = true;
      this._connected = this._isDatabaseOpen();
    }
  }

  get connected() {
    return this._connected;
  }
  get db() {
    return this._db! as BunSqliteDatabase;
  }
  get treeManager() {
    return this._treeManager!;
  }
  get tableName() {
    return this.treeManager.tableName;
  }

  private _isDatabaseOpen() {
    if (this._db) {
      try {
        // 执行一个无害的查询
        this._db.query("SELECT 1").get();
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  bind(treeManager: FlexTreeManager) {
    this._treeManager = treeManager;
  }

  open() {
    return new Promise((resolve, reject) => {
      try {
        // 如果已经通过外部传入数据库，则不需要再次打开
        if (this._externalDb && this._db) {
          this._connected = true;
          resolve(this._db);
          return;
        }

        // 如果指定了数据库路径，则创建真实数据库文件
        if (this._dbPath) {
          this._db = new Database(this._dbPath);
        } else {
          // 默认使用内存数据库
          this._db = new Database(":memory:");
        }

        this._connected = true;
        resolve(this._db);
      } catch (e: any) {
        this._connected = false;
        reject(e);
      }
    });
  }

  async getRows<T>(sql: string): Promise<T[]> {
    const stmt = this.db.query(sql);
    return stmt.all() as T[];
  }

  async getScalar<T>(sql: string): Promise<T> {
    const stmt = this.db.query(sql);
    const result = stmt.get();
    if (!result) {
      throw new Error("No scalar value found");
    }
    // 获取第一列的值
    return Object.values(result)[0] as T;
  }

  /**
   * 执行多条 SQL（不自带事务）。
   *
   * 原子性由外层 transaction 保证：独立调用时由 onExecuteSql 的 transaction 包裹，
   * write(fn) 内由 write 的 transaction 包裹。exec 本身只负责顺序执行。
   */
  async exec(sqls: string | string[]) {
    if (typeof sqls === "string") {
      sqls = [sqls];
    }
    for (const sql of sqls) {
      this.db.run(sql);
    }
  }
  private _inTransaction = false;
  /**
   * 在数据库事务中执行异步回调。
   *
   * 用显式 BEGIN/COMMIT/ROLLBACK 包裹 callback：原子提交，抛错整体回滚。通过 await callback
   * 等待异步操作完成，故 async exec 的错误能经 Promise 链正确触发 ROLLBACK（不依赖同步 throw）。
   * 嵌套调用（事务内再开事务）时直接复用外层事务，不重复 BEGIN。
   */
  async transaction(callback: () => Promise<void>): Promise<void> {
    if (this._inTransaction) {
      await callback();
      return;
    }
    this._inTransaction = true;
    this.db.run("BEGIN");
    try {
      await callback();
      this.db.run("COMMIT");
    } catch (e) {
      this.db.run("ROLLBACK");
      throw e;
    } finally {
      this._inTransaction = false;
    }
  }
}
