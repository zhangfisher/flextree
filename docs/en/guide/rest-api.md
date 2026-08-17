# API

Paths start with `/{tree}` (the registered name). Query parameters are camelCase, mirroring library method options; **parameters not supported by an endpoint are rejected with 400** (strict mode).

## Tree level

| Method | Path | Description |
|---|---|---|
| GET | `/` | Registered tree list `{trees:[{name, multiRoot, recyclebinEnabled}]}` |
| GET | `/{tree}` | Tree info + export, `?format=json\|list` (default json), `?includeRecyclebin` |
| DELETE | `/{tree}` | Clear the whole tree (irreversible) |
| POST | `/{tree}/verify` | Verify, returns `200 {valid, errors[]}` (a failed verification is still 200) |
| POST | `/{tree}/repair` | Repair |

## Nodes

| Method | Path | Query / Body |
|---|---|---|
| GET | `/{tree}/nodes` | `level` (exact level, `?level=0`≡root list) · `fields` · `countField` · `includeRecyclebin` + flat equality where (whitelisted fields) |
| POST | `/{tree}/nodes` | body `{nodes, at?, pos?, includeRecyclebin?}` → **201 + Location** (`at` omitted = top-level insertion) |
| GET | `/{tree}/nodes/{id}` | `includeChildren` (+1 level) / `includeDescendants` (whole subtree), mutually exclusive; `format=json\|list` only valid when expanding |
| PATCH | `/{tree}/nodes/{id}` | body with node fields (non-key fields) |
| DELETE | `/{tree}/nodes/{id}` | `recycle=true\|false` · `includeRecyclebin` (allow deleting in-bin nodes) |

`pos` values: `lastChild` (default) / `firstChild` / `nextSibling` / `previousSibling`.

`{id}` in URLs: pure digits without leading zeros match as number (`"0"` is a number, `"007"` is a string); register with `idType` to pin the type.

## Node relations

Prefix `/{tree}/nodes/{id}`, all support `countField` + `includeRecyclebin`:

| Path suffix | Extra params | Returns |
|---|---|---|
| `/children` | `includeDescendants` | node array |
| `/children/{n}` | n is a 1-based integer, negative counts from the end | node |
| `/descendants` | `level` · `includeSelf` · `includeDescendants` | node array |
| `/descendants/count` | `level` | `{count}` |
| `/ancestors` | `includeSelf` | node array |
| `/ancestors/count` | | `{count}` |
| `/parent` | | node |
| `/siblings` | `includeSelf` | node array |
| `/nextsibling` · `/previoussibling` | | node or `null` |

> `fields` projection is only supported by `GET /{tree}/nodes` (library method signatures); passing `fields` to relation endpoints → 400.

## Node actions

| Method | Path suffix | Body / Query |
|---|---|---|
| POST | `/move` | `{to?, pos?, treeId?, includeRecyclebin?}`; restore = with `includeRecyclebin:true`; move out as a new tree = omit `to` + provide `treeId` |
| POST | `/copy` | `{includeDescendants?, to?, pos?, treeId?, fields?}` → 201 + copy root |
| POST | `/moveup` · `/movedown` | |
| GET | `/canmoveto` | query `to` · `pos` → `{allowed}` |

## Recycle bin

| Method | Path | Description |
|---|---|---|
| GET | `/{tree}/recyclebin` | recycled node list |
| DELETE | `/{tree}/recyclebin` | permanently empty |

If the tree has no recycle bin configured → `409 RECYCLEBIN_NOT_ENABLED`. **Restore** = `POST .../move` + `includeRecyclebin:true` (move the in-bin node out).

## Error format

Errors are RFC 9457 `application/problem+json`:

```json
{
    "type": "about:blank",
    "title": "Node not found",
    "status": 404,
    "detail": "Node not found",
    "code": "NODE_NOT_FOUND"
}
```

| code | HTTP | Scenario |
|---|---|---|
| `UNKNOWN_PARAM` / `INVALID_POS` / `INVALID_BODY` / `VALIDATION_FAILED` / `FIELD_NOT_ALLOWED` | 400 | strict-mode validation, validate hook |
| `TREE_NOT_FOUND` / `NODE_NOT_FOUND` / `ROUTE_NOT_FOUND` | 404 | unregistered tree / node missing or logically invisible / unknown route |
| `METHOD_NOT_ALLOWED` | 405 | path exists, method does not |
| `RECYCLEBIN_NOT_ENABLED` | 409 | recycle bin not configured |
| `NODE_INVALID_OPERATION` | 422 | invalid move etc. |
| `DRIVER_ERROR` | 503 | database disconnected |
| `VERIFY_FAILED` / `FLEXTREE_ERROR` / `INTERNAL_ERROR` | 500 | other library errors / unknown |

Custom mapping: `new FlexTreeApiService({ onError: (err) => ({ ... }) })` — return a problem object to override, or `undefined` to fall through.

## v1 boundaries

No pagination (narrow scope with `level` / where), no OpenAPI generation, no event streaming (SSE/Webhook), DELETE does not expose `detach`. Write requests are serialized per tree — high-frequency write throughput on a single large tree is bounded by the serial queue (an inherent cost of the Nested Set Model; reads are unaffected).
