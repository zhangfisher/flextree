# REST Provider 采用三层架构（Fetch 核心 + 框架 Binding）

flextree-rest 需要在 express/hono/elysiajs/nextjs 等框架中集成，我们决定采用三层架构：① `FlexTreeApiService`（纯逻辑核心，输入输出为普通对象，无 HTTP 概念）→ ② Standard Handler 层（基于 WinterCG Fetch API 的 `(Request) => Promise<Response>` 纯函数 + 声明式路由表，自研 50 行内 mini router，零运行时依赖）→ ③ 各框架 Routes 工厂（把框架请求/响应转写为标准 Request/Response 的薄层，如 createHonoRoutes）。所有业务逻辑只写一遍，新框架集成只需一个 binding（预期 <100 行/框架）。

Routes 工厂不创建框架实例，只返回**框架原生路由形态**（hono 子应用、express Router、elysia 插件、nextjs handler 映射），挂载路径与方式由宿主决定——库不预设部署形态。

## Considered Options

- **路由声明表 + 各框架重复实现参数解析**：被否决。每框架重复实现 handler，DRY 尽失，且 hono/elysia 的类型推导会丢失。
- **每框架独立包、无共享核心**：被否决。维护成本线性增长，行为漂移不可避免。
- **Routes 工厂返回可直接监听的服务/子应用实例**：被否决。暗示库自带部署形态，越出“库”的边界（同 Q5 纯库定位）。

## Consequences

- 测试红利：Standard Handler 层直接以 fetch Request/Response 测试，无需起服务器。
- binding 返回 hono 子应用时，`app.route()` 挂载是 hono idiomatic 用法；express 返回 Router 同理。
- Next.js binding 需注意：App Router 的 route handler（`export async function GET(request: Request)`）本身就是 fetch 签名，Standard Handler 可**直接导出**（`export const GET = withTree(...)` 形态），binding 工作量趋近于零——这是三层架构的额外红利。
- elysia 需要独立评估其类型系统（t.Prop 深度对齐 manager 泛型）的集成深度，v1 做薄 binding（请求转写），类型深度集成留待 v2。
