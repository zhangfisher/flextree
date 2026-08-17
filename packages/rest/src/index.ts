/**
 * flextree-rest：FlexTreeManager 能力的 RESTful HTTP 暴露层
 *
 * 三层架构（ADR-0008）：
 *   FlexTreeApiService（业务核心）→ Standard Handler（fetch 纯函数）
 *   → 框架 Routes（flextree-rest/hono 等子路径按需引入）
 * 写队列（ADR-0009）：一请求一原子事务，同树写请求串行。
 *
 * 框架 routes 不在此集中导出（按需子路径导入，避免把未使用的框架卷进构建）：
 *   import { createHonoRoutes } from "flextree-rest/hono"
 *   import { createExpressRoutes } from "flextree-rest/express"
 *   import { createElysiaRoutes } from "flextree-rest/elysia"
 *   import { createNextjsHandler } from "flextree-rest/nextjs"
 */
export { FlexTreeApiService, type FlexTreeApiServiceOptions } from "./service";
export { createHandler, type HandlerOptions } from "./handler";
export { TreeRegistry, type RegistryEntry } from "./registry";
export { WriteQueue } from "./write-queue";
export {
    RestError,
    TreeNotRegisteredError,
    toProblemResponse,
    toProblemDetail,
    type ProblemDetail,
    type ErrorNormalizer,
} from "./errors";
export type { TreeManagerLike, RegisterOptions, PosString } from "./types";
