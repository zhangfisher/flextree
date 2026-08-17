# 安装

`flextree-rest` 将 `FlexTreeManager` 的能力映射为 HTTP RESTful API。它本身不监听端口、不绑定 web 框架——通过各框架 Binding 挂载到 express / hono / elysia / nextjs。

```bash
bun add flextree-rest
```

框架 binding 按需引入（可选 peer，不装不影响其他 binding）：

```bash
bun add hono        # 用 hono binding 时
bun add express     # 用 express binding 时
bun add elysia      # 用 elysia binding 时
# nextjs 无需额外依赖（结构化类型，零 import）
```

子路径入口：

| 导入                    | 内容                                                  |
| ----------------------- | ----------------------------------------------------- |
| `flextree-rest`         | `FlexTreeApiService`、`createHandler`、错误工具、类型 |
| `flextree-rest/hono`    | `createHonoRoutes`                                    |
| `flextree-rest/express` | `createExpressRoutes`                                 |
| `flextree-rest/elysia`  | `createElysiaRoutes`                                  |
| `flextree-rest/nextjs`  | `createNextjsHandler`                                 |
