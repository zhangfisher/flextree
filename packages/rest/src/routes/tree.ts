/**
 * 树级路由：GET /、GET|DELETE /:tree、POST /:tree/verify、POST /:tree/repair
 */
import { FlexTreeVerifyError } from "flextree";
import type { RouteContext } from "../router";
import type { FlexTreeApiService } from "../service";
import { parseQuery } from "../query";

/** GET /：注册树列表 */
export async function listTrees(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const trees = service.list().map((e) => ({
        name: e.name,
        multiRoot: e.multiRoot,
        recyclebinEnabled: e.manager.recycleBinEnabled,
    }));
    return Response.json({ trees });
}

/** GET /:tree：树信息 + toJson/toList 导出 */
export async function getTree(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const format = (values.format as string) ?? "json";
    const options = values.includeRecyclebin !== undefined
        ? { includeRecyclebin: values.includeRecyclebin }
        : {};
    const data =
        format === "list"
            ? await entry.manager.toList(options)
            : await entry.manager.toJson(options);
    return Response.json({
        name: entry.name,
        multiRoot: entry.multiRoot,
        recyclebinEnabled: entry.manager.recycleBinEnabled,
        data,
    });
}

/** DELETE /:tree：clear（不可逆）。单根树 clear 需在 write 内；MultiRoot.clear 自带 write */
export async function clearTree(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    if (entry.multiRoot) {
        await service.runSelfWrite(entry, (m) => m.clear());
    } else {
        await service.runWrite(entry, (m) => m.clear());
    }
    return new Response(null, { status: 204 });
}

/** POST /:tree/verify：校验失败也是 200（检查工具的正常工作成果） */
export async function verifyTree(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    try {
        await entry.manager.verify();
        return Response.json({ valid: true, errors: [] });
    } catch (e) {
        if (e instanceof FlexTreeVerifyError) {
            return Response.json({ valid: false, errors: [e.message] });
        }
        throw e;
    }
}

/** POST /:tree/repair：修复树结构（repair 自带 write，走 runSelfWrite） */
export async function repairTree(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    await service.runSelfWrite(entry, (m) => m.repair());
    return Response.json({ repaired: true });
}
