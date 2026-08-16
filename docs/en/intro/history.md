# Changelog

## 3.1

3.1 focuses on **reversible deletion, node copying, and multi-shape trees** — adding the recycle bin (logical deletion), `copyNode`, cross-tree operations, and multi-root trees.

### New Features

- **Recycle bin (logical deletion)**: Enabled via the `recyclebin` config. `deleteNode(node, { recycle: true })` moves the subtree into the recycle bin with its internal structure intact (reuses the move algorithm, atomic in a transaction); `clearRecycleBin()` empties it in one call. All read and write methods accept the `includeRecyclebin` view parameter — under the default view, nodes inside the bin logically do not exist; with `true` they behave as ordinary nodes (restore = read out in the bin view + `moveNode` out).
- **Node copy `copyNode`**: The whole operation runs in a transaction with a fixed number of set-based SQL statements — database access count is independent of descendant count. Supports copying only the node itself (`includeDescendants: false`), field filtering (`fields`), and cross-tree copying (`options.treeId`).
- **Cross-tree move**: `moveNode` accepts `options.treeId` to move a subtree across trees; when `toNode` is omitted, the node migrates out as the root of a new tree with that treeId; `canMoveTo` supports cross-tree checks as well.
- **Multi-root tree `MultiRootFlexTreeManager`**: Delivers a user-facing tree with multiple top-level nodes via a hidden root, with automatic level normalization — all single-tree operations work as-is.
- **`countField` descendant count**: All query methods and export methods (`toJson`/`toList`) support the `countField` parameter, computed directly by the database as `(rightValue - leftValue - 1) / 2` — unaffected by `level` truncation; visible scope when the recycle bin is enabled.
- **New sql.js adapter** (`flextree-sqljs-adapter`): Based on sql.js, runs a full tree structure in the browser (wasm).

## 3.0

3.0 is a major upgrade focused on **data safety, database compatibility, and developer experience**.

### New Features

- **Transactional writes & concurrency dirty-read fix**: All operations inside `write` are now wrapped in a database transaction—any failure rolls back the whole batch; a write-transaction context isolation and a read guard prevent concurrent reads from seeing intermediate states (dirty reads) during writes.
- **Singleton pattern**: `FlexTreeManager.getInstance` returns the same instance by table name, avoiding duplicate creation.
- **Node events**: Added node-level events such as `node:added`, `node:deleted`, `node:cleared`, `node:updated`, and `node:moved`.
- **Tree traversal `forEach`**: Supports both DFS / BFS modes, with interruption, level limiting, and a configurable start point.
- **Tree repair `repair`**: Rebuilds corrupted left/right value structures based on `level` and automatically verifies integrity.
- **Nested batch add**: `addNodes` supports adding a whole subtree at once via the `children` field.
- **`FlexTree` lazy loading**: Added a `lazy` option so nodes can be loaded on demand.
- **Tree export**: `FlexTreeManager` adds the `getTree` / `toJson` / `toList` convenience methods.
- **Fine-grained verification**: `verify` checks via pure SQL, covering node totals, value integrity, basic relations, uniqueness, and level relations.
- **New Bun SQLite adapter** (`flextree-bun-sqlite-adapter`).
- **Type enhancements**: `treeId` supports `string`; added the `FlexTreeNodeInput` nested input type.

### Improvements

- Toolchain migrated from pnpm to **Bun**; tests migrated to **Bun Test**.
- Upgraded TypeScript to 6 and oxlint to 1.76.
- Test cases are now inlined into each package's `__tests__/`, along with a brand-new shared test toolkit.

### Breaking Changes

- Adapter interface: `ready` → `connected`; added required method `transaction` and optional field `type`.
- `FlexTreeManager`: `ready()` → `connected()`, `assertDriverReady()` → `assertConnected()`.
- Removed the `sqlstring` dependency in favor of a built-in SQL escaper.
- Now requires TypeScript 6 or above.

## 2.x and Earlier

See [GitHub Releases](https://github.com/zhangfisher/flextree/releases).
