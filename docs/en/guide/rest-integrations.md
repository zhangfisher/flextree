# Integrations

Bindings are **async factories** (frameworks are dynamically imported — an uninstalled framework is never loaded) returning **native framework route artifacts**: mount path, mount style and lifecycle are all decided by the host.

## Express

```ts
import { createExpressRoutes } from "flextree-rest/express";

const treeRouter = await createExpressRoutes(service);

const app = express();
app.use(express.json());            // ⚠️ body parser must come first (binding contract)
app.use("/api/trees", treeRouter);  // after mounting, req.url has the prefix stripped — no basePath needed
```

> Without `express.json()`, requests with a body get `400 BODY_NOT_PARSED` (a descriptive error, not a silent empty body).

## Next.js

`app/api/trees/[[...path]]/route.ts` — an **optional catch-all** (a required `[...path]` does not match `/api/trees` itself, the tree list would 404):

```ts
import { createNextjsHandler } from "flextree-rest/nextjs";
import { getService } from "@/lib/tree"; // your global singleton service

const handlers = createNextjsHandler(await getService());

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
```

Both Next 14 (object params) and Next 15 (Promise params) are supported. When importing workspace TS sources directly, add `transpilePackages: ["flextree", "flextree-rest", ...]` and enable `experimentalDecorators` in tsconfig (see `examples/rest-nextjs`).

## Hono

```ts
import { createHonoRoutes } from "flextree-rest/hono";

const treeRoutes = await createHonoRoutes(service, { basePath: "/api/trees" });
app.route("/api/trees", treeRoutes);
```

`c.req.raw`'s pathname keeps the mount prefix; pass `{ basePath: "/api/trees" }` to strip it explicitly when translating at the fetch entry.

## Elysia

```ts
import { createElysiaRoutes } from "flextree-rest/elysia";

const treeApp = await createElysiaRoutes(service);
const app = new Elysia().use(treeApp);
```

## Other frameworks / custom integration

Skip bindings and use the Standard Handler directly (any environment that can produce a WinterCG `Request` works):

```ts
import { createHandler } from "flextree-rest";

const handle = createHandler(service, { basePath: "/api/trees" });
// inside any framework's middleware:
const response = await handle(new Request(url, { method, headers, body }));
```

## basePath semantics

| Binding | basePath default | Notes |
|---|---|---|
| express | `""` | `app.use(prefix, router)` already strips the prefix — keep the default |
| hono | `""` | after `app.route(prefix, sub)` the pathname keeps the prefix — pass it when it matches the mount |
| elysia | `""` | pass as needed when handling directly |
| nextjs | n/a | catch-all segments are naturally relative |
