/**
 * mini router：静态段 + :param 段匹配 + 方法分发
 *
 * 本包路由全是"静态段 + 单参数段"，无通配符/正则需求（ADR-0008）。
 */
import { RestError } from "./errors";
import type { QueryParamSpec } from "./query";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** 响应形状标记（openapi.ts 映射为响应 schema） */
export type ResponseKind =
    | "tree-list"
    | "tree-export"
    | "verify"
    | "repaired"
    | "no-content"
    | "node"
    | "node-or-null"
    | "node-array"
    | "node-list"
    | "count"
    | "moved"
    | "allowed"
    | "created"
    | "created-node"
    | "openapi-document";

/** 路由声明元数据：运行时供 handler 取 query spec；生成器出 OpenAPI 文档 */
export interface RouteMeta {
    summary: string;
    description?: string;
    /** OpenAPI tag / 文档分组 */
    tag: "Tree" | "Nodes" | "Relations" | "Actions" | "Recyclebin" | "OpenAPI";
    /** query 参数声明（parseQuery 的 spec；不声明 = 该端点不解析 query） */
    query?: QueryParamSpec[];
    /** 是否接受 where 平铺等值过滤（allowExtra；仅 GET /:tree/nodes） */
    allowWhere?: boolean;
    /** 响应形状标记 */
    response: ResponseKind;
}

export interface RouteMatch {
    params: Record<string, string>;
    handler: (ctx: RouteContext) => Promise<Response>;
}

export interface RouteContext {
    request: Request;
    url: URL;
    params: Record<string, string>;
    query: URLSearchParams;
    /** 路由表 wrap 时注入的 service（routes/index.ts 的 wrap 装配） */
    service?: unknown;
    /** 路由表 wrap 时注入的声明元数据（spec 一处声明、运行时与文档两处消费） */
    route?: RouteMeta;
}

interface RouteEntry {
    method: HttpMethod;
    /** 形如 /:tree/nodes/:id/children/:n */
    segments: string[];
    handler: (ctx: RouteContext) => Promise<Response>;
}

export class Router {
    private _routes: RouteEntry[] = [];

    /** 注册路由；pattern 用 :name 参数段 */
    add(method: HttpMethod, pattern: string, handler: (ctx: RouteContext) => Promise<Response>) {
        this._routes.push({
            method,
            segments: pattern.split("/").filter(Boolean),
            handler,
        });
    }

    /**
     * 匹配请求：路径与方法均命中 → RouteMatch；
     * 路径命中但方法不匹配 → 抛 405；路径不存在 → 抛 404。
     */
    match(method: string, pathname: string): RouteMatch {
        const parts = pathname.split("/").filter(Boolean);
        let pathHit = false;

        for (const route of this._routes) {
            const params = matchSegments(route.segments, parts);
            if (!params) continue;
            pathHit = true;
            if (route.method === method) {
                return { params, handler: route.handler };
            }
        }
        if (pathHit) {
            throw new RestError(
                405,
                "METHOD_NOT_ALLOWED",
                `Method ${method} is not allowed for ${pathname}`,
            );
        }
        throw new RestError(404, "ROUTE_NOT_FOUND", `Route not found: ${pathname}`);
    }
}

/** 逐段比对：静态段全等，:param 段捕获 */
function matchSegments(pattern: string[], path: string[]): Record<string, string> | null {
    if (pattern.length !== path.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < pattern.length; i++) {
        const p = pattern[i];
        if (p.startsWith(":")) {
            params[p.slice(1)] = decodeURIComponent(path[i]);
        } else if (p !== path[i]) {
            return null;
        }
    }
    return params;
}
