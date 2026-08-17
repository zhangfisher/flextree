/**
 * 写队列单元测试（mock manager，无 DB）：
 * 串行执行（无交叠）、失败不传染后继（链不断）
 */
import { describe, test, expect } from "bun:test";
import { WriteQueue } from "../src/write-queue";

describe("WriteQueue", () => {
    test("同 manager 任务串行执行（无交叠）", async () => {
        const queue = new WriteQueue();
        const events: string[] = [];
        const manager = { id: 1 } as any; // 同一 manager 实例（Map key）

        const task = (name: string, delay: number) => async () => {
            events.push(`enter:${name}`);
            await new Promise((r) => setTimeout(r, delay));
            events.push(`exit:${name}`);
        };

        // 三个任务并发入队，完成顺序应与入队顺序一致
        await Promise.all([
            queue.enqueue(manager, task("a", 20)),
            queue.enqueue(manager, task("b", 5)),
            queue.enqueue(manager, task("c", 1)),
        ]);

        expect(events).toEqual([
            "enter:a",
            "exit:a",
            "enter:b",
            "exit:b",
            "enter:c",
            "exit:c",
        ]);
    });

    test("前驱失败不传染后继（链不断）", async () => {
        const queue = new WriteQueue();
        const events: string[] = [];
        const manager = { id: 2 } as any;

        const failing = async () => {
            events.push("fail");
            throw new Error("boom");
        };
        const next = async () => {
            events.push("ok");
        };

        const p1 = queue.enqueue(manager, failing);
        const p2 = queue.enqueue(manager, next);
        await p1.catch(() => {});
        await p2;

        expect(events).toEqual(["fail", "ok"]);
    });

    test("不同 manager 之间并行（互不排队）", async () => {
        const queue = new WriteQueue();
        const events: string[] = [];

        const task = (name: string, delay: number) => async () => {
            events.push(`enter:${name}`);
            await new Promise((r) => setTimeout(r, delay));
            events.push(`exit:${name}`);
        };

        await Promise.all([
            queue.enqueue({ a: 1 } as any, task("x", 20)),
            queue.enqueue({ b: 2 } as any, task("y", 1)),
        ]);

        // y 先完成：两个 manager 各自独立
        expect(events.indexOf("exit:y")).toBeLessThan(events.indexOf("exit:x"));
    });

    test("失败任务的错误向调用方传播", async () => {
        const queue = new WriteQueue();
        const p = queue.enqueue({ id: 3 } as any, async () => {
            throw new Error("boom");
        });
        expect(p).rejects.toThrow("boom");
        await p.catch(() => {});
    });
});
