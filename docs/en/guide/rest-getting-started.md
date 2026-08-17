# Getting Started

Express integration in three steps.

## 1. Create a manager and register it

```ts
import express from "express";
import { FlexTreeManager } from "flextree";
import BunSqliteAdapter from "flextree-bun-sqlite-adapter";
import { FlexTreeApiService } from "flextree-rest";
import { createExpressRoutes } from "flextree-rest/express";

// Create the manager as usual (see "Create Tree")
const adapter = new BunSqliteAdapter();
await adapter.open();
await adapter.exec([`CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(60), treeId INTEGER,
    level INTEGER, leftValue INTEGER, rightValue INTEGER
)`]);
const manager = new FlexTreeManager("menu", { adapter });

// Register with the service
const service = new FlexTreeApiService();
service.register("menu", manager, {
    fields: ["title"],              // optional: where filter field whitelist
    // validate: (body) => {...},   // optional: body validation hook (throw → 400)
    // idType: "number",            // optional: NodeId type (smart conversion by default)
});
```

`register` accepts both `FlexTreeManager` and `MultiRootFlexTreeManager` (multi-root trees: `?level=0` returns user roots, top-level insertion creates a new user root).

## 2. Mount

```ts
const treeRouter = await createExpressRoutes(service);

const app = express();
app.use(express.json());            // ⚠️ body parser must come first (binding contract)
app.use("/api/trees", treeRouter);  // mount path is your decision
app.listen(3000);
```

## 3. Call

```bash
curl http://localhost:3000/api/trees/menu/nodes
# [{"id":1,"name":"Home","level":0,...}]

curl -X POST http://localhost:3000/api/trees/menu/nodes \
  -H "content-type: application/json" \
  -d '{"nodes":[{"name":"Products"}]}'
# HTTP/1.1 201 Created
# Location: /menu/nodes/1
```

> **POST responses do not include the new node id** (auto-increment ids are generated in the DB and `addNodes` does not return them) — follow the `Location` header to re-fetch.

## Core concepts

| Concept | Description |
|---|---|
| **API Service** | `FlexTreeApiService`: holds the tree registry and write queue, HTTP-agnostic |
| **Standard Handler** | WinterCG fetch `(Request) => Response` pure-function routing layer (usable standalone, see [Integrations](/en/guide/rest-integrations)) |
| **Binding** | thin adapter translating framework requests into standard Requests, imported via opt-in subpaths |
| **Write Queue** | every write request is wrapped in one `manager.write()` (one atomic transaction per request); writes on the same tree are serialized, transparent to clients |

For Hono / Elysia / Next.js see [Integrations](/en/guide/rest-integrations). Complete runnable examples: `examples/rest-hono`, `examples/rest-express`, `examples/rest-nextjs`.
