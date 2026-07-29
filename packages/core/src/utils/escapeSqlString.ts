import sqlstring from 'sqlstring'

/**
 * SQL 字符串转义
 * 注意：此函数使用 MySQL 风格的转义（反斜杠），适用于 MySQL 数据库
 * 对于 SQLite，应该使用 escapeSqliteString 函数
 */
export function escapeSqlString(value: any) {
    return sqlstring.escape(value)
}

/**
 * SQLite 字符串转义
 * 使用双单引号来转义单引号，符合 SQLite 标准
 * 适用于 Bun SQLite 和其他 SQLite 数据库
 */
export function escapeSqliteString(value: any): string {
    if (value === null || value === undefined) {
        return 'NULL'
    }
    if (typeof value === 'number') {
        return String(value)
    }
    if (typeof value === 'boolean') {
        return value ? '1' : '0'
    }

    // 将字符串中的单引号替换为双单引号（SQLite 标准转义）
    const escaped = String(value).replace(/'/g, "''")
    return `'${escaped}'`
}
