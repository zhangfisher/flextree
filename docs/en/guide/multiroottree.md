# MultiRootFlexTree

## Overview

[FlexTree](./flextree.md) loads a tree into memory as a query-first object tree — but it only supports a single root. For [multi-root trees](./multiroot.md) (file systems, category trees), `MultiRootFlexTree` is the multi-root counterpart of `FlexTree`.

The essence of `MultiRootFlexTree`: **load a multi-root tree into memory, build a query-first object tree, and expose an API almost identical to `FlexTree`**.

### Design Motivation

Same as `FlexTree`: multi-root trees are also based on the nested-set model (a query-first storage structure). In read-heavy scenarios, once the tree is loaded into memory, navigation, search, traversal, and export all complete locally with zero database round-trips.

### Core Features

- **In-memory object tree**: `load` loads all user roots and their subtrees, building nested object trees of `FlexTreeNode` instances. Full load by default; with `lazy: true`, only each user root and its first-level children are loaded — deeper subtrees load on demand.
- **Zero database queries**: within loaded ranges, `getByPath`, `get`, `find`, `findAll`, `forEach` and node navigation (`parent`, `children`, `siblings`, `ancestors`, `descendants`, ...) all complete in memory.
- **No hidden root**: reads go directly through `MultiRootFlexTreeManager` — the hidden root is filtered out and levels are normalized (user root `level=0`). The hidden root simply does not exist in the memory tree; user roots are the top-level nodes.
- **Live Tree**: the same auto-sync mechanism as `FlexTree` — listens to committed writes on the shared manager, marks dirty, and reloads automatically.
- **Synchronous export**: `toJson`/`toList` export synchronously from the memory tree.

### Division of Labor

|  | `MultiRootFlexTreeManager` | `MultiRootFlexTree` |
| ----  |  ---- | ---- |
| Role | Database-facing multi-root manager | In-memory multi-root query tree |
| Reads | Every query generates SQL | In-memory after load, zero queries |
| Structural writes | Supported (add/delete/move/copy) | Not supported |
| Data updates | `update` | Supported (`FlexTreeNode.update`, transactional under the hood) |
| Best for | Frequent writes, large trees | Read-heavy, frequent queries |

When a `MultiRootFlexTree` is instantiated, it shares a `MultiRootFlexTreeManager` through the singleton mechanism (accessible via `tree.manager`):

- Node data updates (`FlexTreeNode.update`) go through that manager in a transaction and refresh the in-memory node on success.
- Structural writes (add/delete/move) should go through `tree.manager`; the memory tree reloads automatically afterwards (Live Tree).

## Creating a Tree

```ts {6-9}
import { MultiRootFlexTree } from 'flextree'
import BunSqliteAdapter from 'flextree-bun-sqlite'

const driver = new BunSqliteAdapter()
await driver.open()

const tree = new MultiRootFlexTree('tree', {
    adapter: driver
})
await tree.load()
```

Options match `FlexTree` (`adapter`, `fields`, `recyclebin`, `lazy`), plus `hiddenRootName` (passed through to the manager, default `__root__`). Note that **`treeId` is not allowed** — multi-root trees are based on a single-tree table.

:::tip
If your app already created a `MultiRootFlexTreeManager` via `MultiRootFlexTreeManager.getInstance`, the tree will hit that same singleton — this is the key to Live Tree event propagation.
:::

## Object Tree

After loading, `.nodes` returns the list of user-root `FlexTreeNode` instances, each carrying its own subtree:

<LiteTree>
FlexTreeNode(A)                                  // user root, parent=undefined
    children({color:red}[])                      //*
        FlexTreeNode(A1)
        FlexTreeNode(A2)
FlexTreeNode(B)                                  // user root
    children({color:red}[])                      //*
        FlexTreeNode(B1)
FlexTreeNode(C)                                  // user root
</LiteTree>

## Loading

### Full Load

```ts
const tree = new MultiRootFlexTree('tree', { adapter: driver })

console.log(tree.status)   // == 'idle'
await tree.load()          // one query loads all user nodes
console.log(tree.status)   // == 'loaded'
tree.nodes                 // user root node instances
```

An important difference from `FlexTree`: **an empty tree is a valid state**. Zero user roots is a normal business state; `load()` resolves with `nodes=[]` and `status='loaded'` — unlike `FlexTree`, it does not throw `FlexTreeNotFoundError`.

### Lazy Loading

For huge trees, set `lazy: true`: `load` only loads each user root and its first-level children; deeper subtrees load on demand via `FlexTreeNode.load()`:

```ts
const tree = new MultiRootFlexTree('tree', {
    adapter: driver,
    lazy: true
})
await tree.load()

const a1 = tree.getByPath('A/A1')!
console.log(a1.status)     // == 'loaded' (A1 itself is loaded)
console.log(a1.children)   // == [] (its children are not)
await a1.load()            // load A1's subtree on demand
```

## Node Navigation

All `FlexTreeNode` navigation properties work; the semantic differences concentrate on **user roots**:

| Property | Regular node | User root |
| ----  |  ---- | ---- |
| `parent` | Parent node | `undefined` (the hidden root does not exist in memory) |
| `root` | Walks up the parent chain to its user root | Itself |
| `siblings` | Other nodes under the same parent | **The other user roots** (user roots are real siblings) |
| `ancestors` | Ancestor chain up to the user root | `[]` |

```ts
tree.nodes[0].parent      // undefined
tree.nodes[0].root        // itself
tree.nodes[0].siblings    // other user roots as FlexTreeNode[]

const a1 = tree.get(3)!
a1.root                   // its user root (A)
a1.ancestors              // [A]
```

- `node.level` is the **normalized level**: user root `level=0`, its children `level=1`, and so on.
- `node.tree` returns the owning `MultiRootFlexTree` instance.

## Accessing Nodes by Path

`getByPath` paths start from **user roots**: the first segment is matched against user roots by `byField` (default `name`); remaining segments resolve inside that root:

```ts
tree.getByPath('A')            // user root A
tree.getByPath('A/A1')         // node named A1 under A
tree.getByPath('./A/A1')       // './' prefix is equivalent to no prefix
tree.getByPath('B/B1', { byField: 'name' })
```

Differences from `FlexTree.getByPath`:

- **`'/'` is no longer a root anchor** — a multi-root tree has no single root; `getByPath('/')` and `getByPath('/A')` return `undefined`.
- **`'../'` cannot go above a user root** — user roots have no parent; `'../...'` returns `undefined`. Inside a root, `'../'` relative syntax works as usual.

`update(path, data)` uses the same path resolution and throws `FlexTreeNotFoundError` when the path does not exist:

```ts
await tree.update('A/A1', { title: 'new title' })
```

## Getting and Finding Nodes

`get`/`find`/`findAll`/`forEach` operate across **all user trees**:

```ts
tree.get(6)                          // by id, across roots
tree.get((n) => n.name === 'C')      // by condition (including user roots)
tree.find((n) => n.level > 0)        // first match
tree.findAll((n) => n.name.startsWith('A'))
tree.forEach((node, parent) => { ... })   // traverse all user trees (dfs/bfs)
```

- `find`/`findAll` **include user roots** (each root is traversed independently; there is no "exclude the root" semantics as in single-root trees).
- In traversal callbacks, `parent` is `undefined` for user roots.

## Node Status

`FlexTreeNode.status` works the same as in `FlexTree` (`idle`/`loading`/`loaded`/`error`). `MultiRootFlexTree.status` is **aggregated across roots**:

- Any root `error` → `error`; else any `loading` → `loading`; else any `idle` → `idle`
- All `loaded` (or zero roots) → `loaded`; before `load` → `idle`

## Live Tree: Auto Sync

Identical mechanism to [FlexTree's Live Tree](./flextree.md#live-tree-auto-sync):

```ts
const manager = MultiRootFlexTreeManager.getInstance('tree', { adapter })  // singleton manager
const tree = new MultiRootFlexTree('tree', { adapter })                    // hits the same singleton
await tree.load()

// any committed write via manager afterwards...
await manager.write(async () => {
    await manager.addNodes([{ name: 'D' }])
})
// ...triggers: tree.dirty = true → full reload → dirty = false
```

- **Dirty only after commit confirmation**: `node:*` events are held during the transaction; dirty-and-reload starts only after `write:after` carries `committed: true`. **Rollbacks do not mark dirty** — the memory tree stays valid.
- **Dirty-read protection**: reads during a reload throw `FlexTreeDirtyError`.
- **Self-initiated writes skip reload**: `tree.update`'s write path refreshes in-memory data synchronously.
- **After clear(), settles as an empty tree**: when the manager clears all user roots, the automatic reload ends with `nodes=[]`, `dirty=false`.
- Boundary same as `FlexTree`: only writes on the same in-process singleton manager are visible; use `sync()`/`load()` as the fallback for cross-process writes.

### MultiRootFlexTree Singleton

`MultiRootFlexTree.getInstance(tableName, options)`, keyed by **tableName+lazy** (no treeId dimension):

```ts
const tree1 = MultiRootFlexTree.getInstance('tree', { adapter })
const tree2 = MultiRootFlexTree.getInstance('tree', { adapter })
expect(tree1).toBe(tree2)        // same key hits the same instance, sharing load state

// lazy and non-lazy forms of the same table are distinct instances
const lazyTree = MultiRootFlexTree.getInstance('tree', { adapter, lazy: true })
expect(lazyTree).not.toBe(tree1)
```

Adapter consistency is validated on singleton hits; a mismatch throws `FlexTreeError`. Clean up with `MultiRootFlexTree.clearInstance()` (pair it with `MultiRootFlexTreeManager.clearInstance()`).

## Export

`toJson`/`toList` export **synchronously** from the memory tree, aligned with `MultiRootFlexTreeManager.toJson/toList`:

```ts
tree.toJson()
// [
//   { id: 2, name: 'A', children: [{ id: 3, name: 'A1' }, { id: 4, name: 'A2' }] },
//   { id: 5, name: 'B', children: [{ id: 6, name: 'B1' }] },
//   { id: 7, name: 'C' },
// ]

tree.toList()
// [
//   { id: 2, name: 'A', pid: 0 },      // user roots get pid=0; hidden root id never leaks
//   { id: 3, name: 'A1', pid: 2 },
//   ...
// ]
```

- `toJson` returns a **multi-root nested array** (`FlexTree` returns a single root object).
- `level` is normalized (user root `level=0`).
- `countField` is supported; with the recycle bin enabled it uses the visible scope (see [Export](./export#countfield-descendant-count)).

## Events

`MultiRootFlexTree` proxies the internal `MultiRootFlexTreeManager` event mechanism:

```ts
tree.on('node:added', ({ nodes }) => {
    console.log(`${nodes.length} nodes added`)
})
```

## API Differences

Compared with `FlexTree`, the differences are only:

| Difference | Description |
| --- | --- |
| `.nodes` replaces `.root` | Returns user-root `FlexTreeNode` instances; `.root` is always `undefined` |
| `id` is always `undefined` | Multi-root trees disallow `treeId` |
| `load()` with an empty tree is valid | Zero roots → `nodes=[]`, `status='loaded'`, no throw |
| `getByPath` matches user roots first | `'/'` and `'../'` have no anchor at tree level, return `undefined` |
| `toJson` returns a multi-root array | `toList` gives user roots `pid=0` |
| `find`/`findAll` include user roots | Each root traversed independently |
| `status` aggregated across roots | `error` > `loading` > `idle` > `loaded` |
| `siblings` (user root) | Returns the other user roots |
| Singleton key has no treeId | Keyed by tableName+lazy |

## MultiRootFlexTree API

- **Properties**

| Property | Type | Description |
| ----  |  ---- | ---- |
| `nodes` | `FlexTreeNode[]` | User-root node instances; empty array before load; throws `FlexTreeDirtyError` during reload |
| `root` | `undefined` | Always `undefined` |
| `id` | `undefined` | Always `undefined` |
| `status` | `FlexTreeNodeStatus` | Load status aggregated across roots |
| `options` | `MultiRootFlexTreeOptions` | Options |
| `manager` | `MultiRootFlexTreeManager` | Internal manager (singleton, shared with user managers) |
| `dirty` | `boolean` | Live Tree dirty flag |
| `lazy` | `boolean` | Whether lazy loading is enabled |

- **Methods**

| Method | Returns | Description |
| ----  |  ---- | ---- |
| `getInstance` | `MultiRootFlexTree` | (static) Singleton instance keyed by tableName+lazy |
| `clearInstance` | `void` | (static) Clear singleton registry |
| `load` | `Promise<void>` | Load all user trees (empty tree is valid) |
| `getByPath` | `FlexTreeNode \| undefined` | First path segment matched against user roots |
| `get` | `FlexTreeNode \| undefined` | By `id` or condition across all user trees |
| `find` | `FlexTreeNode \| undefined` | First node matching the condition (including user roots) |
| `findAll` | `FlexTreeNode[]` | All matching nodes (including user roots) |
| `forEach` | `void` | Traverse all user trees |
| `update` | `Promise<void>` | Update node data by path |
| `sync` | `Promise<void>` | Re-load data of loaded nodes from the database |
| `toJson` | `FlexTreeExportJsonFormat[]` | Synchronously export as a multi-root nested array |
| `toList` | `FlexTreeExportListFormat` | Synchronously export as a `pid` list (user roots `pid=0`) |
| `on`/`off`/`emit` | `void` | Event subscribe/remove/emit |

Node instances are the shared `FlexTreeNode`; see the [FlexTree docs](./flextree.md#flextreenode-api) for its API and the multi-root semantic differences in "Node Navigation" above.
