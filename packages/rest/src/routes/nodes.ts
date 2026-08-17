/**
 * 节点路由：/nodes 集合、单节点、关系子端点
 */
import type { RouteContext } from "../router";
import type { FlexTreeApiService } from "../service";
import type { RegistryEntry } from "../registry";
import { buildWhereFilter, parseQuery, toNodeId, toRelPosition } from "../query";
import { RestError } from "../errors";
import type { TreeManagerLike } from "../types";

function pickOptions(values: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of keys) {
        if (values[k] !== undefined) out[k] = values[k];
    }
    return out;
}

/** GET /:tree/nodes：getNodes + where 过滤 + offset 分页（仅此端点）；?level=0 ≡ 根列表 */
export async function listNodes(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const { values, rest } = parseQuery(ctx.url, ctx.route!.query!, ctx.route!.allowWhere === true);
    const where = buildWhereFilter(entry, rest);

    // 分页语义：offset 必须伴随 limit（无 limit 的 offset 无意义）
    const hasLimit = values.limit !== undefined;
    const hasOffset = values.offset !== undefined;
    if (hasOffset && !hasLimit) {
        throw new RestError(400, "UNKNOWN_PARAM", `Query parameter "offset" requires "limit"`);
    }

    const options: Record<string, unknown> = pickOptions(values, [
        "countField",
        "includeRecyclebin",
        "fields",
    ]);

    // level 语义翻译：对外=精确层级（0≡根列表）。
    // - 单根树：物理层即用户视角，根=level 0
    // - 多根树：Level Normalization——用户视角 level = 物理 level - 1，需 +1 换算
    if (values.level !== undefined) {
        const physicalLevel = entry.multiRoot ? Number(values.level) + 1 : Number(values.level);
        const levelField = entry.manager.keyFields.level;
        const exact = `Node.${levelField} = ${physicalLevel}`;
        (options as any).where = where ? `${whereToSql(entry, where)} AND ${exact}` : exact;
    } else if (where) {
        (options as any).where = whereToSql(entry, where);
    }

    const nodes = await entry.manager.getNodes(options);

    // 不带分页参数：裸数组（v1 兼容）；带 limit：envelope（total 为过滤后切片前全量）
    if (!hasLimit) return Response.json(nodes);
    const limit = values.limit as number;
    const offset = hasOffset ? (values.offset as number) : 0;
    return Response.json({
        items: nodes.slice(offset, offset + limit),
        total: nodes.length,
        limit,
        offset,
    });
}

/** where 对象 → 转义等值 SQL（getNodes.where 是 SQL 字符串，防注入必须走 escaper） */
function whereToSql(entry: RegistryEntry, where: Record<string, string>): string {
    const escaper = (entry.manager as any).escaper;
    return Object.entries(where)
        .map(([k, v]) => {
            const col = escaper.escapeId(k);
            const num = Number(v);
            // 数字字面量按数字比较（level=1 而非 level='1'）
            const val = v !== "" && Number.isFinite(num) ? num : escaper.escape(v);
            return `Node.${col} = ${typeof val === "number" ? val : val}`;
        })
        .join(" AND ");
}

/** 解析 JSON body；非法 → 400 INVALID_BODY；validate hook 抛错 → 400 VALIDATION_FAILED */
export async function readBody(
    ctx: RouteContext,
    entry: RegistryEntry,
): Promise<Record<string, unknown>> {
    let body: unknown;
    try {
        body = await ctx.request.json();
    } catch {
        throw new RestError(400, "INVALID_BODY", "Request body must be valid JSON");
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new RestError(400, "INVALID_BODY", "Request body must be a JSON object");
    }
    try {
        entry.validate?.(body);
    } catch (e) {
        throw new RestError(
            400,
            "VALIDATION_FAILED",
            e instanceof Error ? e.message : String(e),
        );
    }
    return body as Record<string, unknown>;
}

/**
 * POST /:tree/nodes：addNodes（201 + Location 三档降级）。
 * at 缺省三分支：单根无根→createRoot、单根有根→根 LastChild、多根→新用户根。
 */
export async function addNodes(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const body = await readBody(ctx, entry);
    const nodes = body.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
        throw new RestError(400, "INVALID_BODY", "body.nodes must be a non-empty array");
    }

    const posStr = (body.pos as string) ?? "lastChild";
    const includeRecyclebin = body.includeRecyclebin === true;

    if (body.at === undefined || body.at === null) {
        // at 缺省：顶层添加
        if (entry.multiRoot) {
            // 多根树：新用户根（MultiRoot.addNodes 顶层形态）
            await service.runWrite(entry, (m) =>
                m.addNodes(nodes as any[], { includeRecyclebin }),
            );
        } else {
            const hasRoot = await (entry.manager as TreeManagerLike).hasRoot?.();
            if (!hasRoot) {
                // 单根无根：createRoot（取第一个节点作为根）
                const first = (nodes as any[])[0];
                await service.runWrite(entry, (m) =>
                    (m as TreeManagerLike).createRoot!(first),
                );
            } else {
                // 单根有根：挂到根下
                const root = await (entry.manager as TreeManagerLike).getRoot?.();
                const rootId = root?.[entry.manager.keyFields.id];
                await service.runWrite(entry, (m) =>
                    m.addNodes(nodes as any[], {
                        at: root,
                        pos: toRelPosition(posStr),
                        includeRecyclebin,
                    }),
                );
                if (rootId !== undefined) {
                    return new Response(null, {
                        status: 201,
                        headers: { location: `/${entry.name}/nodes/${rootId}` },
                    });
                }
            }
        }
    } else {
        // at 指定：常规添加
        const at = toNodeId(String(body.at), entry);
        await service.runWrite(entry, (m) =>
            m.addNodes(nodes as any[], {
                at: at as any,
                pos: toRelPosition(posStr),
                includeRecyclebin,
            }),
        );
        return new Response(null, {
            status: 201,
            headers: { location: `/${entry.name}/nodes/${body.at}` },
        });
    }

    return new Response(null, { status: 201, headers: { location: `/${entry.name}/nodes` } });
}

/** GET /:tree/nodes/:id：getNode；includeChildren(+1级)/includeDescendants(全子树) 互斥展开 */
export async function getNode(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);

    const expand =
        values.includeChildren === true ? 1 : values.includeDescendants === true ? Infinity : 0;
    if (values.includeChildren === true && values.includeDescendants === true) {
        throw new RestError(
            400,
            "UNKNOWN_PARAM",
            "includeChildren and includeDescendants are mutually exclusive",
        );
    }
    if (values.format !== undefined && expand === 0) {
        throw new RestError(
            400,
            "UNKNOWN_PARAM",
            "format is only valid with includeChildren or includeDescendants",
        );
    }

    // 无展开：单节点直读（includeRecyclebin 门控由 getNode 语义承载）
    if (expand === 0) {
        const node = await entry.manager.getNode(nodeId, {
            ...pickOptions(values, ["includeRecyclebin"]),
        });
        return Response.json(node);
    }

    // 展开：以该节点为根组装（json=嵌套 / list=平铺，自身在前）
    const format = (values.format as string) ?? "json";
    const readOptions = pickOptions(values, ["includeRecyclebin", "countField"]);
    const self = await entry.manager.getNode(nodeId, {
        ...pickOptions(values, ["includeRecyclebin"]),
    });

    if (expand === 1) {
        const children = await entry.manager.getChildren(nodeId, readOptions);
        if (format === "list") {
            return Response.json([self, ...children]);
        }
        return Response.json({ ...self, children });
    }

    // 全子树：getDescendants(includeSelf) 平铺后组装嵌套
    const flat = await entry.manager.getDescendants(nodeId, {
        ...readOptions,
        includeSelf: true,
    });
    if (format === "list") {
        return Response.json(flat);
    }
    return Response.json(buildNested(entry, flat));
}

/** 平铺列表（含自身在前，按 leftValue 排序）→ 嵌套树（单根形态） */
function buildNested(entry: RegistryEntry, flat: any[]): any {
    const kf = entry.manager.keyFields;
    const root = { ...flat[0], children: [] as any[] };
    // 栈：[node, rightValue]，按嵌套集左值序进出栈
    const stack: Array<{ node: any; right: number }> = [
        { node: root, right: flat[0][kf.rightValue] },
    ];
    for (let i = 1; i < flat.length; i++) {
        const n = flat[i];
        while (stack.length && n[kf.leftValue] > stack[stack.length - 1].right) {
            stack.pop();
        }
        const withChildren = { ...n, children: [] as any[] };
        stack[stack.length - 1].node.children.push(withChildren);
        stack.push({ node: withChildren, right: n[kf.rightValue] });
    }
    return root;
}

/** PATCH /:tree/nodes/:id：update */
export async function updateNode(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const body = await readBody(ctx, entry);
    const patch = { ...body, [entry.manager.keyFields.id]: nodeId };
    await service.runWrite(entry, (m) =>
        m.update(patch as any, { ...pickOptions(values, ["includeRecyclebin"]) }),
    );
    const node = await entry.manager.getNode(nodeId);
    return Response.json(node);
}

/** DELETE /:tree/nodes/:id：deleteNode（?recycle + ?includeRecyclebin；detach 不暴露） */
export async function deleteNode(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    await service.runWrite(entry, (m) =>
        m.deleteNode(nodeId, { ...pickOptions(values, ["recycle", "includeRecyclebin"]) }),
    );
    return new Response(null, { status: 204 });
}

// ---------- 关系子端点 ----------

/** GET .../children：getChildren */
export async function getChildren(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const nodes = await entry.manager.getChildren(nodeId, {
        ...pickOptions(values, ["countField", "includeRecyclebin"]),
    });
    return Response.json(nodes);
}

/** GET .../children/:n：getNthChild（1-based，负从尾；多根树降级 getChildren） */
export async function getNthChild(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const nStr = ctx.params.n;
    if (!/^-?\d+$/.test(nStr) || nStr === "0") {
        throw new RestError(400, "UNKNOWN_PARAM", `n must be a non-zero integer`);
    }
    const n = Number(nStr);
    const options = pickOptions(values, ["countField", "includeRecyclebin"]);

    let node: unknown;
    if (typeof entry.manager.getNthChild === "function") {
        node = await entry.manager.getNthChild(nodeId, n, options);
    } else {
        // 多根树降级：getChildren 后按序取
        const children = await entry.manager.getChildren(nodeId, options);
        node = n > 0 ? children[n - 1] : children[children.length + n];
    }
    if (node === undefined || node === null) {
        throw new RestError(404, "NODE_NOT_FOUND", `Child ${n} not found`);
    }
    return Response.json(node);
}

/** GET .../descendants：getDescendants */
export async function getDescendants(
    ctx: RouteContext,
    service: FlexTreeApiService,
): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const nodes = await entry.manager.getDescendants(nodeId, {
        ...pickOptions(values, ["level", "includeSelf", "countField", "includeRecyclebin"]),
    });
    return Response.json(nodes);
}

/** GET .../descendants/count */
export async function getDescendantsCount(
    ctx: RouteContext,
    service: FlexTreeApiService,
): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const count = await entry.manager.getDescendantCount(nodeId, {
        ...pickOptions(values, ["level", "includeRecyclebin"]),
    });
    return Response.json({ count });
}

/** GET .../ancestors：getAncestors（includeRecyclebin 用作 {id} 解析门控） */
export async function getAncestors(
    ctx: RouteContext,
    service: FlexTreeApiService,
): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    // 默认视角下站内节点逻辑不存在：先门控解析
    if (values.includeRecyclebin !== true && entry.manager.recycleBinEnabled) {
        await assertNotInBin(entry.manager, nodeId);
    }
    const nodes = await entry.manager.getAncestors(nodeId, {
        ...pickOptions(values, ["includeSelf", "countField"]),
    });
    return Response.json(nodes);
}

/** GET .../ancestors/count */
export async function getAncestorsCount(
    ctx: RouteContext,
    service: FlexTreeApiService,
): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    if (values.includeRecyclebin !== true && entry.manager.recycleBinEnabled) {
        await assertNotInBin(entry.manager, nodeId);
    }
    const count = await entry.manager.getAncestorsCount(nodeId);
    return Response.json({ count });
}

/** GET .../parent：getParent（includeRecyclebin 门控） */
export async function getParent(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    if (values.includeRecyclebin !== true && entry.manager.recycleBinEnabled) {
        await assertNotInBin(entry.manager, nodeId);
    }
    const node = await entry.manager.getParent(nodeId, {
        ...pickOptions(values, ["countField"]),
    });
    return Response.json(node);
}

/** GET .../siblings：getSiblings */
export async function getSiblings(ctx: RouteContext, service: FlexTreeApiService): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const nodes = await entry.manager.getSiblings(nodeId, {
        ...pickOptions(values, ["includeSelf", "countField", "includeRecyclebin"]),
    });
    return Response.json(nodes);
}

/** GET .../nextsibling */
export async function getNextSibling(
    ctx: RouteContext,
    service: FlexTreeApiService,
): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const node = await entry.manager.getNextSibling(nodeId, {
        ...pickOptions(values, ["countField", "includeRecyclebin"]),
    });
    return Response.json(node ?? null);
}

/** GET .../previoussibling */
export async function getPreviousSibling(
    ctx: RouteContext,
    service: FlexTreeApiService,
): Promise<Response> {
    const entry = service.entry(ctx.params.tree);
    const nodeId = toNodeId(ctx.params.id, entry);
    const { values } = parseQuery(ctx.url, ctx.route!.query!);
    const node = await entry.manager.getPreviousSibling(nodeId, {
        ...pickOptions(values, ["countField", "includeRecyclebin"]),
    });
    return Response.json(node ?? null);
}

/** 门控：默认视角下站内节点与不存在等价（getAncestors/getParent 无原生过滤） */
async function assertNotInBin(manager: TreeManagerLike, nodeId: string | number): Promise<void> {
    const inBin = await manager.isInRecycleBin(nodeId);
    if (inBin) {
        throw new RestError(404, "NODE_NOT_FOUND", "Node not found");
    }
}
