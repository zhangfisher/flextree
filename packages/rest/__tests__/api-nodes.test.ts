/**
 * 节点端点测试：nodes CRUD、关系子端点、展开参数
 * 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { buildTree, createManager, makeHandler } from "./helpers";

let h: ReturnType<typeof makeHandler>;

beforeEach(async () => {
    const manager = await createManager();
    await buildTree(manager);
    h = makeHandler("menu", manager, { fields: ["title", "size"] });
});

const nid = async (name: string) => {
    const nodes = await (await h.req("GET", "/menu/nodes")).json();
    return nodes.find((n: any) => n.name === name).id;
};

describe("GET /:tree/nodes", () => {
    test("全量返回", async () => {
        const nodes = await (await h.req("GET", "/menu/nodes")).json();
        expect(nodes).toHaveLength(5);
    });

    test("?level=0 ≡ 根列表", async () => {
        const nodes = await (await h.req("GET", "/menu/nodes?level=0")).json();
        expect(nodes).toHaveLength(1);
        expect(nodes[0].name).toBe("R");
    });

    test("where 白名单过滤生效", async () => {
        const nodes = await (await h.req("GET", "/menu/nodes?title=x")).json();
        expect(nodes).toHaveLength(0); // 无匹配
    });

    test("where 越界字段 → 400 FIELD_NOT_ALLOWED", async () => {
        const res = await h.req("GET", "/menu/nodes?hacked=1");
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("FIELD_NOT_ALLOWED");
    });

    test("未知参数 → 400（严格模式）", async () => {
        const res = await h.req("GET", "/menu/nodes?includeChildren=true");
        expect(res.status).toBe(400);
        // includeChildren 不在白名单字段里 → FIELD_NOT_ALLOWED（where 端点）
        expect((await res.json()).code).toBe("FIELD_NOT_ALLOWED");
    });
});

describe("POST /:tree/nodes", () => {
    test("at 指定 + pos=lastChild（默认）→ 201 + Location", async () => {
        const aId = await nid("A");
        const res = await h.req("POST", "/menu/nodes", {
            nodes: [{ name: "A3", title: "t" }],
            at: aId,
        });
        expect(res.status).toBe(201);
        expect(res.headers.get("location")).toBe(`/menu/nodes/${aId}`);
        expect((await (await h.req("GET", `/menu/nodes/${aId}/children`)).json())).toHaveLength(3);
    });

    test("pos=firstChild/nextSibling/previousSibling 四种映射", async () => {
        const aId = await nid("A");
        for (const pos of ["firstChild", "nextSibling", "previousSibling"]) {
            const res = await h.req("POST", "/menu/nodes", {
                nodes: [{ name: `X-${pos}` }],
                at: aId,
                pos,
            });
            expect(res.status).toBe(201);
        }
        const nodes = await (await h.req("GET", "/menu/nodes")).json();
        expect(nodes.find((n: any) => n.name === "X-firstChild").level).toBe(2);
        expect(nodes.find((n: any) => n.name === "X-nextSibling").level).toBe(1);
        expect(nodes.find((n: any) => n.name === "X-previousSibling").level).toBe(1);
    });

    test("pos 非法 → 400 INVALID_POS", async () => {
        const aId = await nid("A");
        const res = await h.req("POST", "/menu/nodes", {
            nodes: [{ name: "X" }],
            at: aId,
            pos: "top",
        });
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_POS");
    });

    test("at 缺省且单根树已有根 → 挂根下 LastChild", async () => {
        const res = await h.req("POST", "/menu/nodes", { nodes: [{ name: "C" }] });
        expect(res.status).toBe(201);
        const rootId = await nid("R");
        expect(res.headers.get("location")).toBe(`/menu/nodes/${rootId}`);
        const children = await (await h.req("GET", `/menu/nodes/${rootId}/children`)).json();
        expect(children.map((c: any) => c.name)).toEqual(["A", "B", "C"]);
    });

    test("at 缺省且空树 → createRoot 分支", async () => {
        const manager = await createManager();
        const h3 = makeHandler("empty", manager);
        const res = await h3.req("POST", "/empty/nodes", { nodes: [{ name: "ROOT" }] });
        expect(res.status).toBe(201);
        const nodes = await (await h3.req("GET", "/empty/nodes")).json();
        expect(nodes).toHaveLength(1);
        expect(nodes[0].name).toBe("ROOT");
        expect(nodes[0].level).toBe(0);
    });

    test("body 非法 → 400 INVALID_BODY", async () => {
        const res = await h.req("POST", "/menu/nodes", { nodes: "not-array" });
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_BODY");
    });

    test("validate hook 抛错 → 400 VALIDATION_FAILED", async () => {
        const manager = await createManager();
        await buildTree(manager);
        const hv = makeHandler("v", manager, {
            validate: (body) => {
                if ((body as any).nodes?.[0]?.size === undefined) {
                    throw new Error("size is required");
                }
            },
        });
        const res = await hv.req("POST", "/v/nodes", { nodes: [{ name: "X" }] });
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("VALIDATION_FAILED");
    });
});

describe("GET /:tree/nodes/:id 展开", () => {
    test("无展开：单节点", async () => {
        const aId = await nid("A");
        const node = await (await h.req("GET", `/menu/nodes/${aId}`)).json();
        expect(node.name).toBe("A");
    });

    test("includeChildren=true → +1 级 children", async () => {
        const rootId = await nid("R");
        const node = await (await h.req("GET", `/menu/nodes/${rootId}?includeChildren=true`)).json();
        expect(node.children).toHaveLength(2);
        expect(node.children[0].children).toBeUndefined();
    });

    test("includeDescendants=true → 全子树", async () => {
        const rootId = await nid("R");
        const node = await (await h.req("GET", `/menu/nodes/${rootId}?includeDescendants=true`)).json();
        expect(node.children).toHaveLength(2);
        expect(node.children.find((c: any) => c.name === "A").children).toHaveLength(2);
    });

    test("includeChildren + includeDescendants 同传 → 400", async () => {
        const rootId = await nid("R");
        const res = await h.req(
            "GET",
            `/menu/nodes/${rootId}?includeChildren=true&includeDescendants=true`,
        );
        expect(res.status).toBe(400);
    });

    test("无展开时 format → 400", async () => {
        const aId = await nid("A");
        const res = await h.req("GET", `/menu/nodes/${aId}?format=list`);
        expect(res.status).toBe(400);
    });

    test("includeChildren + format=list → 平铺", async () => {
        const rootId = await nid("R");
        const list = await (
            await h.req("GET", `/menu/nodes/${rootId}?includeChildren=true&format=list`)
        ).json();
        expect(Array.isArray(list)).toBe(true);
        expect(list).toHaveLength(3);
    });
});

describe("PATCH / DELETE 单节点", () => {
    test("PATCH 更新字段", async () => {
        const aId = await nid("A");
        const res = await h.req("PATCH", `/menu/nodes/${aId}`, { title: "new-title" });
        expect(res.status).toBe(200);
        const node = await res.json();
        expect(node.title).toBe("new-title");
    });

    test("DELETE 物理删除 → 204", async () => {
        const bId = await nid("B");
        const res = await h.req("DELETE", `/menu/nodes/${bId}`);
        expect(res.status).toBe(204);
        expect(await (await h.req("GET", `/menu/nodes/${bId}`)).status).toBe(404);
    });

    test("不存在的节点 → 404 NODE_NOT_FOUND", async () => {
        const res = await h.req("GET", "/menu/nodes/9999");
        expect(res.status).toBe(404);
        expect((await res.json()).code).toBe("NODE_NOT_FOUND");
    });
});

describe("关系子端点", () => {
    test("children / descendants / descendants/count", async () => {
        const rootId = await nid("R");
        expect(await (await h.req("GET", `/menu/nodes/${rootId}/children`)).json()).toHaveLength(2);
        expect(await (await h.req("GET", `/menu/nodes/${rootId}/descendants`)).json()).toHaveLength(4);
        expect(await (await h.req("GET", `/menu/nodes/${rootId}/descendants/count`)).json()).toEqual({ count: 4 });
    });

    test("descendants?includeSelf=true / ?level=1", async () => {
        const rootId = await nid("R");
        expect(
            await (await h.req("GET", `/menu/nodes/${rootId}/descendants?includeSelf=true`)).json(),
        ).toHaveLength(5);
        expect(
            await (await h.req("GET", `/menu/nodes/${rootId}/descendants?level=1`)).json(),
        ).toHaveLength(2);
    });

    test("ancestors / ancestors count / parent", async () => {
        const a1 = await nid("A1");
        expect(await (await h.req("GET", `/menu/nodes/${a1}/ancestors`)).json()).toHaveLength(2);
        expect(await (await h.req("GET", `/menu/nodes/${a1}/ancestors/count`)).json()).toEqual({ count: 2 });
        const parent = await (await h.req("GET", `/menu/nodes/${a1}/parent`)).json();
        expect(parent.name).toBe("A");
    });

    test("siblings / nextsibling / previoussibling", async () => {
        const a1 = await nid("A1");
        const a2 = await nid("A2");
        expect(await (await h.req("GET", `/menu/nodes/${a1}/siblings`)).json()).toHaveLength(1);
        const next = await (await h.req("GET", `/menu/nodes/${a1}/nextsibling`)).json();
        expect(next.name).toBe("A2");
        const prev = await (await h.req("GET", `/menu/nodes/${a2}/previoussibling`)).json();
        expect(prev.name).toBe("A1");
    });

    test("children/:n（1-based 与负数）", async () => {
        const rootId = await nid("R");
        const first = await (await h.req("GET", `/menu/nodes/${rootId}/children/1`)).json();
        expect(first.name).toBe("A");
        const last = await (await h.req("GET", `/menu/nodes/${rootId}/children/-1`)).json();
        expect(last.name).toBe("B");
    });

    test("children/0 → 400；越界 → 404", async () => {
        const rootId = await nid("R");
        expect((await h.req("GET", `/menu/nodes/${rootId}/children/0`)).status).toBe(400);
        expect((await h.req("GET", `/menu/nodes/${rootId}/children/9`)).status).toBe(404);
    });

    test("countField 生效（每个节点附后代计数）", async () => {
        const rootId = await nid("R");
        const nodes = await (
            await h.req("GET", `/menu/nodes/${rootId}/children?countField=desc`)
        ).json();
        expect(nodes[0].desc).toBe(2); // A 有 2 个后代
        expect(nodes[1].desc).toBe(0); // B
    });

    test("关系端点不支持 fields → 400（严格模式）", async () => {
        const rootId = await nid("R");
        const res = await h.req("GET", `/menu/nodes/${rootId}/children?fields=id`);
        expect(res.status).toBe(400);
    });
});

describe("GET /:tree/nodes 分页（Offset Pagination）", () => {
    test("?limit=2 → envelope，items 为前 2 个", async () => {
        const body = await (await h.req("GET", "/menu/nodes?limit=2")).json();
        expect(body).toEqual({ items: [body.items[0], body.items[1]], total: 5, limit: 2, offset: 0 });
        expect(body.items.map((n: any) => n.name)).toEqual(["R", "A"]);
    });

    test("?limit=2&offset=2 → 第 3-4 个", async () => {
        const body = await (await h.req("GET", "/menu/nodes?limit=2&offset=2")).json();
        expect(body.items.map((n: any) => n.name)).toEqual(["A1", "A2"]);
        expect(body.total).toBe(5);
        expect(body.offset).toBe(2);
    });

    test("不带分页参数 → 裸数组（v1 兼容）", async () => {
        const res = await h.req("GET", "/menu/nodes");
        expect(Array.isArray(await res.json())).toBe(true);
    });

    test("只带 offset 不带 limit → 400", async () => {
        const res = await h.req("GET", "/menu/nodes?offset=2");
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("UNKNOWN_PARAM");
    });

    test("limit=0/-1/1.5/abc → 400", async () => {
        for (const bad of ["0", "-1", "1.5", "abc"]) {
            expect((await h.req("GET", `/menu/nodes?limit=${bad}`)).status).toBe(400);
        }
    });

    test("offset=-1 → 400；offset=0 显式合法", async () => {
        expect((await h.req("GET", "/menu/nodes?limit=1&offset=-1")).status).toBe(400);
        const res = await h.req("GET", "/menu/nodes?limit=1&offset=0");
        expect(res.status).toBe(200);
        expect((await res.json()).offset).toBe(0);
    });

    test("offset 超出 total → items 空", async () => {
        const body = await (await h.req("GET", "/menu/nodes?limit=2&offset=99")).json();
        expect(body.items).toEqual([]);
        expect(body.total).toBe(5);
    });

    test("与 where 组合：total 为过滤后全量", async () => {
        const body = await (await h.req("GET", "/menu/nodes?level=1&limit=1")).json();
        expect(body.total).toBe(2);
        expect(body.items).toHaveLength(1);
    });

    test("分页不减少查询的边界提示由文档承载（此处验证与 includeRecyclebin 正交）", async () => {
        const body = await (await h.req("GET", "/menu/nodes?limit=3&includeRecyclebin=true")).json();
        expect(body.total).toBe(5);
    });
});
