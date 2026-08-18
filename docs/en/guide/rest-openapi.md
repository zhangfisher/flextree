# OpenAPI

Works out of the box: **`GET {mount-point}/openapi.json` serves the OpenAPI 3.1 document directly** (browser or curl), zero configuration.

```bash
# mounted at /api/trees:
curl http://localhost:3000/api/trees/openapi.json
```

The document is generated from the declarative route table — the same source runtime validation uses (one declaration, two consumers), so it cannot drift from the implementation. It is generated on first request and cached; registry changes (register/unregister) invalidate the cache automatically.

## Configuration

```ts
const service = new FlexTreeApiService({
    openapi: {
        enabled: true,                    // false: disable the built-in endpoint (→ 404)
        info: { title: "My Tree API", version: "1.0.0" },
        servers: [{ url: "https://api.example.com/api/trees" }],  // defaults to basePath-derived
    },
});
```

**Default servers derivation**: the binding's basePath (e.g. the `basePath` passed when hono mounts at `/api/trees`) automatically becomes `servers[0].url`. For public deployments or gateway proxies, pass the real reachable address explicitly.

## nodeSchema: describing business fields precisely

By default the node schema is loose (`additionalProperties: true` + key fields listed from the registered keyFields). Provide a `nodeSchema` (JSON Schema) at registration for precision:

```ts
service.register("menu", manager, {
    nodeSchema: {
        type: "object",
        properties: {
            id: { type: "integer" },
            name: { type: "string" },
            title: { type: "string" },
            size: { type: "integer" },
        },
        required: ["id", "name"],
    },
});
```

With multiple registered trees each gets its own schema (`#/components/schemas/TreeNode-{treeName}`), and node responses reference all of them via `oneOf`. `nodeSchema` is embedded verbatim without structural validation — correctness is the provider's responsibility.

## Pure-function usage (advanced)

`generateOpenApiDocument` works without the built-in endpoint:

```ts
import { generateOpenApiDocument } from "flextree-rest";

// write to file / CI validation / custom mounting
const doc = generateOpenApiDocument(service, {
    info: { title: "My Tree API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com/api/trees" }],
});
await Bun.write("openapi.json", JSON.stringify(doc, null, 2));
```

## Document coverage

- **Included**: 26 endpoints (including `/openapi.json` itself), path/query parameters (types, enum, integer/minimum), response schemas (including the pagination envelope `oneOf`), unified error responses (RFC 9457 `application/problem+json` + the `Problem` component)
- **Not included**: requestBody schemas for write endpoints (see [API](/en/guide/rest-api) for body shapes, a v0.2 boundary); dynamic where-filter fields (per-tree whitelists, described in description text)

## Swagger UI

The document is standard OpenAPI 3.1 — any compatible tool can consume it:

```ts
// hono + @hono/swagger-ui
import { SwaggerUI } from "@hono/swagger-ui";
app.get("/docs", SwaggerUI({ url: "/api/trees/openapi.json" }));
```
