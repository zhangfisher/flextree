# flextree-rest

## 3.2.0

### Minor Changes

-   flextree-rest v0.2：新增 Offset 分页与 OpenAPI 文档生成。分页仅 GET /{tree}/nodes（?limit/&offset，内存切片，带分页参数时响应为 {items,total,limit,offset} envelope，不带保持裸数组向后兼容）。OpenAPI 3.1 文档默认经内置 GET /openapi.json 路由直接可下载（servers 按 basePath 推导，openapi.enabled:false 可关）；generateOpenApiDocument 纯函数另供写文件/CI 校验；register 支持 nodeSchema 精确描述业务字段，多树自动 oneOf。路由表重构为声明式 ROUTES（query spec 一处声明、运行时校验与文档生成两处消费）。
-   b622ecb: 首次发布 flextree-rest：FlexTreeManager/MultiRootFlexTreeManager 能力的 RESTful HTTP 暴露层。三层架构（FlexTreeApiService → WinterCG fetch Standard Handler → 框架 Routes 工厂），写队列串行（一请求一原子事务），25 个端点覆盖节点 CRUD/关系查询/结构动作/导出/回收站，express/hono/elysia/nextjs 四框架 routes 按需子路径引入（createExpressRoutes 等，flextree-rest/hono 子路径）。
