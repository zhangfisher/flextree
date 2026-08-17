/**
 * API 层测试公共设施（BunSqliteAdapter 建库，照 core/__tests__ 惯例）
 * 串行执行（项目约束：测试涉及数据库操作）
 */
import { FlexTreeManager, MultiRootFlexTreeManager } from "flextree";
import BunSqliteAdapter from "../../bun-sqlite/src";
import { FlexTreeApiService } from "../src/service";
import { createHandler } from "../src/handler";

export interface TestFields {
    title: string;
    size: number;
}

export const BIN_ID = 9999;
export const BIN_NAME = "__recyclebin__";

export const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS tree (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(60),
    treeId INTEGER,
    level INTEGER,
    leftValue INTEGER,
    rightValue INTEGER,
    title VARCHAR(60),
    size INTEGER
)`;

let driver: BunSqliteAdapter;

/** 建库 + 单根树 manager（可选回收站） */
export async function createManager(opts?: {
    recyclebin?: boolean;
}): Promise<FlexTreeManager<TestFields>> {
    FlexTreeManager.clearInstance();
    driver = new BunSqliteAdapter();
    await driver.open();
    await driver.exec([CREATE_TABLE, `DELETE FROM tree`]);
    return new FlexTreeManager<TestFields>("tree", {
        adapter: driver,
        ...(opts?.recyclebin ? { recyclebin: { id: BIN_ID, name: BIN_NAME } } : {}),
    });
}

/** 建库 + 多根树 manager */
export async function createMultiRootManager(): Promise<MultiRootFlexTreeManager<TestFields>> {
    FlexTreeManager.clearInstance();
    driver = new BunSqliteAdapter();
    await driver.open();
    await driver.exec([CREATE_TABLE, `DELETE FROM tree`]);
    const manager = new MultiRootFlexTreeManager<TestFields>("tree", {
        adapter: driver,
        recyclebin: { id: BIN_ID, name: BIN_NAME },
    });
    await manager.load();
    return manager;
}

/** 取当前 driver（手工破坏树结构用） */
export function getDriver(): BunSqliteAdapter {
    return driver;
}

/** 组装 handler：注册树 + createHandler */
export function makeHandler(
    name: string,
    manager: FlexTreeManager<TestFields> | MultiRootFlexTreeManager<TestFields>,
    registerOptions?: Parameters<FlexTreeApiService["register"]>[2],
) {
    const service = new FlexTreeApiService();
    service.register(name, manager as any, registerOptions);
    return {
        service,
        handler: createHandler(service),
        req: (method: string, path: string, body?: unknown) => {
            return handler_request(method, path, body);
        },
    };

    function handler_request(method: string, path: string, body?: unknown): Promise<Response> {
        const init: RequestInit = { method };
        if (body !== undefined) {
            init.body = JSON.stringify(body);
            init.headers = { "content-type": "application/json" };
        }
        return createHandler(service)(new Request(`http://x${path}`, init));
    }
}

/** 预置树：root → A(A1, A2), B */
export async function buildTree(manager: FlexTreeManager<TestFields> | any) {
    await manager.write(async () => {
        await manager.createRoot({ name: "R" } as any);
        const root = await manager.getRoot();
        await manager.addNodes([{ name: "A" }, { name: "B" }] as any, root);
        const a = await manager.findNode({ name: "A" });
        await manager.addNodes([{ name: "A1" }, { name: "A2" }] as any, a!.id);
    });
}
