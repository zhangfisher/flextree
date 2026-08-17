/**
 * 节点动作路由：move/copy/moveup/movedown/canmoveto
 */
import { FlexNodeRelPosition } from "flextree";
import type { RouteContext } from "../router";
import type { FlexTreeApiService } from "../service";
import { parseQuery, toNodeId, toRelPosition } from "../query";
import { readBody } from "./nodes";

/** POST .../move：moveNode（恢复=includeRecyclebin:true；跨树迁出=to 缺省+treeId） */
export async function moveNode(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const body = await readBody(ctx, entry);

    const pos = body.pos !== undefined ? toRelPosition(body.pos as string) : FlexNodeRelPosition.NextSibling;
    const to = body.to !== undefined && body.to !== null ? toNodeId(String(body.to), entry) : undefined;
    const options: Record<string, unknown> = { pos };
    if (body.treeId !== undefined) options.treeId = body.treeId;
    if (body.includeRecyclebin !== undefined) options.includeRecyclebin = body.includeRecyclebin;

    await service.runWrite(entry, (m) =>
        m.moveNode(nodeId, to as any, options as any),
    );
    return Response.json({ moved: true });
}

/** POST .../copy：copyNode → 201 + 副本根 */
export async function copyNode(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const body = await readBody(ctx, entry);

    const options: Record<string, unknown> = {};
    if (body.includeDescendants !== undefined) {
        options.includeDescendants = body.includeDescendants;
    }
    if (body.to !== undefined && body.to !== null) {
        options.to = toNodeId(String(body.to), entry);
    }
    if (body.pos !== undefined) options.pos = toRelPosition(body.pos as string);
    if (body.treeId !== undefined) options.treeId = body.treeId;
    if (body.fields !== undefined) options.fields = body.fields;
    if (body.includeRecyclebin !== undefined) {
        options.includeRecyclebin = body.includeRecyclebin;
    }

    const copyRoot = await service.runWrite(entry, (m) => m.copyNode(nodeId, options as any));
    return Response.json(copyRoot, { status: 201 });
}

/** POST .../moveup */
export async function moveUpNode(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    await service.runWrite(entry, (m) => m.moveUpNode(nodeId));
    return Response.json({ moved: true });
}

/** POST .../movedown */
export async function moveDownNode(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    await service.runWrite(entry, (m) => m.moveDownNode(nodeId));
    return Response.json({ moved: true });
}

/** GET .../canmoveto：预检 */
export async function canMoveTo(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const to = values.to !== undefined ? toNodeId(values.to as string, entry) : undefined;
    const options: Record<string, unknown> = {};
    if (values.includeRecyclebin !== undefined) {
        options.includeRecyclebin = values.includeRecyclebin;
    }
    let allowed = false;
    try {
        allowed = await entry.manager.canMoveTo(nodeId, to as any, options as any);
    } catch {
        allowed = false;
    }
    return Response.json({ allowed });
}
