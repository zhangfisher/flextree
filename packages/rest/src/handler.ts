/**
 * Standard Handler：基于 WinterCG Fetch API 的请求入口（ADR-0008 第②层）
 *
 * 输入标准 Request，输出标准 Response；各框架 Binding 统一委托给它。
 */
import { toProblemResponse, RestError } from "./errors";
import { createRouter } from "./routes";
import type { FlexTreeApiService } from "./service";

export interface HandlerOptions {
    /**
     * 路径前缀（含宿主挂载点）。如 hono 挂在 /api/trees 时传 "/api/trees"。
     * 默认 ""（pathname 即相对路径）。
     */
    basePath?: string;
}

export function createHandler(service: FlexTreeApiService, options?: HandlerOptions) {
    const router = createRouter();
    const basePath = (options?.basePath ?? "").replace(/\/+$/, "");

    return async function handle(request: Request): Promise<Response> {
        try {
            const url = new URL(request.url);
            let pathname = url.pathname;
            if (basePath) {
                if (!pathname.startsWith(basePath + "/") && pathname !== basePath) {
                    return toProblemResponse(
                        new RestError(404, "ROUTE_NOT_FOUND", `Path is outside basePath "${basePath}"`),
                        service.onError,
                    );
                }
                pathname = pathname.slice(basePath.length) || "/";
            }
            const { params, handler } = router.match(request.method, pathname);
            return await handler({
                request,
                url,
                params,
                query: url.searchParams,
                service,
            });
        } catch (e) {
            // router 的 404/405 与业务错误统一走 problem+json
            return toProblemResponse(e, service.onError);
        }
    };
}
