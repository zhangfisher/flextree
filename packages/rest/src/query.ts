/**
 * query 解析：严格模式（声明式 spec）、类型转换、NodeId 转换、where 白名单
 */
import { FlexNodeRelPosition } from "flextree";
import { RestError } from "./errors";
import type { PosString, RegistryEntry } from "./types";

/** 参数声明：不在此列的 query 参数 → 400 UNKNOWN_PARAM（严格模式） */
export interface QueryParamSpec {
    /** 参数名 */
    name: string;
    type: "boolean" | "number" | "string" | "string[]";
    optional?: boolean;
    /** 枚举取值约束 */
    enum?: string[];
    /** number 型约束：必须整数 */
    integer?: boolean;
    /** number 型约束：下界（含） */
    min?: number;
}

/**
 * 按声明解析 query：未知参数名报错；类型转换失败报错。
 * allowExtra=true 时未声明参数收集为 rest（由 buildWhereFilter 做白名单判定），
 * 否则直接 400（严格模式：无 where 能力的端点不接受任何未声明参数）。
 */
export function parseQuery(
    url: URL,
    spec: QueryParamSpec[],
    allowExtra = false,
): {
    values: Record<string, unknown>;
    rest: Record<string, string>;
} {
    const values: Record<string, unknown> = {};
    const declared = new Map(spec.map((s) => [s.name, s]));
    const rest: Record<string, string> = {};

    for (const key of url.searchParams.keys()) {
        const s = declared.get(key);
        if (!s) {
            if (!allowExtra) {
                throw new RestError(
                    400,
                    "UNKNOWN_PARAM",
                    `Query parameter "${key}" is not supported by this endpoint`,
                );
            }
            if (key in rest) {
                throw new RestError(400, "UNKNOWN_PARAM", `Duplicate query parameter "${key}"`);
            }
            rest[key] = url.searchParams.get(key)!;
            continue;
        }
        const raw = url.searchParams.get(key)!;
        if (raw === "") {
            throw new RestError(400, "UNKNOWN_PARAM", `Query parameter "${key}" is empty`);
        }
        let value: unknown;
        switch (s.type) {
            case "boolean":
                if (raw !== "true" && raw !== "false") {
                    throw new RestError(
                        400,
                        "UNKNOWN_PARAM",
                        `Query parameter "${key}" must be true|false`,
                    );
                }
                value = raw === "true";
                break;
            case "number": {
                const n = Number(raw);
                if (!Number.isFinite(n) || !/^-?\d+(\.\d+)?$/.test(raw)) {
                    throw new RestError(
                        400,
                        "UNKNOWN_PARAM",
                        `Query parameter "${key}" must be a number`,
                    );
                }
                if (s.integer && !Number.isInteger(n)) {
                    throw new RestError(
                        400,
                        "UNKNOWN_PARAM",
                        `Query parameter "${key}" must be an integer`,
                    );
                }
                if (s.min !== undefined && n < s.min) {
                    throw new RestError(
                        400,
                        "UNKNOWN_PARAM",
                        `Query parameter "${key}" must be >= ${s.min}`,
                    );
                }
                value = n;
                break;
            }
            case "string[]":
                value = raw.split(",").map((v) => v.trim()).filter(Boolean);
                break;
            default:
                value = raw;
        }
        if (s.enum && !s.enum.includes(raw)) {
            throw new RestError(
                400,
                "UNKNOWN_PARAM",
                `Query parameter "${key}" must be one of ${s.enum.join("|")}`,
            );
        }
        values[key] = value;
    }
    return { values, rest };
}

/** pos 字符串 → FlexNodeRelPosition；非法值 400 INVALID_POS */
export function toRelPosition(pos: string | undefined): FlexNodeRelPosition {
    const map: Record<PosString, FlexNodeRelPosition> = {
        lastChild: FlexNodeRelPosition.LastChild,
        firstChild: FlexNodeRelPosition.FirstChild,
        nextSibling: FlexNodeRelPosition.NextSibling,
        previousSibling: FlexNodeRelPosition.PreviousSibling,
    };
    const v = map[pos as PosString];
    if (v === undefined) {
        throw new RestError(
            400,
            "INVALID_POS",
            `pos must be one of lastChild|firstChild|nextSibling|previousSibling`,
        );
    }
    return v;
}

/**
 * URL 段 → NodeId：纯数字且无前导零 → number（"0" 合法），否则 string；
 * 注册 idType 显式声明时按声明转换。
 */
export function toNodeId(raw: string, entry: RegistryEntry): string | number {
    if (entry.idType === "number") {
        if (!/^-?\d+$/.test(raw) || (raw.length > 1 && raw.startsWith("0"))) {
            throw new RestError(400, "UNKNOWN_PARAM", `Node id "${raw}" is not a valid number id`);
        }
        return Number(raw);
    }
    if (entry.idType === "string") return raw;
    // 智能转换：无符号纯数字、无前导零（含 "0"）
    if (/^\d+$/.test(raw) && (raw === "0" || !raw.startsWith("0"))) {
        return Number(raw);
    }
    return raw;
}

/**
 * 剩余 query 参数 → where 等值过滤对象。
 * 字段必须命中注册白名单（未配置白名单时仅允许关键字段名），越界 400 FIELD_NOT_ALLOWED。
 */
export function buildWhereFilter(entry: RegistryEntry, rest: Record<string, string>):
    | Record<string, string>
    | undefined {
    const keys = Object.keys(rest);
    if (keys.length === 0) return undefined;

    const kf = entry.manager.keyFields;
    // 默认白名单：关键字段物理列名
    const allowed = new Set<string>(
        entry.fields ?? [kf.id, kf.name, kf.level, kf.leftValue, kf.rightValue, kf.treeId].filter(Boolean),
    );
    const where: Record<string, string> = {};
    for (const key of keys) {
        if (!allowed.has(key)) {
            // 未声明且非白名单：既可能是拼错的过滤字段，也可能是此端点不支持的参数
            throw new RestError(
                400,
                "FIELD_NOT_ALLOWED",
                `"${key}" is neither a supported query parameter nor an allowed filter field`,
            );
        }
        where[key] = rest[key];
    }
    return where;
}
