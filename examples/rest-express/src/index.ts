/**
 * flextree-rest + express 最小集成示例
 *
 * 注意：必须先挂 express.json()（binding 约定：body 由宿主解析）
 *
 * 运行：bun run dev
 * 试一试：
 *   curl http://localhost:3101/api/trees/menu/nodes
 *   curl -X POST http://localhost:3101/api/trees/menu/nodes -H "content-type: application/json" -d '{"nodes":[{"name":"新节点"}]}'
 */
import express from "express";
import { FlexTreeManager } from "flextree";
import BunSqliteAdapter from "flextree-bun-sqlite-adapter";
import { FlexTreeApiService } from "flextree-rest"
import { createExpressRoutes } from "flextree-rest/express";

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

const manager = new FlexTreeManager("menu", { adapter });
await manager.write(async () => {
    await manager.createRoot({ name: "首页" } as any);
    const root = await manager.getRoot();
    await manager.addNodes([{ name: "产品" }, { name: "文档" }] as any, root);
});

const service = new FlexTreeApiService();
service.register("menu", manager);

// 生成 express Router（挂载已剥前缀，无需 basePath）
const treeRouter = await createExpressRoutes(service);

const app = express();
app.use(express.json()); // 必须在 router 之前
app.use("/api/trees", treeRouter);

app.listen(3101, () => {
    console.log("flextree-rest express example: http://localhost:3101/api/trees");
});
