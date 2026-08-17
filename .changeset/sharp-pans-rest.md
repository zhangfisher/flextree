---
"flextree-rest": minor
---

首次发布 flextree-rest：FlexTreeManager/MultiRootFlexTreeManager 能力的 RESTful HTTP 暴露层。三层架构（FlexTreeApiService → WinterCG fetch Standard Handler → 框架 Routes 工厂），写队列串行（一请求一原子事务），25 个端点覆盖节点 CRUD/关系查询/结构动作/导出/回收站，express/hono/elysia/nextjs 四框架 routes 按需子路径引入（createExpressRoutes 等，flextree-rest/hono 子路径）。
