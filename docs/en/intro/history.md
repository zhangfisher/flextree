# Changelog

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
