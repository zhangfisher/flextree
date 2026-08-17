# 快速入门

以 Express 集成为例，三步接入。

## 1. 建 manager 并注册

```ts
import express from "express";
import { FlexTreeManager } from "flextree";
import BunSqliteAdapter from "flextree-bun-sqlite-adapter";
import { FlexTreeApiService } from "flextree-rest";
import { createExpressRoutes } from "flextree-rest/express";

// 建 manager（照常，见「创建树」章节）
const adapter = new BunSqliteAdapter();
await adapter.open();
await adapter.exec([`CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(60), treeId INTEGER,
    level INTEGER, leftValue INTEGER, rightValue INTEGER
)`]);
const manager = new FlexTreeManager("menu", { adapter });

// 注册到 service
const service = new FlexTreeApiService();
service.register("menu", manager, {
    fields: ["title"],              // 可选：where 过滤字段白名单
    // validate: (body) => {...},   // 可选：请求体校验 hook（抛错 → 400）
    // idType: "number",            // 可选：NodeId 类型（默认智能转换）
});
```

`register` 同时支持 `FlexTreeManager` 与 `MultiRootFlexTreeManager`（多根树，`?level=0` 返回用户根、顶层添加即新用户根）。

## 2. 挂载

```ts
const treeRouter = await createExpressRoutes(service);

const app = express();
app.use(express.json());            // ⚠️ 必须先挂 body 解析（binding 约定）
app.use("/api/trees", treeRouter);  // 挂载路径由你决定
app.listen(3000);
```

## 3. 调用

```bash
curl http://localhost:3000/api/trees/menu/nodes
# [{"id":1,"name":"首页","level":0,...}]

curl -X POST http://localhost:3000/api/trees/menu/nodes \
  -H "content-type: application/json" \
  -d '{"nodes":[{"name":"产品"}]}'
# HTTP/1.1 201 Created
# Location: /menu/nodes/1
```

> **POST 响应不含新节点 id**（自增 id 在库内生成、`addNodes` 不回传）——按 `Location` 指向的资源重取即可。

## 核心概念

| 概念 | 说明 |
|---|---|
| **API Service** | `FlexTreeApiService`：持有树注册表与写队列，不感知 HTTP |
| **Standard Handler** | WinterCG fetch `(Request) => Response` 纯函数路由层（也可单独使用，见 [集成](/guide/rest-integrations)） |
| **Binding** | 框架请求 → 标准 Request 的薄转写层，按需子路径引入 |
| **写队列** | 每个写请求自动包一个 `manager.write()`（一请求一原子事务），同树写请求串行排队，对客户端透明 |

其他框架（Hono / Elysia / Next.js）的集成方式见 [集成](/guide/rest-integrations)。完整可运行示例：`examples/rest-hono`、`examples/rest-express`、`examples/rest-nextjs`。
