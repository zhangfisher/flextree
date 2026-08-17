# Install

`flextree-rest` maps `FlexTreeManager` capabilities to a HTTP RESTful API. It does not listen on a port or bind to any web framework — mount it into express / hono / elysia / nextjs via framework bindings.

```bash
bun add flextree-rest
```

Framework bindings are opt-in (optional peers — not installing one does not affect the others):

```bash
bun add hono        # when using the hono binding
bun add express     # when using the express binding
bun add elysia      # when using the elysia binding
# nextjs needs no extra dependency (structural typing, zero imports)
```

Subpath entries:

| Import | Contents |
|---|---|
| `flextree-rest` | `FlexTreeApiService`, `createHandler`, error utilities, types |
| `flextree-rest/hono` | `createHonoRoutes` |
| `flextree-rest/express` | `createExpressRoutes` |
| `flextree-rest/elysia` | `createElysiaRoutes` |
| `flextree-rest/nextjs` | `createNextjsHandler` |

For architecture decisions see [ADR-0008](/adr/0008-rest-provider-three-layer-fetch-core) (three-layer design) and [ADR-0009](/adr/0009-rest-write-queue-per-request-transaction) (write queue).
