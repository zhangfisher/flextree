/**
 * 错误映射单元测试（无 DB）
 */
import { describe, test, expect } from "bun:test";
import {
    FlexTreeDriverError,
    FlexTreeError,
    FlexTreeInvalidUpdateError,
    FlexTreeNodeError,
    FlexTreeNodeInvalidOperationError,
    FlexTreeNodeNotFoundError,
    FlexTreeVerifyError,
} from "flextree";
import { RestError, toProblemDetail, toProblemResponse } from "../src/errors";

describe("错误映射表", () => {
    const cases: Array<[unknown, number, string]> = [
        [new FlexTreeNodeNotFoundError(), 404, "NODE_NOT_FOUND"],
        [new FlexTreeNodeInvalidOperationError("x"), 422, "NODE_INVALID_OPERATION"],
        [new FlexTreeNodeError("x"), 422, "NODE_INVALID_OPERATION"],
        [new FlexTreeDriverError("x"), 503, "DRIVER_ERROR"],
        [new FlexTreeInvalidUpdateError("x"), 500, "INVALID_UPDATE"],
        [new FlexTreeVerifyError("x"), 500, "VERIFY_FAILED"],
        [new FlexTreeError("x"), 500, "FLEXTREE_ERROR"],
        [new Error("x"), 500, "INTERNAL_ERROR"],
        [new RestError(409, "RECYCLEBIN_NOT_ENABLED", "x"), 409, "RECYCLEBIN_NOT_ENABLED"],
    ];

    for (const [err, status, code] of cases) {
        test(`${err.constructor.name} → ${status} ${code}`, () => {
            const p = toProblemDetail(err);
            expect(p.status).toBe(status);
            expect(p.code).toBe(code);
        });
    }

    test("RestError 保留 detail", () => {
        const p = toProblemDetail(new RestError(400, "INVALID_POS", "bad"));
        expect(p.detail).toBe("bad");
    });

    test("onError normalizer 覆盖默认映射", () => {
        const p = toProblemDetail(new FlexTreeError("x"), () => ({
            type: "about:blank",
            title: "custom",
            status: 418,
            code: "TEAPOT",
        }));
        expect(p.status).toBe(418);
        expect(p.code).toBe("TEAPOT");
    });

    test("toProblemResponse 输出 application/problem+json", async () => {
        const res = toProblemResponse(new RestError(404, "TREE_NOT_FOUND", "t"));
        expect(res.status).toBe(404);
        expect(res.headers.get("content-type")).toBe("application/problem+json");
        const body = await res.json();
        expect(body.code).toBe("TREE_NOT_FOUND");
    });

    test("未知错误不泄漏内部细节", () => {
        const p = toProblemDetail(new Error("secret internal path"));
        expect(p.detail).toBeUndefined();
        expect(p.code).toBe("INTERNAL_ERROR");
    });
});
