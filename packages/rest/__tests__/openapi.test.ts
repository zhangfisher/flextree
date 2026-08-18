/**
 * OpenAPI 文档生成测试（无 DB）
 * 覆盖：骨架、path/query 参数、分页 oneOf、nodeSchema 覆盖、多树、内置路由
 */
import { describe, test, expect } from "bun:test";
import { FlexTreeApiService, generateOpenApiDocument, createHandler } from "../src";
import type { TreeManagerLike } from "../src/types";

const fakeManager = {
    keyFields: { id: "id", name: "name", level: "level", treeId: "treeId" },
    recycleBinEnabled: false,
} as unknown as TreeManagerLike;

function serviceOf(opts?: ConstructorParameters<typeof FlexTreeApiService>[0]) {
    const s = new FlexTreeApiService(opts);
    s.register("menu", fakeManager);
    return s;
}

describe("文档骨架", () => {
    test("openapi 3.1.0 + info 默认值与覆盖 + servers 透传", () => {
        const doc = generateOpenApiDocument(serviceOf());
        expect(doc.openapi).toBe("3.1.0");
        expect((doc.info as any).title).toBe("flextree-rest API");

        const doc2 = generateOpenApiDocument(serviceOf(), {
            info: { title: "我的树", version: "2.0" },
            servers: [{ url: "https://api.example.com/api/trees" }],
        });
        expect((doc2.info as any).title).toBe("我的树");
        expect((doc2.info as any).version).toBe("2.0");
        expect(doc2.servers).toEqual([{ url: "https://api.example.com/api/trees" }]);
    });

    test("paths 覆盖全部路由（含 :name→{name} 转换）", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const paths = Object.keys(doc.paths as object);
        expect(paths).toContain("/");
        expect(paths).toContain("/{tree}");
        expect(paths).toContain("/{tree}/nodes");
        expect(paths).toContain("/{tree}/nodes/{id}");
        expect(paths).toContain("/{tree}/nodes/{id}/children/{n}");
        expect(paths).toContain("/{tree}/nodes/{id}/descendants/count");
        expect(paths).toContain("/{tree}/recyclebin");
        expect(paths).toContain("/openapi.json");
        // 26 条路由、descendants 与 count 分列 → path key ≥ 17
        expect(paths.length).toBeGreaterThanOrEqual(17);
    });

    test("同 path 多 method 合并（/:tree 下 GET+DELETE）", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const tree = (doc.paths as any)["/{tree}"];
        expect(Object.keys(tree)).toEqual(["get", "delete"]);
    });
});

describe("参数生成", () => {
    test("path 参数：tree/id/n 的 schema 与 required", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const op = (doc.paths as any)["/{tree}/nodes/{id}/children/{n}"].get;
        const pathParams = (op.parameters as any[]).filter((p) => p.in === "path");
        const byName = Object.fromEntries(pathParams.map((p) => [p.name, p]));
        expect(byName.tree.schema).toEqual({ type: "string" });
        expect(byName.id.schema).toEqual({ type: ["string", "integer"] });
        expect(byName.n.schema).toEqual({ type: "integer" });
        expect(pathParams.every((p) => p.required === true)).toBe(true);
    });

    test("query 参数：limit/offset 为 integer 且带 minimum", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const op = (doc.paths as any)["/{tree}/nodes"].get;
        const qs = (op.parameters as any[]).filter((p) => p.in === "query");
        const byName = Object.fromEntries(qs.map((p) => [p.name, p]));
        expect(byName.level.schema).toEqual({ type: "number" });
        expect(byName.fields.schema).toEqual({ type: "array", items: { type: "string" } });
        expect(byName.includeRecyclebin.schema).toEqual({ type: "boolean" });
        expect(byName.limit.schema).toEqual({ type: "integer", minimum: 1 });
        expect(byName.offset.schema).toEqual({ type: "integer", minimum: 0 });
        expect(qs.every((p) => p.required === false)).toBe(true);
    });

    test("enum 参数：GET /{tree} 的 format", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const op = (doc.paths as any)["/{tree}"].get;
        const format = (op.parameters as any[]).find((p) => p.name === "format");
        expect(format.schema.enum).toEqual(["json", "list"]);
    });
});

describe("响应 schema", () => {
    test("node-list 分页 oneOf（裸数组 | PaginationEnvelope）", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const schema = (doc.paths as any)["/{tree}/nodes"].get.responses["200"].content[
            "application/json"
        ].schema;
        expect(schema.oneOf).toHaveLength(2);
        expect(schema.oneOf[0]).toEqual({ type: "array", items: { $ref: "#/components/schemas/TreeNode-menu" } });
        expect(schema.oneOf[1]).toEqual({ $ref: "#/components/schemas/PaginationEnvelope" });
    });

    test("count/verify 形状", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const count = (doc.paths as any)["/{tree}/nodes/{id}/descendants/count"].get.responses[
            "200"
        ].content["application/json"].schema;
        expect(count.required).toEqual(["count"]);
        const verify = (doc.paths as any)["/{tree}/verify"].post.responses["200"].content[
            "application/json"
        ].schema;
        expect(verify.properties).toEqual({
            valid: { type: "boolean" },
            errors: { type: "array", items: { type: "string" } },
        });
    });

    test("每个 operation 附 400/404/500 Problem 引用", () => {
        const doc = generateOpenApiDocument(serviceOf());
        for (const path of Object.values(doc.paths as object)) {
            for (const op of Object.values(path as object)) {
                const responses = (op as any).responses;
                for (const status of ["400", "404", "500"]) {
                    expect(responses[status].content["application/problem+json"].schema.$ref).toBe(
                        "#/components/schemas/Problem",
                    );
                }
            }
        }
    });

    test("204 无响应体（DELETE）", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const del = (doc.paths as any)["/{tree}"].delete.responses["204"];
        expect(del.description).toBeDefined();
        expect(del.content).toBeUndefined();
    });
});

describe("TreeNode schema", () => {
    test("默认宽 schema：物理列名 + additionalProperties", () => {
        const doc = generateOpenApiDocument(serviceOf());
        const schema = (doc.components as any).schemas["TreeNode-menu"];
        expect(schema.additionalProperties).toBe(true);
        expect(Object.keys(schema.properties)).toEqual(
            expect.arrayContaining(["id", "name", "level", "treeId"]),
        );
        expect(schema.required).toEqual(["id"]);
    });

    test("nodeSchema 注册覆盖：原样嵌入", () => {
        const s = new FlexTreeApiService();
        s.register("custom", fakeManager, {
            nodeSchema: { type: "object", properties: { custom: { type: "string" } }, required: ["custom"] },
        });
        const doc = generateOpenApiDocument(s);
        expect((doc.components as any).schemas["TreeNode-custom"]).toEqual({
            type: "object",
            properties: { custom: { type: "string" } },
            required: ["custom"],
        });
    });

    test("多树：各自 schema + node 引用 oneOf", () => {
        const s = new FlexTreeApiService();
        s.register("a", fakeManager);
        s.register("b", fakeManager);
        const doc = generateOpenApiDocument(s);
        const schemas = (doc.components as any).schemas;
        expect(schemas["TreeNode-a"]).toBeDefined();
        expect(schemas["TreeNode-b"]).toBeDefined();
        const nodeSchema = (doc.paths as any)["/{tree}/nodes/{id}"].get.responses["200"].content[
            "application/json"
        ].schema;
        expect(nodeSchema.oneOf).toEqual([
            { $ref: "#/components/schemas/TreeNode-a" },
            { $ref: "#/components/schemas/TreeNode-b" },
        ]);
    });
});

describe("内置 GET /openapi.json 路由", () => {
    test("默认开放：200 且文档等于纯函数输出", async () => {
        const service = serviceOf();
        const handler = createHandler(service);
        const res = await handler(new Request("http://x/openapi.json"));
        expect(res.status).toBe(200);
        const body = await res.json();
        const pure = generateOpenApiDocument(service, { servers: [{ url: "/" }] });
        expect(body).toEqual(pure);
    });

    test("servers 按 basePath 推导", async () => {
        const service = serviceOf();
        const handler = createHandler(service, { basePath: "/api/trees" });
        const res = await handler(new Request("http://x/api/trees/openapi.json"));
        const body = await res.json();
        expect(body.servers).toEqual([{ url: "/api/trees" }]);
    });

    test("宿主显式 servers 覆盖 basePath 推导", async () => {
        const service = new FlexTreeApiService({
            openapi: { servers: [{ url: "https://pub.example.com" }] },
        });
        service.register("menu", fakeManager);
        const handler = createHandler(service, { basePath: "/api/trees" });
        const res = await handler(new Request("http://x/api/trees/openapi.json"));
        expect((await res.json()).servers).toEqual([{ url: "https://pub.example.com" }]);
    });

    test("enabled:false → 404", async () => {
        const service = new FlexTreeApiService({ openapi: { enabled: false } });
        service.register("menu", fakeManager);
        const handler = createHandler(service);
        const res = await handler(new Request("http://x/openapi.json"));
        expect(res.status).toBe(404);
        expect((await res.json()).code).toBe("ROUTE_NOT_FOUND");
    });

    test("registry 变更后缓存失效（文档更新）", async () => {
        const service = serviceOf();
        const handler = createHandler(service);
        await handler(new Request("http://x/openapi.json")); // 首访缓存
        service.register("extra", fakeManager);
        const res = await handler(new Request("http://x/openapi.json"));
        const body = await res.json();
        expect((body.components as any).schemas["TreeNode-extra"]).toBeDefined();
    });
});

describe("纯函数性", () => {
    test("同 service 两次调用结果相等，且不改变 registry", () => {
        const s = serviceOf();
        const before = s.list().length;
        const d1 = generateOpenApiDocument(s);
        const d2 = generateOpenApiDocument(s);
        expect(d1).toEqual(d2);
        expect(s.list().length).toBe(before);
    });
});
