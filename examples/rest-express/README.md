# flextree-rest + Express 示例

```bash
bun install
bun run dev   # http://localhost:3101
```

```bash
curl http://localhost:3101/api/trees/menu/nodes
curl -X POST http://localhost:3101/api/trees/menu/nodes -H "content-type: application/json" -d '{"nodes":[{"name":"新节点"}]}'
```

集成核心（`src/index.ts`）：

```ts
import { FlexTreeApiService } from "flextree-rest";
import { createExpressRoutes } from "flextree-rest/express";

const service = new FlexTreeApiService();
service.register("menu", manager);

const treeRouter = await createExpressRoutes(service);

const app = express();
app.use(express.json());          // ⚠️ 必须先挂 body 解析（binding 约定）
app.use("/api/trees", treeRouter); // 挂载后 req.url 已剥前缀，无需 basePath
```
