import type { FlexTreeManager, IFlexTreeAdapter } from "flextree";
import { Database } from "bun:sqlite";

export type BunSqliteDatabase = Database;
export default class BunSqliteAdapter implements IFlexTreeAdapter {
  _db?: BunSqliteDatabase;
  _ready: boolean = false;
  _treeManager?: FlexTreeManager;
  type = "sqlite" as const;
  private _externalDb: boolean = false; // 标记是否使用外部传入的数据库
  private _dbPath?: string; // 数据库文件路径

  constructor(db?: Database | string) {
    if (typeof db === 'string') {
      // 传入的是数据库文件路径
      this._dbPath = db;
      this._ready = false;
    } else if (db instanceof Database) {
      // 传入的是已有的 Database 对象
      this._db = db;
      this._externalDb = true;
      this._ready = this._isDatabaseOpen();
    }
  }

  get ready() {
    return this._ready;
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
          this._ready = true;
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

        this._ready = true;
        resolve(this._db);
      } catch (e: any) {
        this._ready = false;
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
    const stmt = this.db.query(sql);
    return stmt.all() as T[];
  }

  async getScalar<T>(sql: string): Promise<T> {
    this.assertDbIsOpen();
    const stmt = this.db.query(sql);
    const result = stmt.get();
    if (!result) {
      throw new Error("No scalar value found");
    }
    // 获取第一列的值
    return Object.values(result)[0] as T;
  }

  async exec(sqls: string | string[]) {
    this.assertDbIsOpen();
    if (typeof sqls === "string") {
      sqls = [sqls];
    }
    // Bun SQLite 默认在事务中执行，这里使用手动事务
    this.db.transaction(() => {
      for (const sql of sqls) {
        this.db.run(sql);
      }
    })();
  }
}
