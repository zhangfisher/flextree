/**
 * 全局唯一 service：App Router 的多个 route handler 共享同一注册表
 *
 * 注意：本示例用 bun 运行（bun ./node_modules/.bin/next dev），
 * 因此可用 bun-sqlite 适配器（node 运行时原生模块 ABI 不兼容，见 README）。
 */
import { FlexTreeManager } from "flextree";
import BunSqliteAdapter from "flextree-bun-sqlite-adapter";
import { FlexTreeApiService } from "flextree-rest";

declare global {
    // eslint-disable-next-line no-var
    var __flextreeService: FlexTreeApiService | undefined;
}

export async function getService(): Promise<FlexTreeApiService> {
    if (globalThis.__flextreeService) return globalThis.__flextreeService;

    const adapter = new BunSqliteAdapter();
    await adapter.open();
    await adapter.exec([
        `CREATE TABLE IF NOT EXISTS menu (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),
            treeId INTEGER,
            level INTEGER,
            leftValue INTEGER,
            rightValue INTEGER
        )`,
    ]);

    const manager = new FlexTreeManager("menu", { adapter });
    const hasRoot = await manager.hasRoot();
    if (!hasRoot) {
        await manager.write(async () => {
            await manager.createRoot({ name: "首页" } as any);
            const root = await manager.getRoot();
            await manager.addNodes([{ name: "产品" }, { name: "文档" }] as any, root);
        });
    }

    const service = new FlexTreeApiService();
    service.register("menu", manager);
    globalThis.__flextreeService = service;
    return service;
}
