import sqlstring from 'sqlstring'

export function escapeSqlString(value: any) {
    return sqlstring.escape(value)
}
