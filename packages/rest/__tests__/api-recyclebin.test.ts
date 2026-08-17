/**
 * 回收站端点测试：?recycle、/recyclebin、恢复、409
 * 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { buildTree, createManager, makeHandler } from "./helpers";

let h: ReturnType<typeof makeHandler>;

beforeEach(async () => {
    const manager = await createManager({ recyclebin: true });
    await buildTree(manager);
    h = makeHandler("menu", manager);
});

const nid = async (name: string, includeRecyclebin = false) => {
    const nodes = await (
        await h.req("GET", `/menu/nodes${includeRecyclebin ? "?includeRecyclebin=true" : ""}`)
    ).json();
    return nodes.find((n: any) => n.name === name).id;
};

describe("DELETE ?recycle=true", () => {
    test("回收后默认视角不可见、recyclebin 可见", async () => {
        const bId = await nid("B");
        const res = await h.req("DELETE", `/menu/nodes/${bId}?recycle=true`);
        expect(res.status).toBe(204);

        expect((await (await h.req("GET", `/menu/nodes/${bId}`)).status)).toBe(404);
        const nodes = await (await h.req("GET", "/menu/nodes")).json();
        expect(nodes.find((n: any) => n.name === "B")).toBeUndefined();

        const bin = await (await h.req("GET", "/menu/recyclebin")).json();
        expect(bin.find((n: any) => n.name === "B")).toBeDefined();
    });

    test("GET nodes?includeRecyclebin=true 照常可见", async () => {
        const bId = await nid("B");
        await h.req("DELETE", `/menu/nodes/${bId}?recycle=true`);
        const nodes = await (await h.req("GET", "/menu/nodes?includeRecyclebin=true")).json();
        expect(nodes.find((n: any) => n.name === "B")).toBeDefined();
    });
});

describe("恢复：move + includeRecyclebin", () => {
    test("站内节点移出回到树", async () => {
        const bId = await nid("B");
        await h.req("DELETE", `/menu/nodes/${bId}?recycle=true`);

        const rootId = await nid("R");
        const res = await h.req("POST", `/menu/nodes/${bId}/move`, {
            to: rootId,
            pos: "lastChild",
            includeRecyclebin: true,
        });
        expect(res.status).toBe(200);

        const nodes = await (await h.req("GET", "/menu/nodes")).json();
        expect(nodes.find((n: any) => n.name === "B")).toBeDefined();
        const bin = await (await h.req("GET", "/menu/recyclebin")).json();
        expect(bin.find((n: any) => n.name === "B")).toBeUndefined();
    });

    test("默认视角 move 站内节点 → 404", async () => {
        const bId = await nid("B");
        await h.req("DELETE", `/menu/nodes/${bId}?recycle=true`);
        const rootId = await nid("R");
        const res = await h.req("POST", `/menu/nodes/${bId}/move`, {
            to: rootId,
            pos: "lastChild",
        });
        expect(res.status).toBe(404);
    });
});

describe("DELETE /:tree/recyclebin", () => {
    test("永久清空", async () => {
        const bId = await nid("B");
        await h.req("DELETE", `/menu/nodes/${bId}?recycle=true`);
        const res = await h.req("DELETE", "/menu/recyclebin");
        expect(res.status).toBe(204);
        expect(await (await h.req("GET", "/menu/recyclebin")).json()).toHaveLength(0);
    });
});

describe("未启用回收站 → 409", () => {
    test("recyclebin 端点 409 RECYCLEBIN_NOT_ENABLED", async () => {
        const plain = await createManager();
        await buildTree(plain);
        const hp = makeHandler("plain", plain);
        const res = await hp.req("GET", "/plain/recyclebin");
        expect(res.status).toBe(409);
        expect((await res.json()).code).toBe("RECYCLEBIN_NOT_ENABLED");
    });
});
