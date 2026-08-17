/**
 * mini router 单元测试（无 DB）
 */
import { describe, test, expect } from "bun:test";
import { Router } from "../src/router";
import { RestError } from "../src/errors";

const ok = () => Response.json({ ok: true });

describe("Router", () => {
    test("静态段匹配", () => {
        const r = new Router();
        r.add("GET", "/:tree/nodes", ok);
        const m = r.match("GET", "/menu/nodes");
        expect(m.params.tree).toBe("menu");
    });

    test("多参数段嵌套匹配", () => {
        const r = new Router();
        r.add("GET", "/:tree/nodes/:id/children/:n", ok);
        const m = r.match("GET", "/menu/nodes/5/children/-1");
        expect(m.params).toEqual({ tree: "menu", id: "5", n: "-1" });
    });

    test("静态段不匹配返回 null 路径 → 404", () => {
        const r = new Router();
        r.add("GET", "/:tree/nodes/:id", ok);
        expect(() => r.match("GET", "/menu/nodes")).toThrow();
        try {
            r.match("GET", "/menu/unknown");
        } catch (e) {
            expect(e).toBeInstanceOf(RestError);
            expect((e as RestError).status).toBe(404);
            expect((e as RestError).code).toBe("ROUTE_NOT_FOUND");
        }
    });

    test("路径命中但方法不匹配 → 405", () => {
        const r = new Router();
        r.add("GET", "/:tree/nodes", ok);
        r.add("POST", "/:tree/nodes", ok);
        try {
            r.match("DELETE", "/menu/nodes");
            expect.unreachable();
        } catch (e) {
            expect((e as RestError).status).toBe(405);
            expect((e as RestError).code).toBe("METHOD_NOT_ALLOWED");
        }
    });

    test("根路径匹配", () => {
        const r = new Router();
        r.add("GET", "/", ok);
        const m = r.match("GET", "/");
        expect(m.params).toEqual({});
    });

    test("descendants 优先于 descendants/count 由静态段区分", () => {
        const r = new Router();
        r.add("GET", "/:tree/nodes/:id/descendants", ok);
        r.add("GET", "/:tree/nodes/:id/descendants/count", ok);
        const a = r.match("GET", "/t/nodes/1/descendants");
        const b = r.match("GET", "/t/nodes/1/descendants/count");
        expect(a.params).not.toHaveProperty("count");
        expect(b.params).toEqual({ tree: "t", id: "1" });
    });
});
