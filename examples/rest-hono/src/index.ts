/**
 * flextree-rest + hono 最小集成示例
 *
 * 运行：bun run dev
 * 试一试：
 *   curl http://localhost:3100/api/trees
 *   curl http://localhost:3100/api/trees/menu/nodes
 *   curl -X POST http://localhost:3100/api/trees/menu/nodes -H "content-type: application/json" -d '{"nodes":[{"name":"新节点"}]}'
 */
import { Hono } from "hono";
import { FlexTreeManager } from "flextree";
import BunSqliteAdapter from "flextree-bun-sqlite-adapter";
import { FlexTreeApiService } from "flextree-rest"
import { createHonoRoutes } from "flextree-rest/hono";

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
    `DELETE FROM menu`,
]);

// 1. 建 manager 并注册到 service
const manager = new FlexTreeManager("menu", { adapter });
await manager.write(async () => {
    await manager.createRoot({ name: "首页" } as any);
    const root = await manager.getRoot();
    await manager.addNodes([{ name: "产品" }, { name: "文档" }] as any, root);
});

const service = new FlexTreeApiService();
service.register("menu", manager);

// 2. 生成 hono 子应用并挂载（挂载路径由宿主决定）
// hono 的 c.req.raw pathname 含挂载前缀，basePath 需与挂载前缀一致
const treeRoutes = await createHonoRoutes(service, { basePath: "/api/trees" });
const app = new Hono();
app.route("/api/trees", treeRoutes);

export default {
    port: 3100,
    fetch: app.fetch,
};

console.log("flextree-rest hono example: http://localhost:3100/api/trees");
