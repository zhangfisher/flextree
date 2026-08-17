/**
 * flextree-rest + Next.js App Router catch-all 集成
 *
 * 试一试：
 *   curl http://localhost:3102/api/trees
 *   curl http://localhost:3102/api/trees/menu/nodes
 *   curl -X POST http://localhost:3102/api/trees/menu/nodes -H "content-type: application/json" -d '{"nodes":[{"name":"新节点"}]}'
 */
import { createNextjsHandler } from "flextree-rest/nextjs";
import { getService } from "@/lib/tree";

// 惰性初始化：首次请求时建库注册（App Router 无服务器启动钩子）
let handlers: Awaited<ReturnType<typeof createHandlers>> | undefined;

async function createHandlers() {
    return createNextjsHandler(await getService());
}

async function getHandlers() {
    handlers ??= await createHandlers();
    return handlers;
}

export async function GET(request: Request, ctx: any) {
    return (await getHandlers()).GET(request, ctx);
}
export async function POST(request: Request, ctx: any) {
    return (await getHandlers()).POST(request, ctx);
}
export async function PATCH(request: Request, ctx: any) {
    return (await getHandlers()).PATCH(request, ctx);
}
export async function DELETE(request: Request, ctx: any) {
    return (await getHandlers()).DELETE(request, ctx);
}
