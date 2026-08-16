/**
 * sql.js 数据库初始化与快照持久化。
 *
 * 适配器采用注入实例契约（见 docs/adr/0003）：wasm 加载、Database 创建
 * 与快照恢复都在此处完成，适配器只接收现成实例。
 */
import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const STORAGE_KEY = "flextree-sqljs-example";

export const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS tree (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(200),
      kind VARCHAR(20) DEFAULT 'folder',
      treeId INTEGER,
      level INTEGER,
      leftValue INTEGER,
      rightValue INTEGER
  );
`;

/**
 * 初始化数据库：加载 wasm，若有历史快照则从快照恢复。
 */
export async function openDatabase(): Promise<Database> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const bytes = Uint8Array.from(JSON.parse(saved) as number[]);
      return new SQL.Database(bytes);
    } catch {
      // 快照损坏则全新开始
    }
  }
  const db = new SQL.Database();
  db.exec(CREATE_TABLE);
  return db;
}

/**
 * onPersist 钩子：整库导出快照写入 localStorage。
 * 适配器只保证「写事务 COMMIT 后调用」，怎么存由应用决定。
 */
export function persistToLocalStorage(db: Database) {
  const bytes = db.export();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(bytes)));
}

/** 清空快照（重置演示用） */
export function clearSnapshot() {
  localStorage.removeItem(STORAGE_KEY);
}
