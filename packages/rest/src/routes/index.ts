/**
 * 声明式路由表：唯一的路由真源（运行时装配 + OpenAPI 生成两处消费）
 */
import { Router, type HttpMethod, type RouteContext, type RouteMeta } from "../router";
import type { FlexTreeApiService } from "../service";
import type { QueryParamSpec } from "../query";
import * as tree from "./tree";
import * as nodes from "./nodes";
import * as actions from "./actions";
import * as recyclebin from "./recyclebin";

export interface RouteDecl {
    method: HttpMethod;
    pattern: string;
    handler: (ctx: RouteContext, service: FlexTreeApiService) => Promise<Response>;
    meta: RouteMeta;
}

// ---- 参数 spec 片段（与运行时 parseQuery 共用） ----

/** 读端点通用参数（各端点按所调库方法签名裁剪） */
const COMMON_READ: QueryParamSpec[] = [
    { name: "level", type: "number", optional: true },
    { name: "countField", type: "string", optional: true },
    { name: "includeRecyclebin", type: "boolean", optional: true },
];

const TREE_EXPORT_QUERY: QueryParamSpec[] = [
    { name: "format", type: "string", optional: true, enum: ["json", "list"] },
    { name: "includeRecyclebin", type: "boolean", optional: true },
];

const NODES_LIST_QUERY: QueryParamSpec[] = [
    ...COMMON_READ,
    { name: "fields", type: "string[]", optional: true },
    { name: "limit", type: "number", optional: true, integer: true, min: 1 },
    { name: "offset", type: "number", optional: true, integer: true, min: 0 },
];

const NODE_GET_QUERY: QueryParamSpec[] = [
    ...COMMON_READ,
    { name: "fields", type: "string[]", optional: true },
    { name: "includeChildren", type: "boolean", optional: true },
    { name: "includeDescendants", type: "boolean", optional: true },
    { name: "format", type: "string", optional: true, enum: ["json", "list"] },
];

const UPDATE_QUERY: QueryParamSpec[] = [
    { name: "includeRecyclebin", type: "boolean", optional: true },
];

const DELETE_QUERY: QueryParamSpec[] = [
    { name: "recycle", type: "boolean", optional: true },
    { name: "includeRecyclebin", type: "boolean", optional: true },
];

const CHILDREN_QUERY: QueryParamSpec[] = [
    { name: "countField", type: "string", optional: true },
    { name: "includeRecyclebin", type: "boolean", optional: true },
    { name: "includeDescendants", type: "boolean", optional: true },
];

const DESCENDANTS_QUERY: QueryParamSpec[] = [
    ...COMMON_READ,
    { name: "includeSelf", type: "boolean", optional: true },
    { name: "includeDescendants", type: "boolean", optional: true },
];

const ANCESTORS_QUERY: QueryParamSpec[] = [
    { name: "countField", type: "string", optional: true },
    { name: "includeRecyclebin", type: "boolean", optional: true },
    { name: "includeSelf", type: "boolean", optional: true },
];

const SIBLINGS_QUERY: QueryParamSpec[] = [
    { name: "countField", type: "string", optional: true },
    { name: "includeRecyclebin", type: "boolean", optional: true },
    { name: "includeSelf", type: "boolean", optional: true },
];

const CAN_MOVE_QUERY: QueryParamSpec[] = [
    { name: "to", type: "string", optional: true },
    { name: "pos", type: "string", optional: true },
    { name: "includeRecyclebin", type: "boolean", optional: true },
];

/** 全部路由声明（25 条） */
export const ROUTES: RouteDecl[] = [
    // 树级
    {
        method: "GET",
        pattern: "/",
        handler: tree.listTrees,
        meta: { tag: "Tree", summary: "注册树列表", response: "tree-list" },
    },
    {
        method: "GET",
        pattern: "/:tree",
        handler: tree.getTree,
        meta: {
            tag: "Tree",
            summary: "树信息与导出",
            query: TREE_EXPORT_QUERY,
            response: "tree-export",
        },
    },
    {
        method: "DELETE",
        pattern: "/:tree",
        handler: tree.clearTree,
        meta: { tag: "Tree", summary: "清空整树（不可逆）", response: "no-content" },
    },
    {
        method: "POST",
        pattern: "/:tree/verify",
        handler: tree.verifyTree,
        meta: { tag: "Tree", summary: "校验树结构", response: "verify" },
    },
    {
        method: "POST",
        pattern: "/:tree/repair",
        handler: tree.repairTree,
        meta: { tag: "Tree", summary: "修复树结构", response: "repaired" },
    },

    // 节点集合
    {
        method: "GET",
        pattern: "/:tree/nodes",
        handler: nodes.listNodes,
        meta: {
            tag: "Nodes",
            summary: "节点列表（?level=0≡根列表；支持 where 白名单等值过滤与分页）",
            query: NODES_LIST_QUERY,
            allowWhere: true,
            response: "node-list",
        },
    },
    {
        method: "POST",
        pattern: "/:tree/nodes",
        handler: nodes.addNodes,
        meta: { tag: "Nodes", summary: "添加节点（201+Location）", response: "created" },
    },

    // 单节点
    {
        method: "GET",
        pattern: "/:tree/nodes/:id",
        handler: nodes.getNode,
        meta: {
            tag: "Nodes",
            summary: "获取节点（includeChildren/includeDescendants 展开）",
            query: NODE_GET_QUERY,
            response: "node",
        },
    },
    {
        method: "PATCH",
        pattern: "/:tree/nodes/:id",
        handler: nodes.updateNode,
        meta: { tag: "Nodes", summary: "更新节点字段", query: UPDATE_QUERY, response: "node" },
    },
    {
        method: "DELETE",
        pattern: "/:tree/nodes/:id",
        handler: nodes.deleteNode,
        meta: {
            tag: "Nodes",
            summary: "删除节点（?recycle 进回收站）",
            query: DELETE_QUERY,
            response: "no-content",
        },
    },

    // 关系子端点
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/children",
        handler: nodes.getChildren,
        meta: { tag: "Relations", summary: "直接子节点", query: CHILDREN_QUERY, response: "node-array" },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/children/:n",
        handler: nodes.getNthChild,
        meta: {
            tag: "Relations",
            summary: "第 n 个子节点（1-based，负数从尾）",
            query: CHILDREN_QUERY.slice(0, 2),
            response: "node",
        },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/descendants",
        handler: nodes.getDescendants,
        meta: { tag: "Relations", summary: "后代节点", query: DESCENDANTS_QUERY, response: "node-array" },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/descendants/count",
        handler: nodes.getDescendantsCount,
        meta: {
            tag: "Relations",
            summary: "后代数量",
            query: [COMMON_READ[0], COMMON_READ[2]],
            response: "count",
        },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/ancestors",
        handler: nodes.getAncestors,
        meta: { tag: "Relations", summary: "祖先节点", query: ANCESTORS_QUERY, response: "node-array" },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/ancestors/count",
        handler: nodes.getAncestorsCount,
        meta: {
            tag: "Relations",
            summary: "祖先数量",
            query: [COMMON_READ[2]],
            response: "count",
        },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/parent",
        handler: nodes.getParent,
        meta: {
            tag: "Relations",
            summary: "父节点",
            query: [COMMON_READ[1], COMMON_READ[2]],
            response: "node",
        },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/siblings",
        handler: nodes.getSiblings,
        meta: { tag: "Relations", summary: "兄弟节点", query: SIBLINGS_QUERY, response: "node-array" },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/nextsibling",
        handler: nodes.getNextSibling,
        meta: {
            tag: "Relations",
            summary: "下一个兄弟",
            query: [COMMON_READ[1], COMMON_READ[2]],
            response: "node-or-null",
        },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/previoussibling",
        handler: nodes.getPreviousSibling,
        meta: {
            tag: "Relations",
            summary: "上一个兄弟",
            query: [COMMON_READ[1], COMMON_READ[2]],
            response: "node-or-null",
        },
    },

    // 动作
    {
        method: "POST",
        pattern: "/:tree/nodes/:id/move",
        handler: actions.moveNode,
        meta: { tag: "Actions", summary: "移动节点（恢复=includeRecyclebin:true）", response: "moved" },
    },
    {
        method: "POST",
        pattern: "/:tree/nodes/:id/copy",
        handler: actions.copyNode,
        meta: { tag: "Actions", summary: "复制节点（201+副本根）", response: "created-node" },
    },
    {
        method: "POST",
        pattern: "/:tree/nodes/:id/moveup",
        handler: actions.moveUpNode,
        meta: { tag: "Actions", summary: "节点上移", response: "moved" },
    },
    {
        method: "POST",
        pattern: "/:tree/nodes/:id/movedown",
        handler: actions.moveDownNode,
        meta: { tag: "Actions", summary: "节点下移", response: "moved" },
    },
    {
        method: "GET",
        pattern: "/:tree/nodes/:id/canmoveto",
        handler: actions.canMoveTo,
        meta: { tag: "Actions", summary: "移动预检", query: CAN_MOVE_QUERY, response: "allowed" },
    },

    // 回收站
    {
        method: "GET",
        pattern: "/:tree/recyclebin",
        handler: recyclebin.listRecyclebin,
        meta: { tag: "Recyclebin", summary: "被回收节点列表", response: "node-array" },
    },
    {
        method: "DELETE",
        pattern: "/:tree/recyclebin",
        handler: recyclebin.clearRecyclebin,
        meta: { tag: "Recyclebin", summary: "永久清空回收站", response: "no-content" },
    },
];

/** 组装路由表（每 service 一份） */
export function createRouter(): Router {
    const router = new Router();
    for (const { method, pattern, handler, meta } of ROUTES) {
        router.add(method, pattern, (ctx) =>
            handler({ ...ctx, route: meta }, ctx.service as FlexTreeApiService),
        );
    }
    return router;
}
