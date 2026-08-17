/**
 * Next.js Binding：App Router catch-all route handler 工厂
 *
 * 用法（app/api/trees/[...path]/route.ts）：
 *   export const { GET, POST, PATCH, DELETE } = createNextjsHandler(service)
 *
 * 零 next import（结构化类型），无 peer 依赖。
 * Next 14 params 是对象、Next 15 是 Promise，两者兼容。
 * catch-all 段数组天然相对，无 basePath 问题。
 */
import { createHandler } from "../handler";
import type { FlexTreeApiService } from "../service";

/** Next.js route context（结构化，不依赖 next 类型） */
export interface NextRouteContext {
    params: { path: string[] } | Promise<{ path: string[] }>;
}

type NextRouteHandler = (request: Request, ctx: NextRouteContext) => Promise<Response>;

export function createNextjsHandler(service: FlexTreeApiService): {
    GET: NextRouteHandler;
    POST: NextRouteHandler;
    PATCH: NextRouteHandler;
    PUT: NextRouteHandler;
    DELETE: NextRouteHandler;
} {
    const handle = createHandler(service);

    const toRequest = async (request: Request, ctx: NextRouteContext): Promise<Request> => {
        // Next 14 params 是对象、Next 15 是 Promise——统一 await 化（对象 await 后原样返回）
        const params = await ctx.params;
        const path = (params?.path ?? []).map((s: string) => encodeURIComponent(s)).join("/");
        // 以 catch-all 段重建相对 URL（方法/头/body 原样透传）
        return new Request(new URL(`/${path}${new URL(request.url).search}`, "http://localhost"), {
            method: request.method,
            headers: request.headers,
            body: request.body,
            // @ts-ignore duplex 仅在带流的 body 时需要，Node/Bun 运行时识别
            duplex: "half",
        });
    };

    const handler: NextRouteHandler = async (request, ctx) => {
        return handle(await toRequest(request, ctx));
    };

    return {
        GET: handler,
        POST: handler,
        PATCH: handler,
        PUT: handler,
        DELETE: handler,
    };
}
