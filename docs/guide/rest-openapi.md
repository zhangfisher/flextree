# OpenAPI

装好即得：**`GET {挂载点}/openapi.json` 直接下载 OpenAPI 3.1 文档**（浏览器、curl 均可），无需任何配置。

```bash
# 挂载在 /api/trees 时：
curl http://localhost:3000/api/trees/openapi.json
```

文档由声明式路由表生成——与运行时校验同源（一处声明、两处消费），不会与实现漂移。文档在首个请求时生成并缓存，注册表变更（register/unregister）自动失效重建。

## 配置

```ts
const service = new FlexTreeApiService({
    openapi: {
        enabled: true,                    // false：关闭内置端点（→ 404）
        info: { title: "我的树 API", version: "1.0.0" },
        servers: [{ url: "https://api.example.com/api/trees" }],  // 缺省按 basePath 推导
    },
});
```

**servers 缺省推导**：binding 的 basePath（如 hono 挂载 `/api/trees` 时传的 `basePath`）自动成为 `servers[0].url`。公网部署或网关代理场景请显式传入真实可达地址。

## nodeSchema：精确描述业务字段

默认情况下节点 schema 是宽的（`additionalProperties: true` + 关键字段按注册的 keyFields 列出）。注册时提供 `nodeSchema`（JSON Schema）可精确描述：

```ts
service.register("menu", manager, {
    nodeSchema: {
        type: "object",
        properties: {
            id: { type: "integer" },
            name: { type: "string" },
            title: { type: "string" },
            size: { type: "integer" },
        },
        required: ["id", "name"],
    },
});
```

多树注册时每树各自成 schema（`#/components/schemas/TreeNode-{treeName}`），节点响应自动以 `oneOf` 引用全部注册树。`nodeSchema` 原样嵌入、不做结构校验——其正确性由提供者负责。

## 纯函数用法（进阶）

`generateOpenApiDocument` 不依赖内置端点，可独立使用：

```ts
import { generateOpenApiDocument } from "flextree-rest";

// 写文件 / CI 校验 / 自定义挂载
const doc = generateOpenApiDocument(service, {
    info: { title: "我的树 API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com/api/trees" }],
});
await Bun.write("openapi.json", JSON.stringify(doc, null, 2));
```

## 文档内容范围

- **包含**：26 个端点（含 `/openapi.json` 自身）、path/query 参数（类型、enum、integer/minimum）、响应 schema（含分页 envelope 的 `oneOf`）、统一错误响应（RFC 9457 `application/problem+json` + `Problem` 组件）
- **不包含**：写端点的 requestBody schema（body 结构见 [API](/guide/rest-api)，v0.2 边界）；where 平铺过滤的动态字段（每树白名单不同，以 description 说明）

## Swagger UI

文档是标准 OpenAPI 3.1，任何兼容工具可直接消费：

```ts
// hono + @hono/swagger-ui
import { SwaggerUI } from "@hono/swagger-ui";
app.get("/docs", SwaggerUI({ url: "/api/trees/openapi.json" }));
```
