/**
 * 写队列：per-manager promise 链（ADR-0009）
 *
 * manager.write() 遇并发直接抛 FlexTreeInvalidUpdateError，HTTP 天然并发，
 * 故每个写请求经 enqueue 排队串行执行，对客户端透明。
 */
import type { TreeManagerLike } from "./types";

export class WriteQueue {
    /** 以注册的 manager 实例为 key（MultiRoot 由其自身 write 转发到内部子 manager） */
    private _chains = new Map<TreeManagerLike, Promise<unknown>>();

    /**
     * 把一个写单元排到 manager 的队列尾并执行。
     * 链上前驱失败被吞掉（catch(()=>{})），避免一次失败后整条链永久 reject。
     */
    enqueue<T>(manager: TreeManagerLike, fn: () => Promise<T>): Promise<T> {
        const prev = this._chains.get(manager) ?? Promise.resolve();
        const next = prev
            .catch(() => {})
            .then(fn);
        // 链尾存 next 的容错形态：fn 的失败由 next 的调用方感知，不传染后继
        this._chains.set(
            manager,
            next.catch(() => {}),
        );
        return next;
    }
}
