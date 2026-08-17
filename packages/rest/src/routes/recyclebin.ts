/**
 * 回收站路由：GET|DELETE /:tree/recyclebin
 */
import type { RouteContext } from "../router";
import type { FlexTreeApiService } from "../service";
import { RestError } from "../errors";

/** 解析 bin 节点 id：manager.options.recyclebin.id（函数式 id 按 treeId 求值） */
function getBinId(manager: any): string | number {
    const rb = manager.options?.recyclebin;
    if (!rb) throw new RestError(409, "RECYCLEBIN_NOT_ENABLED", "Recycle bin is not enabled");
    return typeof rb.id === "function" ? rb.id(manager.treeId) : rb.id;
}

function assertRecycleBin(entry: { manager: any }) {
    if (!entry.manager.recycleBinEnabled) {
        throw new RestError(409, "RECYCLEBIN_NOT_ENABLED", "Recycle bin is not enabled");
    }
}

/** GET /:tree/recyclebin：被回收节点列表（站内视角） */
export async function listRecyclebin(
    ctx: RouteContext,
    service: FlexTreeApiService,
): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    assertRecycleBin(entry);
    const binId = getBinId(entry.manager);
    const nodes = await entry.manager.getDescendants(binId, { includeRecyclebin: true });
    return Response.json(nodes);
}

/** DELETE /:tree/recyclebin：永久清空 */
export async function clearRecyclebin(
    ctx: RouteContext,
    service: FlexTreeApiService,
): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    assertRecycleBin(entry);
    await service.runWrite(entry, (m) => m.clearRecycleBin());
    return new Response(null, { status: 204 });
}
