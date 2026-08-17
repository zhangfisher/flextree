/**
 * Express Binding：返回 express Router
 *
 * 手写 req → 标准 Request 转写。body 约定：宿主必须先挂 express.json()
 * （文档醒目说明）；req.body === undefined 且方法带 body 时返回 400
 * BODY_NOT_PARSED（提示性错误而非静默空 body）。
 *
 * 注意：app.use('/prefix', router) 挂载后 req.url 已是相对路径（框架已剥前缀），
 * 故无需 basePath；若宿主直接在根 app 上 use 则保持默认 ''。
 */
import { createHandler, type HandlerOptions } from "../handler";
import { RestError, toProblemResponse } from "../errors";
import type { FlexTreeApiService } from "../service";

export interface ExpressRoutesOptions extends HandlerOptions {}

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

/** 显式返回类型：Router 掌握在 express 手里，避免 dts 推断出不可移植的深层 @types 路径 */
export async function createExpressRoutes(
    service: FlexTreeApiService,
    options?: ExpressRoutesOptions,
): Promise<import("express").Router> {
    const express = await import("express");
    const handle = createHandler(service, options);
    const router = express.Router();

    router.all("*", async (req, res) => {
        try {
            // req.url 是相对路径，Request 构造需要绝对 URL
            const base = `http://${req.headers.host ?? "localhost"}`;
            const init: RequestInit = {
                method: req.method,
                headers: req.headers as Record<string, string>,
            };

            if (BODY_METHODS.has(req.method)) {
                if (req.body === undefined) {
                    const problem = toProblemResponse(
                        new RestError(
                            400,
                            "BODY_NOT_PARSED",
                            "Request body is not parsed: mount express.json() before this router",
                        ),
                        service.onError,
                    );
                    res.status(problem.status)
                        .set("content-type", "application/problem+json")
                        .send(await problem.text());
                    return;
                }
                init.body = JSON.stringify(req.body);
                init.headers = { ...init.headers, "content-type": "application/json" };
            }

            const request = new Request(new URL(req.url, base), init);
            const response = await handle(request);

            res.status(response.status);
            response.headers.forEach((v, k) => res.setHeader(k, v));
            const buf = Buffer.from(await response.arrayBuffer());
            res.end(buf);
        } catch (e) {
            const problem = toProblemResponse(e, service.onError);
            res.status(problem.status)
                .set("content-type", "application/problem+json")
                .send(await problem.text());
        }
    });

    return router;
}
