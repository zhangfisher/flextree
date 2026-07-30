import { FlexTreeError } from '../errors';

/**
 * 验证 SQL 表达式的安全性，防止 SQL 注入攻击
 * @param sqlExpression - 用户提供的 SQL 表达式（如 WHERE 条件）
 * @returns 处理后的安全 SQL 表达式字符串
 * @throws {FlexTreeError} 如果检测到危险的 SQL 模式
 */
export function checkSqlSafety(sqlExpression: string): string {
  // 基本的安全处理：移除多余空格
  let processed = sqlExpression.trim();

  if (!processed) {
    return processed;
  }

  // 安全检查：检测明显的SQL注入模式
  const dangerousPatterns = [
    { pattern: /;\s*DROP\s+/i, name: 'DROP' },
    { pattern: /;\s*DELETE\s+/i, name: 'DELETE' },
    { pattern: /;\s*INSERT\s+/i, name: 'INSERT' },
    { pattern: /;\s*UPDATE\s+/i, name: 'UPDATE' },
    { pattern: /UNION\s+SELECT/i, name: 'UNION SELECT' },
    { pattern: /--\s*$/, name: 'SQL 注释' },
    { pattern: /\/\*/, name: '多行注释' },
  ];

  for (const { pattern, name } of dangerousPatterns) {
    if (pattern.test(processed)) {
      throw new FlexTreeError(
        `Dangerous SQL pattern detected in SQL expression: ${name}`
      );
    }
  }

  return processed;
}
