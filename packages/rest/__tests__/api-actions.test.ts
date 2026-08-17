/**
 * 动作端点测试：move/copy/moveup/movedown/canmoveto
 * 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { buildTree, createManager, makeHandler } from "./helpers";

let h: ReturnType<typeof makeHandler>;

beforeEach(async () => {
    const manager = await createManager();
    await buildTree(manager);
    h = makeHandler("menu", manager);
});

const nid = async (name: string) => {
    const nodes = await (await h.req("GET", "/menu/nodes")).json();
    return nodes.find((n: any) => n.name === name).id;
};

describe("POST .../move", () => {
    test("移到 A 之下 LastChild", async () => {
        const bId = await nid("B");
        const aId = await nid("A");
        const res = await h.req("POST", `/menu/nodes/${bId}/move`, { to: aId, pos: "lastChild" });
        expect(res.status).toBe(200);
        const children = await (await h.req("GET", `/menu/nodes/${aId}/children`)).json();
        expect(children.map((c: any) => c.name)).toEqual(["A1", "A2", "B"]);
    });

    test("移到根 nextSibling", async () => {
        const bId = await nid("B");
        const aId = await nid("A");
        const res = await h.req("POST", `/menu/nodes/${bId}/move`, { to: aId, pos: "nextSibling" });
        expect(res.status).toBe(200);
        // B 移到 A 后面（原本就在后面，位置不变），结构完好
        expect((await (await h.req("POST", "/menu/verify")).json()).valid).toBe(true);
    });

    test("非法移动（移到自己后代下）→ 422", async () => {
        const rootId = await nid("R");
        const aId = await nid("A");
        const res = await h.req("POST", `/menu/nodes/${rootId}/move`, { to: aId, pos: "lastChild" });
        expect(res.status).toBe(422);
        expect((await res.json()).code).toBe("NODE_INVALID_OPERATION");
    });
});

describe("POST .../copy", () => {
    test("复制 A 含后代 → 201 + 副本根", async () => {
        const aId = await nid("A");
        const bId = await nid("B");
        const res = await h.req("POST", `/menu/nodes/${aId}/copy`, {
            to: bId,
            pos: "lastChild",
            includeDescendants: true,
        });
        expect(res.status).toBe(201);
        const copyRoot = await res.json();
        expect(copyRoot.name).toBe("A");
        expect(copyRoot.id).not.toBe(aId);
        const children = await (await h.req("GET", `/menu/nodes/${copyRoot.id}/children`)).json();
        expect(children.map((c: any) => c.name)).toEqual(["A1", "A2"]);
    });

    test("不含后代复制", async () => {
        const aId = await nid("A");
        const res = await h.req("POST", `/menu/nodes/${aId}/copy`, { includeDescendants: false });
        expect(res.status).toBe(201);
        const copyRoot = await res.json();
        expect(await (await h.req("GET", `/menu/nodes/${copyRoot.id}/children`)).json()).toHaveLength(0);
    });
});

describe("POST .../moveup / movedown", () => {
    test("moveup 交换顺序", async () => {
        const a1 = await nid("A1");
        const res = await h.req("POST", `/menu/nodes/${a1}/moveup`);
        expect(res.status).toBe(200);
        const first = await (await h.req("GET", `/menu/nodes/${a1}/previoussibling`)).json();
        expect(first).toBeNull(); // 已是第一个
    });

    test("movedown", async () => {
        const a1 = await nid("A1");
        const res = await h.req("POST", `/menu/nodes/${a1}/movedown`);
        expect(res.status).toBe(200);
        const children = await (await h.req("GET", `/menu/nodes/${await nid("A")}/children`)).json();
        expect(children.map((c: any) => c.name)).toEqual(["A2", "A1"]);
    });
});

describe("GET .../canmoveto", () => {
    test("合法移动 → allowed:true", async () => {
        const bId = await nid("B");
        const aId = await nid("A");
        const res = await h.req("GET", `/menu/nodes/${bId}/canmoveto?to=${aId}&pos=lastChild`);
        expect(await res.json()).toEqual({ allowed: true });
    });

    test("非法移动（后代落点）→ allowed:false", async () => {
        const rootId = await nid("R");
        const aId = await nid("A");
        const res = await h.req("GET", `/menu/nodes/${rootId}/canmoveto?to=${aId}&pos=lastChild`);
        expect(await res.json()).toEqual({ allowed: false });
    });
});
