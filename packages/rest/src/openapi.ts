/**
 * OpenAPI 文档生成：从声明式路由表（ROUTES）产出 OpenAPI 3.1 文档
 *
 * 纯数据函数：不 import 任何框架、不发 IO。
 * 默认消费方是内置 GET /openapi.json 路由（handler.ts 注入 basePath 推导 servers）；
 * 宿主亦可直接调用以写文件 / CI 校验 / 自定义挂载。
 */
import type { RegistryEntry } from "./registry";
import { ROUTES } from "./routes";
import type { FlexTreeApiService } from "./service";
import type { QueryParamSpec } from "./query";
import type { ResponseKind } from "./router";

export interface OpenApiDocumentOptions {
    info?: { title?: string; version?: string; description?: string };
    servers?: Array<{ url: string; description?: string }>;
}

/** 宽类型：OpenAPI 3.1 文档对象 */
export interface OpenApiDocument extends Record<string, unknown> {}

/** QueryParamSpec.type → JSON Schema */
function queryTypeToSchema(s: QueryParamSpec): Record<string, unknown> {
    if (s.type === "string[]") return { type: "array", items: { type: "string" } };
    if (s.type === "number") {
        const schema: Record<string, unknown> = { type: s.integer ? "integer" : "number" };
        if (s.min !== undefined) schema.minimum = s.min;
        return schema;
    }
    if (s.enum) return { type: s.type, enum: s.enum };
    return { type: s.type };
}

/** pattern（/:tree/nodes/:id）→ OpenAPI path（/{tree}/nodes/{id}） */
export function toOpenApiPath(pattern: string): string {
    if (pattern === "/") return "/";
    return (
        "/" +
        pattern
            .split("/")
            .filter(Boolean)
            .map((seg) => (seg.startsWith(":") ? `{${seg.slice(1)}}` : seg))
            .join("/")
    );
}

/** path 参数 schema/description 按名映射 */
const PATH_PARAM_META: Record<string, { schema: Record<string, unknown>; description: string }> = {
    tree: { schema: { type: "string" }, description: "注册的树名" },
    id: {
        schema: { type: ["string", "integer"] },
        description: "节点 ID（纯数字无前导零按 number 匹配）",
    },
    n: { schema: { type: "integer" }, description: "第 n 个子节点（1-based；负数从尾部数）" },
};

/** 默认宽节点 schema：按 keyFields 物理列名 + additionalProperties */
function defaultNodeSchema(entry: RegistryEntry): Record<string, unknown> {
    const kf = (entry.manager as any).keyFields ?? {};
    const props: Record<string, unknown> = {};
    if (kf.id) props[kf.id] = { type: ["string", "integer"] };
    if (kf.name) props[kf.name] = { type: ["string", "null"] };
    if (kf.level) props[kf.level] = { type: ["integer", "null"] };
    if (kf.leftValue) props[kf.leftValue] = { type: ["integer", "null"] };
    if (kf.rightValue) props[kf.rightValue] = { type: ["integer", "null"] };
    if (kf.treeId) props[kf.treeId] = { type: ["string", "integer", "null"] };
    return {
        type: "object",
        additionalProperties: true,
        ...(kf.id ? { required: [kf.id] } : {}),
        properties: props,
    };
}

/** 节点 $ref 解析：单树单 ref，多树 oneOf */
function nodeRef(entries: RegistryEntry[]): Record<string, unknown> {
    if (entries.length === 1) {
        return { $ref: `#/components/schemas/TreeNode-${entries[0].name}` };
    }
    return {
        oneOf: entries.map((e) => ({ $ref: `#/components/schemas/TreeNode-${e.name}` })),
    };
}

/** ResponseKind → 成功响应（jsonContent 为该 operation 的成功 schema） */
function successResponse(kind: ResponseKind, nodeRefSchema: Record<string, unknown>): {
    status: number;
    schema: Record<string, unknown> | null;
} {
    switch (kind) {
        case "no-content":
            return { status: 204, schema: null };
        case "created":
            return { status: 201, schema: null };
        case "created-node":
            return { status: 201, schema: nodeRefSchema };
        case "tree-list":
            return {
                status: 200,
                schema: {
                    type: "object",
                    properties: {
                        trees: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    multiRoot: { type: "boolean" },
                                    recyclebinEnabled: { type: "boolean" },
                                },
                                required: ["name", "multiRoot", "recyclebinEnabled"],
                            },
                        },
                    },
                    required: ["trees"],
                },
            };
        case "tree-export":
            return {
                status: 200,
                schema: {
                    type: "object",
                    properties: {
                        name: { type: "string" },
                        multiRoot: { type: "boolean" },
                        recyclebinEnabled: { type: "boolean" },
                        data: {},
                    },
                    required: ["name", "multiRoot", "recyclebinEnabled", "data"],
                },
            };
        case "verify":
            return {
                status: 200,
                schema: {
                    type: "object",
                    properties: {
                        valid: { type: "boolean" },
                        errors: { type: "array", items: { type: "string" } },
                    },
                    required: ["valid", "errors"],
                },
            };
        case "repaired":
        case "count":
            return {
                status: 200,
                schema: {
                    type: "object",
                    properties: { count: { type: "integer" } },
                    required: ["count"],
                },
            };
        case "allowed":
            return {
                status: 200,
                schema: {
                    type: "object",
                    properties: { allowed: { type: "boolean" } },
                    required: ["allowed"],
                },
            };
        case "node-or-null":
            return { status: 200, schema: { oneOf: [nodeRefSchema, { type: "null" }] } };
        case "node-array":
            return { status: 200, schema: { type: "array", items: nodeRefSchema } };
        case "node-list":
            return {
                status: 200,
                schema: {
                    oneOf: [
                        { type: "array", items: nodeRefSchema },
                        { $ref: "#/components/schemas/PaginationEnvelope" },
                    ],
                },
            };
        case "openapi-document":
            return { status: 200, schema: { type: "object", additionalProperties: true } };
        default:
            return { status: 200, schema: nodeRefSchema };
    }
}

/** moved/repaired 的响应字段名差异在此消化（两者 body 形状同为单布尔字段） */
function booleanBody(field: string): Record<string, unknown> {
    return {
        type: "object",
        properties: { [field]: { type: "boolean" } },
        required: [field],
    };
}

/**
 * 生成 OpenAPI 3.1 文档。
 * servers 未提供时由内置路由按 basePath 推导；纯函数场景缺省为 [{url: "/"}]。
 */
export function generateOpenApiDocument(
    service: FlexTreeApiService,
    options?: OpenApiDocumentOptions,
): OpenApiDocument {
    const entries = service.list();
    const nodeRefSchema = nodeRef(entries);

    // components.schemas：每树 TreeNode-{name} + Problem + 单份 PaginationEnvelope
    const schemas: Record<string, unknown> = {};
    for (const e of entries) {
        schemas[`TreeNode-${e.name}`] = e.nodeSchema ?? defaultNodeSchema(e);
    }
    schemas["Problem"] = {
        type: "object",
        properties: {
            type: { type: "string" },
            title: { type: "string" },
            status: { type: "integer" },
            detail: { type: "string" },
            code: { type: "string" },
            errors: { type: "array", items: {} },
        },
        required: ["type", "title", "status", "code"],
    };
    schemas["PaginationEnvelope"] = {
        type: "object",
        properties: {
            items: { type: "array", items: nodeRefSchema },
            total: { type: "integer" },
            limit: { type: "integer" },
            offset: { type: "integer" },
        },
        required: ["items", "total", "limit", "offset"],
    };

    // paths：遍历 ROUTES，同 path 下按 method 合并
    const paths: Record<string, Record<string, unknown>> = {};
    for (const route of ROUTES) {
        const { method, pattern, meta } = route;
        const pathKey = toOpenApiPath(pattern);
        const operation: Record<string, unknown> = {
            summary: meta.summary,
            tags: [meta.tag],
            operationId: `${method.toLowerCase()}${pathKey
                .split("/")
                .filter(Boolean)
                .map((s) => (s.startsWith("{") ? s : s.charAt(0).toUpperCase() + s.slice(1)))
                .join("")}`,
        };
        if (meta.description) operation.description = meta.description;

        // path 参数
        const pathParams = pattern
            .split("/")
            .filter((s) => s.startsWith(":"))
            .map((s) => s.slice(1))
            .map((name) => {
                const m = PATH_PARAM_META[name] ?? { schema: { type: "string" }, description: name };
                return { name, in: "path", required: true, schema: m.schema, description: m.description };
            });
        if (pathParams.length > 0) operation.parameters = pathParams;

        // query 参数
        if (meta.query && meta.query.length > 0) {
            const queryParams = meta.query.map((q) => ({
                name: q.name,
                in: "query",
                required: q.optional ? false : true,
                schema: queryTypeToSchema(q),
            }));
            const existing = (operation.parameters as unknown[] | undefined) ?? [];
            operation.parameters = [...existing, ...queryParams];
        }

        // where 平铺过滤说明（动态白名单，不生成具名参数）
        if (meta.allowWhere) {
            operation.description = [
                operation.description,
                "另支持注册白名单字段的平铺等值过滤（?field=value）。",
            ]
                .filter(Boolean)
                .join(" ");
        }

        // 成功响应 + 统一错误响应
        let success: { status: number; schema: Record<string, unknown> | null };
        if (meta.response === "moved") {
            success = { status: 200, schema: booleanBody("moved") };
        } else if (meta.response === "repaired") {
            success = { status: 200, schema: booleanBody("repaired") };
        } else {
            success = successResponse(meta.response, nodeRefSchema);
        }
        const responses: Record<string, unknown> = {
            [String(success.status)]:
                success.schema === null
                    ? { description: "成功（无响应体）" }
                    : {
                          description: "成功",
                          content: { "application/json": { schema: success.schema } },
                      },
            "400": problemResponse("参数校验失败"),
            "404": problemResponse("树或节点不存在"),
            "500": problemResponse("服务端错误"),
        };
        operation.responses = responses;

        paths[pathKey] ??= {};
        paths[pathKey][method.toLowerCase()] = operation;
    }

    return {
        openapi: "3.1.0",
        info: {
            title: options?.info?.title ?? "flextree-rest API",
            version: options?.info?.version ?? "1.0.0",
            ...(options?.info?.description ? { description: options.info.description } : {}),
        },
        servers: options?.servers ?? [{ url: "/" }],
        tags: [
            { name: "Tree", description: "树级操作" },
            { name: "Nodes", description: "节点 CRUD" },
            { name: "Relations", description: "节点关系查询" },
            { name: "Actions", description: "节点结构动作" },
            { name: "Recyclebin", description: "回收站" },
            { name: "OpenAPI", description: "文档端点" },
        ],
        paths,
        components: { schemas },
    };
}

/** 统一 problem+json 错误响应引用 */
function problemResponse(description: string): Record<string, unknown> {
    return {
        description,
        content: {
            "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } },
        },
    };
}
