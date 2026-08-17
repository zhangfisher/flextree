/**
 * 双 manager 测试：MultiRootFlexTreeManager 的行为差异
 * - POST /nodes at 缺省 = 新用户根
 * - ?level=0 = 用户根数组（隐藏根不可见）
 * - children/{n} 降级 getChildren 实现
 * - toJson 返回多根数组
 * 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { createMultiRootManager, makeHandler } from "./helpers";

let h: ReturnType<typeof makeHandler>;

beforeEach(async () => {
    const manager = await createMultiRootManager();
    h = makeHandler("m", manager);
});

describe("多根树注册与判定", () => {
    test("GET / 标记 multiRoot:true", async () => {
        const body = await (await h.req("GET", "/")).json();
        expect(body.trees[0].multiRoot).toBe(true);
    });

    test("GET /:tree data 为多根数组", async () => {
        const body = await (await h.req("GET", "/m")).json();
        expect(Array.isArray(body.data)).toBe(true);
    });
});

describe("POST /nodes at 缺省 = 新用户根", () => {
    test("空表顶层添加两个用户根", async () => {
        const r1 = await h.req("POST", "/m/nodes", { nodes: [{ name: "T1" }] });
        expect(r1.status).toBe(201);
        const r2 = await h.req("POST", "/m/nodes", { nodes: [{ name: "T2" }] });
        expect(r2.status).toBe(201);

        const roots = await (await h.req("GET", "/m/nodes?level=0")).json();
        expect(roots.map((n: any) => n.name)).toEqual(["T1", "T2"]);
        // 用户根对外 level=0（Level Normalization）
        expect(roots.every((n: any) => n.level === 0)).toBe(true);
    });

    test("批量顶层添加", async () => {
        const res = await h.req("POST", "/m/nodes", {
            nodes: [{ name: "T1" }, { name: "T2" }],
        });
        expect(res.status).toBe(201);
        expect(await (await h.req("GET", "/m/nodes?level=0")).json()).toHaveLength(2);
    });
});

describe("children/{n} 降级", () => {
    test("与 getNthChild 语义一致（1-based、负从尾）", async () => {
        await h.req("POST", "/m/nodes", { nodes: [{ name: "T1", children: [{ name: "C1" }, { name: "C2" }] }] });
        const roots = await (await h.req("GET", "/m/nodes?level=0")).json();
        const t1 = roots[0].id;

        const first = await (await h.req("GET", `/m/nodes/${t1}/children/1`)).json();
        expect(first.name).toBe("C1");
        const last = await (await h.req("GET", `/m/nodes/${t1}/children/-1`)).json();
        expect(last.name).toBe("C2");
    });
});

describe("常规操作在多根树上", () => {
    test("children/descendants/parent 正常", async () => {
        await h.req("POST", "/m/nodes", { nodes: [{ name: "T1", children: [{ name: "C1" }] }] });
        const roots = await (await h.req("GET", "/m/nodes?level=0")).json();
        const t1 = roots[0].id;

        expect(await (await h.req("GET", `/m/nodes/${t1}/children`)).json()).toHaveLength(1);
        expect(await (await h.req("GET", `/m/nodes/${t1}/descendants`)).json()).toHaveLength(1);
        const c1 = (await (await h.req("GET", `/m/nodes/${t1}/children`)).json())[0];
        const parent = await (await h.req("GET", `/m/nodes/${c1.id}/parent`)).json();
        expect(parent.name).toBe("T1");
    });

    test("moveup 用户根", async () => {
        await h.req("POST", "/m/nodes", { nodes: [{ name: "T1" }, { name: "T2" }] });
        const roots = await (await h.req("GET", "/m/nodes?level=0")).json();
        const t2 = roots.find((n: any) => n.name === "T2");
        const res = await h.req("POST", `/m/nodes/${t2.id}/moveup`);
        expect(res.status).toBe(200);
        const after = await (await h.req("GET", "/m/nodes?level=0")).json();
        expect(after.map((n: any) => n.name)).toEqual(["T2", "T1"]);
    });
});
