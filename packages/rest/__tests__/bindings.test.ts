/**
 * Binding 冒烟测试：hono/express/elysia 真实起服 + nextjs 直调 handler
 * 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { buildTree, createManager } from "./helpers";
import { createHonoRoutes } from "../src/bindings/hono";
import { createExpressRoutes } from "../src/bindings/express";
import { createElysiaRoutes } from "../src/bindings/elysia";
import { createNextjsHandler, type NextRouteContext } from "../src/bindings/nextjs";
import { FlexTreeApiService } from "../src/service";

let service: FlexTreeApiService;

beforeEach(async () => {
    const manager = await createManager();
    await buildTree(manager);
    service = new FlexTreeApiService();
    service.register("menu", manager as any);
});

/** 随机端口起服，返回 [fetch 包装, 关闭函数] */
async function listen(fetchFn: (req: Request) => Promise<Response>): Promise<{
    get: (path: string) => Promise<Response>;
    post: (path: string, body: unknown) => Promise<Response>;
    close: () => Promise<void>;
}> {
    const { createServer } = await import("node:http");
    const server = createServer(async (req, res) => {
        const base = `http://${req.headers.host}`;
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyStr = Buffer.concat(chunks).toString();
        const request = new Request(new URL(req.url!, base), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            ...(bodyStr ? { body: bodyStr } : {}),
        });
        const response = await fetchFn(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as any).port;
    const root = `http://127.0.0.1:${port}`;
    return {
        get: (path) => fetch(`${root}${path}`),
        post: (path, body) =>
            fetch(`${root}${path}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            }),
        close: () => new Promise<void>((r) => server.close(() => r())),
    };
}

describe("hono binding", () => {
    test("GET/POST 全链路", async () => {
        const app = await createHonoRoutes(service, { basePath: "/api/trees" });
        const srv = await listen((req) => app.fetch(req));
        try {
            const res = await srv.get("/api/trees/menu/nodes");
            expect(res.status).toBe(200);
            expect(await res.json()).toHaveLength(5);

            const r2 = await srv.post("/api/trees/menu/nodes", { nodes: [{ name: "NEW" }] });
            expect(r2.status).toBe(201);
            expect((await (await srv.get("/api/trees/menu/nodes")).json()).length).toBe(6);
        } finally {
            await srv.close();
        }
    });
});

describe("express binding", () => {
    test("GET/POST 全链路（含 express.json()）", async () => {
        // express 挂载已剥前缀（req.url 相对），不传 basePath
        const router = await createExpressRoutes(service);
        const express = await import("express");
        const app = express.default();
        app.use(express.default.json());
        app.use("/api/trees", router);

        const server = app.listen(0, "127.0.0.1");
        await new Promise<void>((r) => server.once("listening", r));
        const root = `http://127.0.0.1:${(server.address() as any).port}`;
        try {
            const res = await fetch(`${root}/api/trees/menu/nodes`);
            expect(res.status).toBe(200);
            expect(await res.json()).toHaveLength(5);

            const r2 = await fetch(`${root}/api/trees/menu/nodes`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ nodes: [{ name: "NEW" }] }),
            });
            expect(r2.status).toBe(201);
        } finally {
            await new Promise<void>((r) => server.close(() => r()));
        }
    });
});

describe("elysia binding", () => {
    test("GET/POST 全链路", async () => {
        const app = await createElysiaRoutes(service, { basePath: "/api/trees" });
        const res = await app.handle(
            new Request("http://x/api/trees/menu/nodes"),
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toHaveLength(5);
    });
});

describe("nextjs binding", () => {
    const ctxOf = (path: string): NextRouteContext => ({
        params: { path: path.split("/").filter(Boolean) },
    });

    test("对象形态 params（Next 14）", async () => {
        const handlers = createNextjsHandler(service);
        const res = await handlers.GET(new Request("http://x/ignored"), ctxOf("menu/nodes"));
        expect(res.status).toBe(200);
        expect(await res.json()).toHaveLength(5);
    });

    test("Promise 形态 params（Next 15）+ POST body 透传", async () => {
        const handlers = createNextjsHandler(service);
        const ctx: NextRouteContext = { params: Promise.resolve({ path: ["menu", "nodes"] }) };
        const res = await handlers.POST(
            new Request("http://x/ignored", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ nodes: [{ name: "NEW" }] }),
            }),
            ctx,
        );
        expect(res.status).toBe(201);
    });
});
