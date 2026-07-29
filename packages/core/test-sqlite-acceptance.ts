import { Database } from "bun:sqlite";
import sqlstring from 'sqlstring';
import { escape as escapeSqlEscaper } from 'sql-escaper';

const db = new Database(":memory:");

// 创建测试表
db.exec(`
    CREATE TABLE test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content VARCHAR(100)
    );
`);

console.log('=== SQLite 对不同转义方式的兼容性测试 ===\n');

const testValue = 'root\'s "special"';
const testCases = [
  { name: 'sqlstring.escape', escaped: sqlstring.escape(testValue) },
  { name: 'sql-escaper.escape', escaped: escapeSqlEscaper(testValue) },
  { name: 'SQLite双单引号', escaped: `'${testValue.replace(/'/g, "''")}'` },
];

testCases.forEach(({ name, escaped }) => {
  console.log(`${name}:`);
  console.log(`  转义结果: ${escaped}`);
  const sql = `INSERT INTO test (content) VALUES (${escaped})`;
  console.log(`  SQL: ${sql}`);

  try {
    db.run(sql);
    const result = db.query("SELECT content FROM test WHERE id = last_insert_rowid()").get();
    console.log(`  ✅ 成功 - 存储值: "${result.content}"`);
  } catch (error) {
    console.log(`  ❌ 失败 - ${error.message}`);
  }
  console.log();

  // 清空表
  db.exec("DELETE FROM test");
});

db.close();
