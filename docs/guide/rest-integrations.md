# 集成

Binding 均为 **async 工厂**（动态 import 框架——未安装的框架不会被加载），返回**框架原生路由产物**：挂载路径、挂载方式、生命周期全由宿主决定。

## Express

```ts
import { createExpressRoutes } from "flextree-rest/express";

const treeRouter = await createExpressRoutes(service);

const app = express();
app.use(express.json());            // ⚠️ 必须先挂 body 解析（binding 约定）
app.use("/api/trees", treeRouter);  // 挂载后 req.url 已剥前缀，无需 basePath
```

> 未挂 `express.json()` 时，带 body 的请求会得到 `400 BODY_NOT_PARSED`（提示性错误，而非静默空 body）。

## Next.js

`app/api/trees/[[...path]]/route.ts`——**可选 catch-all**（必选 `[...path]` 不匹配 `/api/trees` 本身，树列表会 404）：

```ts
import { createNextjsHandler } from "flextree-rest/nextjs";
import { getService } from "@/lib/tree"; // 你的全局单例 service

const handlers = createNextjsHandler(await getService());

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
```

Next 14（params 对象）与 Next 15（params Promise）均兼容。workspace 直引 TS 源码时需 `transpilePackages: ["flextree", "flextree-rest", ...]` + tsconfig 开 `experimentalDecorators`（见 `examples/rest-nextjs`）。

## Hono

```ts
import { createHonoRoutes } from "flextree-rest/hono";

const treeRoutes = await createHonoRoutes(service, { basePath: "/api/trees" });
app.route("/api/trees", treeRoutes);
```

`c.req.raw` 的 pathname 含挂载前缀；若宿主在 fetch 入口整体转写，传 `{ basePath: "/api/trees" }` 显式剥离。

## Elysia

```ts
import { createElysiaRoutes } from "flextree-rest/elysia";

const treeApp = await createElysiaRoutes(service);
const app = new Elysia().use(treeApp);
```

## 其他框架 / 自定义集成

不经 binding，直接使用 Standard Handler（任何能产出 WinterCG `Request` 的环境都行）：

```ts
import { createHandler } from "flextree-rest";

const handle = createHandler(service, { basePath: "/api/trees" });
// 任何框架的中间件里：
const response = await handle(new Request(url, { method, headers, body }));
```

## basePath 语义一览

| Binding | basePath 默认 | 说明 |
|---|---|---|
| express | `""` | `app.use(prefix, router)` 已剥前缀，保持默认 |
| hono | `""` | `app.route(prefix, sub)` 后 pathname 仍含前缀，需与挂载前缀一致时传入 |
| elysia | `""` | 直接 handle 时按需传入 |
| nextjs | 无此概念 | catch-all 段天然相对 |
