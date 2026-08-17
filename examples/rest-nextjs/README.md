# flextree-rest + Next.js 示例

Next.js App Router 集成 flextree-rest 的最小示例（catch-all route handler）。

## 运行

```bash
bun install
bun ./node_modules/next/dist/bin/next dev -p 3102
```

> **必须用 bun 运行**：本示例用 `flextree-bun-sqlite-adapter`（依赖 `bun:sqlite`）。
> 若你的应用跑在 node 上，换 `flextree-sqlite-adapter` + better-sqlite3（注意原生模块需为 node ABI 编译）。

## 试一试

```bash
curl http://localhost:3102/api/trees                          # 注册树列表
curl http://localhost:3102/api/trees/menu                    # 树信息 + 嵌套导出
curl http://localhost:3102/api/trees/menu/nodes              # 全部节点
curl "http://localhost:3102/api/trees/menu/nodes?level=1"    # 精确层级
curl -X POST http://localhost:3102/api/trees/menu/nodes \
  -H "content-type: application/json" \
  -d '{"nodes":[{"name":"新节点"}],"at":1}'                  # 添加节点
```

## 关键点

- **可选 catch-all**：`app/api/trees/[[...path]]/route.ts`——必选 `[...path]` 不匹配 `/api/trees` 本身（树列表 404）
- **按需导入**：`import { createNextjsHandler } from "flextree-rest/nextjs"`（不经过主入口，elysia 等其他 binding 不进构建）
- **transpile 源码包**：workspace 直引 TS 源码（含装饰器），`next.config.mjs` 需 `transpilePackages` + tsconfig 开 `experimentalDecorators`
- **全局单例**：App Router 无启动钩子，`lib/tree.ts` 用 `globalThis` 缓存 service，首次请求惰性建库
