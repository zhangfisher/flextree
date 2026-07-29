import sqlstring from 'sqlstring';
import { escape as escapeSqlEscaper } from 'sql-escaper';

const testValues = [
  'root\'s "special"',  // 包含单引号和双引号
  'cat<>test',          // 包含特殊字符
  'normal string',      // 普通字符串
  '',                   // 空字符串
  123,                  // 数字
  null,                 // null值
  undefined,            // undefined值
  "it's",               // 简单的单引号
  "don't",              // 常见的缩写
];

console.log('=== SQL 转义函数对比测试 ===\n');

console.log('1. sqlstring.escape (MySQL风格):');
testValues.forEach(value => {
  const escaped = sqlstring.escape(value);
  console.log(`  ${JSON.stringify(value)} -> ${escaped}`);
});

console.log('\n2. sql-escaper.escape (MySQL风格):');
testValues.forEach(value => {
  const escaped = escapeSqlEscaper(value);
  console.log(`  ${JSON.stringify(value)} -> ${escaped}`);
});

console.log('\n3. SQLite标准转义 (双单引号):');
const escapeSqlite = (value: any): string => {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  const escaped = String(value).replace(/'/g, "''");
  return `'${escaped}'`;
};

testValues.forEach(value => {
  const escaped = escapeSqlite(value);
  console.log(`  ${JSON.stringify(value)} -> ${escaped}`);
});

console.log('\n=== 结论分析 ===');
console.log('sql-escaper 和 sqlstring.escape 都使用 MySQL 风格的反斜杠转义');
console.log('SQLite 需要双单引号转义，两者都不兼容');
console.log('因此 sql-escaper 不能解决 SQLite 兼容性问题');
