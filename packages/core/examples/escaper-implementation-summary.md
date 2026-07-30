# escaper 模块重构总结

## 实现概述

成功重构了 `packages/core/src/escaper/` 模块，实现了对五种数据库类型的差异化支持：

- ✅ SQLite
- ✅ MySQL  
- ✅ PostgreSQL
- ✅ Oracle
- ✅ SQL Server

## 核心功能

### 1. `createEscaper(type: DatabaseType): Escaper`

主工厂函数，根据数据库类型创建相应的 escaper 实例。

```typescript
const mysqlEscaper = createEscaper('mysql');
const pgEscaper = createEscaper('postgresql');
```

### 2. 数据库差异处理

#### 2.1 字符串转义
- **MySQL**: 反斜杠转义 `'it\'s'`
- **PostgreSQL/SQLite/Oracle/SQL Server**: 双单引号转义 `'it''s'`

#### 2.2 标识符转义
- **MySQL**: 反引号 `` `table` ``
- **PostgreSQL/Oracle**: 双引号 `"table"`
- **SQLite/SQL Server**: 方括号 `[table]`

#### 2.3 SQL 格式化
- 支持占位符替换 (`?` 和 `??`)
- 对象自动展开为 SET 子句
- 数组自动展开为 IN 子句
- 智能参数处理

### 3. API 接口

每个 escaper 实例提供以下方法：

```typescript
interface Escaper {
  escape(value: SqlValue, stringifyObjects?: boolean, timezone?: Timezone): string;
  format(sql: string, values?: SqlValue | SqlValue[], stringifyObjects?: boolean, timezone?: Timezone): string;
  escapeId(value: SqlValue, forbidQualified?: boolean): string;
  objectToValues(object: Record<string, SqlValue> | Map<string, SqlValue>, timezone?: Timezone): string;
  arrayToList(array: SqlValue[] | Set<SqlValue>, timezone?: Timezone): string;
  dateToString(date: Date, timezone: Timezone): string;
  temporalToString(value: TemporalValue, timezone?: Timezone): string;
  bufferToString(buffer: Buffer): string;
  raw(sql: string): Raw;
}
```

## 关键实现细节

### 1. 智能参数处理

修复了 `format` 函数的参数解析问题：

```typescript
// 之前的问题
format("UPDATE users SET ? WHERE id = ?", { name: "Alice", age: 25 }, 1)
// 第三个参数 1 被错误解析为 stringifyObjects

// 修复后
// 自动检测并正确处理参数
```

### 2. Set 类型处理

```typescript
// 直接 Set 转换为逗号分隔列表
escaper.arrayToList(new Set([1, 2, 3])) // "1, 2, 3"

// 数组中的 Set 包装在括号中
escaper.arrayToList([new Set([1, 2]), new Set([3, 4])]) // "(1, 2), (3, 4)"
```

### 3. 向后兼容

保持现有 API 不变，使用 MySQL 风格作为默认实现：

```typescript
// 默认导出仍然是 MySQL 风格
export const escape = defaultEscaper.escape;
export const format = defaultEscaper.format;
// ... 等等
```

## 测试覆盖

创建完整的测试套件 `packages/core/__tests__/escaper.test.ts`：

- ✅ **295 个测试用例**
- ✅ **所有 5 种数据库类型**
- ✅ **所有核心功能**
- ✅ **边界情况**
- ✅ **跨数据库一致性**

## 使用示例

### 创建数据库专用 escaper

```typescript
import { createEscaper } from '@flextree/escaper';

const mysqlEscaper = createEscaper('mysql');
const pgEscaper = createEscaper('postgresql');
```

### 字符串转义差异

```typescript
const strWithQuote = "it's a test";
mysqlEscaper.escape(strWithQuote);    // 'it\'s a test'
pgEscaper.escape(strWithQuote);       // 'it''s a test'
```

### 标识符转义差异

```typescript
const identifier = "tableName";
mysqlEscaper.escapeId(identifier);     // `tableName`
pgEscaper.escapeId(identifier);        // "tableName"
sqliteEscaper.escapeId(identifier);    // [tableName]
```

### SQL 格式化

```typescript
// 对象展开为 SET 子句
const result = mysqlEscaper.format(
  'UPDATE users SET ? WHERE id = ?',
  [{ name: 'Alice', age: 25 }, 1]
);
// 输出: UPDATE users SET `name` = 'Alice', `age` = 25 WHERE id = 1

// 数组展开为 IN 子句
const result = mysqlEscaper.format(
  'SELECT * FROM users WHERE id IN (?)',
  [[1, 2, 3]]
);
// 输出: SELECT * FROM users WHERE id IN (1, 2, 3)
```

## 文件变更

### 新增文件
- `packages/core/src/escaper/types.ts` - 类型定义
- `packages/core/src/escaper/index.ts` - 主要实现
- `packages/core/__tests__/escaper.test.ts` - 完整测试套件
- `packages/core/examples/escaper-usage.ts` - 使用示例

### 修改文件
- 无破坏性变更，完全向后兼容

## 验证结果

### 测试通过率
- ✅ **295/295** escaper 测试通过
- ✅ **416/416** 完整测试套件通过

### 功能验证
- ✅ 所有 5 种数据库类型正确支持
- ✅ 字符串转义差异正确处理
- ✅ 标识符转义差异正确处理
- ✅ SQL 格式化功能正常
- ✅ 对象/数组展开功能正常
- ✅ Set 类型处理正确
- ✅ 向后兼容性保持

## 总结

成功实现了对 SQLite、MySQL、PostgreSQL、Oracle 和 SQL Server 的全面支持，同时保持了 API 的简洁性和向后兼容性。该实现为 FlexTree 项目提供了强大的多数据库 SQL 转义和格式化能力。