export type Raw = {
  toSqlString(): string;
};

/** Avoids the global `Temporal` namespace so consumers don't need TS's ESNext.Temporal lib. */
export type TemporalValue = {
  readonly [Symbol.toStringTag]: `Temporal.${string}`;
  readonly epochMilliseconds?: number;
  toString(): string;
};

export type SqlValue =
  | string
  | number
  | bigint
  | boolean
  | Date
  | TemporalValue
  | Buffer
  | Uint8Array
  | Raw
  | Record<string, unknown>
  | SqlValue[]
  | Set<SqlValue>
  | Map<string, SqlValue>
  | null
  | undefined;

export type Timezone = "local" | "Z" | (string & NonNullable<unknown>);

export type DatabaseType = "sqlite" | "mysql" | "postgresql" | "oracle" | "sqlserver";

/**
 * Escaper 接口 - 提供针对不同数据库类型的 SQL 转义和格式化功能
 */
export interface Escaper {
  /**
   * 转义 SQL 值
   * @param value 要转义的值
   * @param stringifyObjects 是否将对象序列化为字符串
   * @param timezone 时区设置
   */
  escape(value: any, stringifyObjects?: boolean, timezone?: Timezone): string;

  /**
   * 格式化 SQL 查询，替换占位符
   * @param sql SQL 模板字符串
   * @param values 要插入的值
   * @param stringifyObjects 是否将对象序列化为字符串
   * @param timezone 时区设置
   */
  format(
    sql: string,
    values?: SqlValue | SqlValue[],
    stringifyObjects?: boolean,
    timezone?: Timezone,
  ): string;

  /**
   * 转义 SQL 标识符（表名、列名等）
   * @param value 要转义的标识符
   * @param forbidQualified 是否禁止限定符（如 table.column）
   */
  escapeId(value: any, forbidQualified?: boolean): string;

  /**
   * 将对象转换为键值对字符串
   * @param object 要转换的对象或 Map
   * @param timezone 时区设置
   */
  objectToValues(
    object: Record<string, SqlValue> | Map<string, SqlValue>,
    timezone?: Timezone,
  ): string;

  /**
   * 将数组转换为逗号分隔的列表
   * @param array 要转换的数组或 Set
   * @param timezone 时区设置
   */
  arrayToList(array: SqlValue[] | Set<SqlValue>, timezone?: Timezone): string;

  /**
   * 将日期转换为字符串
   * @param date 要转换的日期
   * @param timezone 时区设置
   */
  dateToString(date: Date, timezone: Timezone): string;

  /**
   * 将 Temporal 对象转换为字符串
   * @param value 要转换的 Temporal 对象
   * @param timezone 时区设置
   */
  temporalToString(value: TemporalValue, timezone?: Timezone): string;

  /**
   * 将 Buffer 转换为十六进制字符串
   * @param buffer 要转换的 Buffer
   */
  bufferToString(buffer: Buffer): string;

  /**
   * 创建原始 SQL 对象
   * @param sql 原始 SQL 字符串
   */
  raw(sql: string): Raw;
}
