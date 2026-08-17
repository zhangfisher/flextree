/**
 * 错误映射：FlexTree 错误类 → RFC 9457 problem+json 响应
 */
import {
    FlexTreeDriverError,
    FlexTreeError,
    FlexTreeInvalidUpdateError,
    FlexTreeNodeError,
    FlexTreeNodeInvalidOperationError,
    FlexTreeNodeNotFoundError,
    FlexTreeVerifyError,
} from "flextree";

/** problem+json 文档（RFC 9457 子集，附机器可判别的 code） */
export interface ProblemDetail {
    type: string;
    title: string;
    status: number;
    detail?: string;
    /** SCREAMING_SNAKE 机器码 */
    code: string;
    errors?: unknown[];
}

/** REST 层自有错误：路由/校验层主动抛出，携带 HTTP 语义 */
export class RestError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly errors?: unknown[],
    ) {
        super(message);
    }
}

/** 未注册的树名（与节点 404 的 code 区分） */
export class TreeNotRegisteredError extends RestError {
    constructor(treeName: string) {
        super(404, "TREE_NOT_FOUND", `Tree "${treeName}" is not registered`);
    }
}

/** 错误码 → 默认 problem 标题 */
const TITLES: Record<string, string> = {
    UNKNOWN_PARAM: "Unknown query parameter",
    INVALID_POS: "Invalid pos value",
    INVALID_BODY: "Invalid request body",
    BODY_NOT_PARSED: "Request body is not parsed as JSON",
    VALIDATION_FAILED: "Request body validation failed",
    FIELD_NOT_ALLOWED: "Filter field is not allowed",
    TREE_NOT_FOUND: "Tree not found",
    NODE_NOT_FOUND: "Node not found",
    ROUTE_NOT_FOUND: "Route not found",
    METHOD_NOT_ALLOWED: "Method not allowed",
    RECYCLEBIN_NOT_ENABLED: "Recycle bin is not enabled",
    NODE_INVALID_OPERATION: "Invalid node operation",
    DRIVER_ERROR: "Database driver error",
    VERIFY_FAILED: "Tree verification failed",
    FLEXTREE_ERROR: "FlexTree error",
    INVALID_UPDATE: "Invalid update",
    INTERNAL_ERROR: "Internal server error",
};

/** FlexTree 错误类 → {status, code} 映射（顺序即优先级：子类在前） */
const ERROR_MAPPERS: Array<{
    match: (e: unknown) => boolean;
    status: number;
    code: string;
}> = [
    { match: (e) => e instanceof FlexTreeNodeNotFoundError, status: 404, code: "NODE_NOT_FOUND" },
    {
        match: (e) => e instanceof FlexTreeNodeInvalidOperationError,
        status: 422,
        code: "NODE_INVALID_OPERATION",
    },
    // moveNode 非法落点抛的是裸 FlexTreeError（"Can not move node..."）——同属无效操作语义
    {
        match: (e) =>
            e instanceof FlexTreeError &&
            /can not move/i.test(e.message),
        status: 422,
        code: "NODE_INVALID_OPERATION",
    },
    { match: (e) => e instanceof FlexTreeDriverError, status: 503, code: "DRIVER_ERROR" },
    { match: (e) => e instanceof FlexTreeInvalidUpdateError, status: 500, code: "INVALID_UPDATE" },
    // verify 端点外的校验失败（端点内 catch 转 200）
    { match: (e) => e instanceof FlexTreeVerifyError, status: 500, code: "VERIFY_FAILED" },
    { match: (e) => e instanceof FlexTreeNodeError, status: 422, code: "NODE_INVALID_OPERATION" },
    { match: (e) => e instanceof FlexTreeError, status: 500, code: "FLEXTREE_ERROR" },
];

/** 用户自定义映射扩展点：返回 ProblemDetail 覆盖默认映射，返回 undefined 走默认 */
export type ErrorNormalizer = (error: unknown) => ProblemDetail | undefined | null;

/** 把任意抛出物转为 problem+json Response */
export function toProblemResponse(error: unknown, normalizer?: ErrorNormalizer): Response {
    const problem = toProblemDetail(error, normalizer);
    return new Response(JSON.stringify(problem), {
        status: problem.status,
        headers: { "content-type": "application/problem+json" },
    });
}

/** 把任意抛出物转为 ProblemDetail（不产生 Response，便于测试与扩展） */
export function toProblemDetail(error: unknown, normalizer?: ErrorNormalizer): ProblemDetail {
    // REST 层自有错误直接使用
    if (error instanceof RestError) {
        return {
            type: "about:blank",
            title: TITLES[error.code] ?? error.code,
            status: error.status,
            detail: error.message,
            code: error.code,
            ...(error.errors ? { errors: error.errors } : {}),
        };
    }

    // 用户 normalizer 优先
    const custom = normalizer?.(error);
    if (custom) return custom;

    // FlexTree 错误映射表
    for (const m of ERROR_MAPPERS) {
        if (m.match(error)) {
            return {
                type: "about:blank",
                title: TITLES[m.code] ?? m.code,
                status: m.status,
                detail: error instanceof Error ? error.message : String(error),
                code: m.code,
            };
        }
    }

    // 未知错误：不泄漏内部细节
    return {
        type: "about:blank",
        title: TITLES.INTERNAL_ERROR,
        status: 500,
        code: "INTERNAL_ERROR",
    };
}
