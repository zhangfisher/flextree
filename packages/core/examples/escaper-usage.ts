import { createEscaper, type DatabaseType } from '../src/escaper';

// 创建不同数据库类型的 escaper 实例
const mysqlEscaper = createEscaper('mysql');
const pgEscaper = createEscaper('postgresql');
const sqliteEscaper = createEscaper('sqlite');
const oracleEscaper = createEscaper('oracle');
const sqlserverEscaper = createEscaper('sqlserver');

console.log('=== 字符串转义差异 ===');
const strWithQuote = "it's a test";
console.log('MySQL:', mysqlEscaper.escape(strWithQuote));     // 'it\'s a test'
console.log('PostgreSQL:', pgEscaper.escape(strWithQuote));  // 'it''s a test'
console.log('SQLite:', sqliteEscaper.escape(strWithQuote));  // 'it''s a test'

console.log('\n=== 标识符转义差异 ===');
const identifier = "tableName";
console.log('MySQL:', mysqlEscaper.escapeId(identifier));      // `tableName`
console.log('PostgreSQL:', pgEscaper.escapeId(identifier));   // "tableName"
console.log('SQLite:', sqliteEscaper.escapeId(identifier));   // [tableName]
console.log('SQL Server:', sqlserverEscaper.escapeId(identifier)); // [tableName]
console.log('Oracle:', oracleEscaper.escapeId(identifier));   // "tableName"

console.log('\n=== SQL 格式化示例 ===');

// MySQL 示例
const mysqlQuery = mysqlEscaper.format(
  'INSERT INTO ?? (name, email, age) VALUES (?, ?, ?)',
  ['users', 'Alice', 'alice@example.com', 25]
);
console.log('MySQL Insert:', mysqlQuery);
// 输出: INSERT INTO `users` (name, email, age) VALUES ('Alice', 'alice@example.com', 25)

// PostgreSQL 示例
const pgQuery = pgEscaper.format(
  'SELECT * FROM ?? WHERE ?? = ? AND ?? > ?',
  ['users', 'status', 'active', 'score', 100]
);
console.log('PostgreSQL Select:', pgQuery);
// 输出: SELECT * FROM "users" WHERE "status" = 'active' AND "score" > 100

// SQLite 示例
const sqliteQuery = sqliteEscaper.format(
  'UPDATE ?? SET ?? = ?, ?? = ? WHERE ?? = ?',
  ['products', 'price', 29.99, 'stock', 100, 'id', 1]
);
console.log('SQLite Update:', sqliteQuery);
// 输出: UPDATE [products] SET [price] = 29.99, [stock] = 100 WHERE [id] = 1

console.log('\n=== 对象展开为 SET 子句 ===');
const objUpdate = mysqlEscaper.format(
  'UPDATE users SET ? WHERE id = ?',
  [{ name: 'Bob', age: 30, email: 'bob@example.com' }, 1]
);
console.log('Object Expansion:', objUpdate);
// 输出: UPDATE users SET `name` = 'Bob', `age` = 30, `email` = 'bob@example.com' WHERE id = 1

console.log('\n=== 数组展开为 IN 子句 ===');
const arrayIn = mysqlEscaper.format(
  'SELECT * FROM users WHERE id IN (?)',
  [[1, 2, 3, 4, 5]]
);
console.log('Array IN clause:', arrayIn);
// 输出: SELECT * FROM users WHERE id IN (1, 2, 3, 4, 5)

console.log('\n=== 原始 SQL (raw 函数) ===');
const rawSql = mysqlEscaper.format(
  'SELECT * FROM users WHERE created_at = ? AND status = ?',
  [mysqlEscaper.raw('NOW()'), 'active']
);
console.log('Raw SQL:', rawSql);
// 输出: SELECT * FROM users WHERE created_at = NOW() AND status = 'active'

console.log('\n=== 嵌套数组处理 ===');
const nestedArray = mysqlEscaper.format(
  'INSERT INTO ?? (user_id, score, timestamp) VALUES ?',
  ['scores', [[1, 95, '2024-01-01'], [2, 87, '2024-01-02']]]
);
console.log('Nested Arrays:', nestedArray);
// 输出: INSERT INTO `scores` (user_id, score, timestamp) VALUES (1, 95, '2024-01-01'), (2, 87, '2024-01-02')

console.log('\n=== Set 类型处理 ===');
const setResult = mysqlEscaper.arrayToList(new Set([1, 2, 3, 4]));
console.log('Set to List:', setResult);
// 输出: 1, 2, 3, 4

const setInQuery = mysqlEscaper.format(
  'SELECT * FROM products WHERE category_id IN (?)',
  [new Set([10, 20, 30])]
);
console.log('Set in Query:', setInQuery);
// 输出: SELECT * FROM products WHERE category_id IN (10, 20, 30)

export {
  mysqlEscaper,
  pgEscaper,
  sqliteEscaper,
  oracleEscaper,
  sqlserverEscaper
};