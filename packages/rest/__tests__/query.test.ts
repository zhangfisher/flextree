/**
 * query 解析单元测试（无 DB）：严格模式、类型转换、NodeId、where 白名单
 */
import { describe, test, expect } from "bun:test";
import { parseQuery, toRelPosition, toNodeId, buildWhereFilter } from "../src/query";
import { RestError } from "../src/errors";
import { TreeRegistry } from "../src/registry";
import type { TreeManagerLike } from "../src/types";

const url = (p: string) => new URL(`http://x${p}`);

const fakeManager = {
    keyFields: { id: "id", name: "name", level: "level", treeId: "treeId" },
    recycleBinEnabled: false,
} as unknown as TreeManagerLike;

function entryOf(fields?: string[], idType?: "number" | "string") {
    const reg = new TreeRegistry();
    return reg.register("t", fakeManager, { fields, idType });
}

describe("parseQuery 严格模式", () => {
    const spec = [
        { name: "level", type: "number" as const, optional: true },
        { name: "includeRecyclebin", type: "boolean" as const, optional: true },
        { name: "fields", type: "string[]" as const, optional: true },
    ];

    test("类型转换：number/boolean/数组", () => {
        const { values } = parseQuery(url("/t?level=2&includeRecyclebin=true&fields=a,b"), spec);
        expect(values).toEqual({ level: 2, includeRecyclebin: true, fields: ["a", "b"] });
    });

    test("allowExtra=true 时未知参数收集为 rest；默认严格拒绝", () => {
        const { rest, values } = parseQuery(url("/t?level=1&title=A"), spec, true);
        expect(values).toEqual({ level: 1 });
        expect(rest).toEqual({ title: "A" });
        // 默认（无 allowExtra）：未知参数直接 400
        expect(() => parseQuery(url("/t?level=1&title=A"), spec)).toThrow(RestError);
    });

    test("boolean 非法值 → 400", () => {
        expect(() => parseQuery(url("/t?includeRecyclebin=yes"), spec)).toThrow(RestError);
        try {
            parseQuery(url("/t?includeRecyclebin=yes"), spec);
        } catch (e) {
            expect((e as RestError).status).toBe(400);
        }
    });

    test("number 非法值 → 400", () => {
        expect(() => parseQuery(url("/t?level=abc"), spec)).toThrow(RestError);
    });

    test("enum 违反 → 400", () => {
        expect(() =>
            parseQuery(url("/t?format=xml"), [
                { name: "format", type: "string", enum: ["json", "list"] },
            ]),
        ).toThrow(RestError);
    });

    test("空参数值 → 400", () => {
        expect(() => parseQuery(url("/t?level="), spec)).toThrow(RestError);
    });
});

describe("toRelPosition", () => {
    test("四种合法字符串", () => {
        expect(toRelPosition("lastChild")).toBe(0);
        expect(toRelPosition("firstChild")).toBe(1);
        expect(toRelPosition("nextSibling")).toBe(2);
        expect(toRelPosition("previousSibling")).toBe(3);
    });
    test("非法 → 400 INVALID_POS", () => {
        try {
            toRelPosition("top");
            expect.unreachable();
        } catch (e) {
            expect((e as RestError).code).toBe("INVALID_POS");
        }
    });
});

describe("toNodeId", () => {
    test("智能转换：纯数字无前导零→number", () => {
        expect(toNodeId("123", entryOf())).toBe(123);
        expect(toNodeId("0", entryOf())).toBe(0);
    });
    test("智能转换：前导零/字母→string", () => {
        expect(toNodeId("007", entryOf())).toBe("007");
        expect(toNodeId("abc", entryOf())).toBe("abc");
        expect(toNodeId("12a", entryOf())).toBe("12a");
    });
    test("idType 声明覆盖", () => {
        expect(toNodeId("123", entryOf(undefined, "string"))).toBe("123");
        expect(toNodeId("42", entryOf(undefined, "number"))).toBe(42);
        expect(() => toNodeId("x", entryOf(undefined, "number"))).toThrow(RestError);
    });
});

describe("buildWhereFilter 白名单", () => {
    test("默认白名单：关键字段名放行", () => {
        const where = buildWhereFilter(entryOf(), { name: "A", level: "1" });
        expect(where).toEqual({ name: "A", level: "1" });
    });
    test("注册白名单：命中放行", () => {
        const where = buildWhereFilter(entryOf(["title", "size"]), { title: "A" });
        expect(where).toEqual({ title: "A" });
    });
    test("越界字段 → 400 FIELD_NOT_ALLOWED", () => {
        try {
            buildWhereFilter(entryOf(["title"]), { size: "1" });
            expect.unreachable();
        } catch (e) {
            expect((e as RestError).code).toBe("FIELD_NOT_ALLOWED");
        }
    });
    test("空 rest → undefined", () => {
        expect(buildWhereFilter(entryOf(), {})).toBeUndefined();
    });
});
