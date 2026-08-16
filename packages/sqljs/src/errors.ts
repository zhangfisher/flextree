/**
 * sqljs 适配器错误定义
 */

/**
 * 持久化钩子（onPersist）失败。
 *
 * 抛出此错误时事务已经 COMMIT：内存态已更新，但快照未写入外部存储。
 * 调用方据此与「fn 失败已 ROLLBACK」区分——前者可重试 db.export()，后者需重试整个 write。
 */
export class FlexTreeSqljsPersistError extends Error {
  constructor(cause: unknown) {
    super("Persist hook failed: transaction committed but snapshot was not written");
    this.name = "FlexTreeSqljsPersistError";
    this.cause = cause;
  }
}
