/**
 * 树级端点测试：GET /、GET|DELETE /:tree、verify、repair
 * 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { buildTree, createManager, getDriver, makeHandler } from "./helpers";

let h: ReturnType<typeof makeHandler>;

beforeEach(async () => {
    const manager = await createManager();
    await buildTree(manager);
    h = makeHandler("menu", manager, { fields: ["title", "size"] });
});

describe("GET /", () => {
    test("返回注册树列表", async () => {
        const res = await h.req("GET", "/");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.trees).toHaveLength(1);
        expect(body.trees[0]).toMatchObject({ name: "menu", multiRoot: false });
    });
});

describe("GET /:tree", () => {
    test("format=json（默认）：嵌套树", async () => {
        const res = await h.req("GET", "/menu");
        const body = await res.json();
        expect(body.name).toBe("menu");
        expect(body.recyclebinEnabled).toBe(false);
        expect(body.data.name).toBe("R");
        expect(body.data.children).toHaveLength(2);
    });

    test("format=list：平铺", async () => {
        const res = await h.req("GET", "/menu?format=list");
        const body = await res.json();
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data.length).toBe(5);
    });

    test("format 非法值 → 400", async () => {
        const res = await h.req("GET", "/menu?format=xml");
        expect(res.status).toBe(400);
    });

    test("未注册树 → 404 TREE_NOT_FOUND", async () => {
        const res = await h.req("GET", "/nope");
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.code).toBe("TREE_NOT_FOUND");
    });
});

describe("POST /:tree/verify", () => {
    test("正常树 → valid:true", async () => {
        const res = await h.req("POST", "/menu/verify");
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ valid: true, errors: [] });
    });

    test("坏树 → 200 valid:false + errors（不抛 500）", async () => {
        const driver = getDriver();
        await driver.exec([`UPDATE tree SET rightValue = 99 WHERE name = 'A1'`]);
        const res = await h.req("POST", "/menu/verify");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.valid).toBe(false);
        expect(body.errors.length).toBeGreaterThan(0);
    });
});

describe("POST /:tree/repair + DELETE /:tree", () => {
    test("坏树 repair 后 verify 恢复", async () => {
        const driver = getDriver();
        await driver.exec([`UPDATE tree SET leftValue = 50, rightValue = 51 WHERE name = 'B'`]);
        expect((await (await h.req("POST", "/menu/verify")).json()).valid).toBe(false);

        const res = await h.req("POST", "/menu/repair");
        expect(res.status).toBe(200);
        expect((await (await h.req("POST", "/menu/verify")).json()).valid).toBe(true);
    });

    test("DELETE 清空整树 → 204，节点全无", async () => {
        const res = await h.req("DELETE", "/menu");
        expect(res.status).toBe(204);
        const nodes = await (await h.req("GET", "/menu/nodes")).json();
        expect(nodes).toHaveLength(0);
    });
});
