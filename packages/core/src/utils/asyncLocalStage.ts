/**
 * AsyncLocalStorage 的跨运行时单值实现（替代 node:async_hooks，core 保持零 node: 依赖）。
 *
 * core 仅用它判定「当前调用是否在 write(fn) 链上」（读写守卫，防外部并发读看到
 * 事务中间态）。所需关键语义是跨 await 保留上下文：run 回调内 await 之后的代码
 * 仍在上下文中。
 *
 * 单线程串行 write 的场景下等价实现：run 置位直到回调 Promise 完全 settle 才复位
 * （finally 不能同步执行——那会让 await 后的 getStore 读到 undefined，内部读被
 * 误判为外部读而死锁在 _guardRead 上）。write 由 _isWriting 保证串行。
 *
 * 与 node:async_hooks 的差异：无法区分「链外并发读」，异步适配器下 write 未
 * await 时外部读不再等待事务完成（见 docs/adr/0004-core-zero-node-deps.md）。
 */
export class AsyncLocalStorage<T> {
  private _value: T | undefined;
  private _has = false;

  async run<R>(value: T, callback: () => R): Promise<Awaited<R>> {
    const prev = this._value;
    const prevHas = this._has;
    this._value = value;
    this._has = true;
    try {
      return await callback();
    } finally {
      this._value = prev;
      this._has = prevHas;
    }
  }

  getStore(): T | undefined {
    return this._has ? this._value : undefined;
  }
}
