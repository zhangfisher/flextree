/**
 * Elysia Binding：返回 Elysia 实例（可 .use 到宿主）
 *
 * ctx.request 是 WinterCG 标准 Request，直接透传 Standard Handler。
 * 注意：elysia 的 prefix + 通配叠加不匹配（实测 404），故不使用 prefix；
 * 挂载前缀由宿主决定（宿主 app.use('/prefix', plugin) 或本实例直接 handle）。
 * v1 为薄转写 binding；t.Prop 深度类型集成留 v2（ADR-0008）。
 */
import { createHandler, type HandlerOptions } from "../handler";
import type { FlexTreeApiService } from "../service";

export interface ElysiaRoutesOptions extends HandlerOptions {}

export async function createElysiaRoutes(
    service: FlexTreeApiService,
    options?: ElysiaRoutesOptions,
) {
    const { Elysia } = await import("elysia");
    const handle = createHandler(service, { basePath: options?.basePath });

    return new Elysia().onRequest(async (ctx) => await handle(ctx.request));
}
