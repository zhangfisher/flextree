/**
 * FlexTreeApiService：API Provider 的实现主体（CONTEXT.md「API Service」）
 *
 * 持有 Tree Registry 与 per-manager 写队列；接受 Standard Handler 解析出的
 * 普通对象参数调用 manager。不 import 任何 web 框架、不感知 Request/Response。
 */
import { TreeRegistry, type RegistryEntry } from "./registry";
import type { ErrorNormalizer } from "./errors";
import type { RegisterOptions, TreeManagerLike } from "./types";
import { WriteQueue } from "./write-queue";

export interface FlexTreeApiServiceOptions {
    /** 自定义错误映射扩展点：返回 ProblemDetail 覆盖默认，返回 undefined 走默认 */
    onError?: ErrorNormalizer;
}

export class FlexTreeApiService {
    private _registry = new TreeRegistry();
    private _queue = new WriteQueue();
    private _options: FlexTreeApiServiceOptions;

    constructor(options?: FlexTreeApiServiceOptions) {
        this._options = options ?? {};
    }

    /** 注册树（详见 TreeRegistry.register），返回注册条目 */
    register(name: string, manager: TreeManagerLike, options?: RegisterOptions): RegistryEntry {
        return this._registry.register(name, manager, options);
    }

    /** 注销树 */
    unregister(name: string): boolean {
        return this._registry.unregister(name);
    }

    /** 取注册条目（未注册抛 404 语义错误） */
    entry(name: string): RegistryEntry {
        return this._registry.get(name);
    }

    /** 注册树列表 */
    list(): RegistryEntry[] {
        return this._registry.list();
    }

    get onError(): ErrorNormalizer | undefined {
        return this._options.onError;
    }

    /**
     * 执行写单元：入该树的写队列串行，单元内包一个 manager.write()
     * （一请求一原子事务，ADR-0009）。回调返回值穿透 write 的 void 签名
     * （copyNode 等需要返回值的写操作依赖此行为）。
     */
    runWrite<T>(entry: RegistryEntry, fn: (manager: TreeManagerLike) => Promise<T>): Promise<T> {
        let result!: T;
        const p = this._queue.enqueue(entry.manager, () =>
            entry.manager.write(async () => {
                result = await fn(entry.manager);
            }),
        );
        return p.then(() => result);
    }

    /**
     * 入队但不再包 write：给自带 write 的方法用（repair/clear 等——
     * 嵌套 write 会触发并发守卫 FlexTreeInvalidUpdateError）。仍享受串行排队。
     */
    runSelfWrite<T>(entry: RegistryEntry, fn: (manager: TreeManagerLike) => Promise<T>): Promise<T> {
        return this._queue.enqueue(entry.manager, () => fn(entry.manager));
    }
}
