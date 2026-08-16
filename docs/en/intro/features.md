# Features & Strengths

Building on the `Left-Right Value` algorithm, `FlexTree` provides a complete, easy-to-use, type-safe set of tree-storage management capabilities. Its main strengths are described below.

## Concise API

`FlexTree` provides semantic method names that cover nearly all common tree operations—no need to hand-write `SQL`:

```ts
// Query
await tree.getChildren(node)
await tree.getDescendants(node, { level: 2, includeSelf: true })
await tree.getAncestors(node)
await tree.getParent(node)
await tree.getSiblings(node)

// Updates (must be executed inside write)
await tree.addNodes([...], { at: node })
await tree.moveNode(source, target, LastChild)
await tree.deleteNode(node)
```

Meanwhile, `FlexTree` is built with `TypeScript` and provides full generics support—custom fields and custom key-field names all get precise type hints.

## Efficient Tree Queries

Thanks to the `Left-Right Value` algorithm, every relational query in `FlexTree` (descendants, ancestors, children, siblings, parent, etc.) can be completed in a **single `SQL` statement** with no recursive queries required. The deeper the tree, the greater the advantage over an Adjacency List. Queries also support fine-grained options such as limiting the `level` and whether to include the node itself (`includeSelf`).

## Complete Tree Operations

Around the lifecycle of a tree, `FlexTree` provides a complete set of operations:

- **Add**: `createRoot` creates the root node; `addNodes` supports insertion at four positions—`last child`, `first child`, `previous sibling`, and `next sibling`—and can add a whole subtree at once via a nested `children` structure.
- **Delete**: `deleteNode` removes a node along with its entire subtree; `clear` empties the whole tree.
- **Move**: `moveNode` supports four relative-position moves, plus `moveUpNode` / `moveDownNode` to move a node up or down.
- **Update**: `update` modifies a node's business fields.
- **Find**: `findNode` / `findNodes` retrieve nodes by condition.

## Data Safety Guarantees

`FlexTree` safeguards tree operations at multiple levels:

- **Transactional writes**: All operations inside `write` are wrapped in the same database transaction—any step failure rolls back the whole batch, preventing half-finished tree structures.
- **Concurrency dirty-read protection**: While a write is in progress, external concurrent reads automatically wait for the write to finish, avoiding intermediate left/right values.
- **Integrity & repair**: `verify` checks whether the tree structure is corrupted via pure `SQL`; `repair` can rebuild corrupted left/right values and levels.

## Multi-Database & Extensibility

`FlexTree` decouples tree logic from database access via the adapter pattern:

- Ships with three adapters—`SQLite`, `Prisma`, and `Bun SQLite`—covering common scenarios.
- A built-in multi-database `SQL` escaper supports differential generation for dialects such as `SQLite`, `MySQL`, `PostgreSQL`, `Oracle`, and `SQL Server`.
- Implement the `IFlexTreeAdapter` interface to plug in any other database.

## Flexible Customization

- **Custom fields**: You can customize the names and types of key fields such as `id`, `name`, `leftValue`, `rightValue`, `level`, and `treeId` to fit an existing table schema.
- **Multiple trees in a single table**: Store multiple independent trees in one table via `treeId`, which supports both numbers and strings.
- **Singleton management**: `FlexTreeManager.getInstance` reuses instances by table name, avoiding duplicate creation.

## Traversal & Export

- **Traversal**: `forEach` supports both `Depth-First (DFS)` and `Breadth-First (BFS)` modes, with interruption and level limiting.
- **Export**: `toJson` / `toList` export the tree as nested `JSON` or as a flat list with a `pid`.
- **In-memory tree**: The `FlexTree` object loads the tree into memory and offers richer `API`s such as `getByPath` path access and lazy loading.

## Event Mechanism

`FlexTreeManager` has a built-in event mechanism. In addition to the `write:before` / `write:after` hooks around write operations, it also provides node-level events such as `node:added`, `node:deleted`, `node:moved`, `node:updated`, and `node:cleared`, so the business layer can react to tree changes. The `write:commit` event fires before a transaction commits, aggregating all SQL of the `write`.

## Limitations

The strengths of `FlexTree` come from the `Left-Right Value` algorithm, and so do its limitations. Weigh these against your actual scenario when choosing:

- **Higher write cost**: Any add, delete, or move of a node requires reordering the left/right values of related nodes and may affect `1-N` rows. `FlexTree` is a **query-first** storage structure, best suited for **read-heavy, write-light** scenarios; if your business is dominated by frequent structural changes, an Adjacency List may be a better fit.
- **No concurrent writes**: A tree based on left/right values strictly depends on value consistency—concurrent writes to the same tree are rejected (an exception is thrown). Reads can be concurrent, but only one write can run at a time.
- **Sensitive to direct database modifications**: Any operation that bypasses `FlexTree` and modifies the tree table directly via `SQL` (especially changes to `leftValue` / `rightValue` / `level`) can corrupt the tree structure. Use `verify` to detect and `repair` to fix such cases.
- **Theoretical upper bound of integer left/right values**: Left/right values are integers; extremely large trees (e.g., a single tree whose node count approaches the integer limit) may hit the value range, though this is rarely encountered in practice.
- **Cross-tree move overhead**: In a multiple-trees-per-table scenario, moving a subtree from one tree to another involves cross-tree left/right value reordering and costs more than an in-tree move.

:::tip Selection Advice
If your scenario is **read-heavy tree data such as organization charts, category catalogs, menus, or nested comments**, `FlexTree`'s query performance and developer-efficiency advantages are clear; for **high-frequency writes or frequent structural changes**, fully evaluate write performance before choosing.
:::
