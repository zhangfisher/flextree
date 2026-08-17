# flextree-rest + Hono 示例

```bash
bun install
bun run dev   # http://localhost:3100
```

```bash
curl http://localhost:3100/api/trees
curl http://localhost:3100/api/trees/menu/nodes
curl -X POST http://localhost:3100/api/trees/menu/nodes -H "content-type: application/json" -d '{"nodes":[{"name":"新节点"}]}'
```

集成核心（`src/index.ts`）：

```ts
import { FlexTreeApiService } from "flextree-rest";
import { createHonoRoutes } from "flextree-rest/hono";

const service = new FlexTreeApiService();
service.register("menu", manager);

const treeRoutes = await createHonoRoutes(service, { basePath: "/api/trees" });
app.route("/api/trees", treeRoutes); // basePath 必须与挂载前缀一致（c.req.raw 含前缀）
```
