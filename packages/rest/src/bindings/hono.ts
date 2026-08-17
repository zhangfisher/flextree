/**
 * Hono Binding：返回可直接 app.route() 挂载的 Hono 子应用
 *
 * 按需引入：import { createHonoRoutes } from "flextree-rest/hono"
 * hono 原生 WinterCG fetch API（c.req.raw 即标准 Request），零转写成本。
 * 框架为可选 peer：动态 import，工厂为 async。
 *
 * 注意：app.route('/prefix', subApp) 挂载后 c.req.raw 的 pathname 仍含 /prefix，
 * 故 basePath 需与挂载前缀一致（默认 ''：pathname 即相对路径）。
 */
import { createHandler, type HandlerOptions } from "../handler";
import type { FlexTreeApiService } from "../service";

export interface HonoRoutesOptions extends HandlerOptions {}

export async function createHonoRoutes(service: FlexTreeApiService, options?: HonoRoutesOptions) {
    const { Hono } = await import("hono");
    const handle = createHandler(service, options);
    const app = new Hono();
    // 挂载点后的所有路径交给 Standard Handler
    app.all("*", (c) => handle(c.req.raw));
    return app;
}
