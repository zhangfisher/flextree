# Recycle Bin

Deleting nodes physically is often too "final" — when users delete things by mistake or your business needs undoable deletion, you need a **recycle bin**. FlexTree's recycle bin provides **logical deletion**: the deleted subtree, with its internal structure intact, is moved into the bin; it can be restored when needed, or purged when not.

## Overview

The recycle bin is enabled by the `recyclebin` option. There is only one core concept — the **Bin node**:

```
Physical layer (bin is a child of root)     User's view (default)
┌────────────────────────────┐
│ R        L=1  R=12         │            R
│  ├─ A    L=2  R=3          │            ├─ A
│  ├─ B    L=4  R=5          │            └─ B
│  └─ bin  L=6  R=11         │  ← bin and its descendants "logically don't exist"
│      ├─ D  L=7  R=8        │     (D and E have been logically deleted)
│      └─ E  L=9  R=10       │
└────────────────────────────┘
```

- The bin is an ordinary node at a **fixed position**: always a child of the root. You configure its `id` and `name`.
- `deleteNode(node, { recycle: true })` moves the node and all its descendants (structure preserved) into the bin via `moveNode` — this is **logical deletion**.
- **Under the default view, the bin and its descendants behave as if they don't exist**: queries don't return them, find can't locate them, traversal skips them, exports exclude them, and update/move/delete throw NotFound.
- When you need to display or operate on the bin contents (e.g. a "Trash" page in a file manager), pass `includeRecyclebin: true` — the bin and its descendants become ordinary nodes again and everything works as usual.

:::tip One principle
Nodes placed in the recycle bin are **logically deleted**. With `includeRecyclebin=false` (the default), they are indistinguishable from non-existent nodes; with `=true`, they are indistinguishable from ordinary nodes. There is no intermediate state.
:::

## Enabling the Recycle Bin

Provide `recyclebin` in the manager options to enable; omit it and the feature is fully off (zero overhead, no extra rows in the table):

```ts
import { FlexTreeManager } from "flextree";
import sqliteAdapter from "flextree-sqlite-adapter";

const tree = new FlexTreeManager("files", {
    adapter: new sqliteAdapter(),
    recyclebin: {
        id: 9999,          // the bin node's id
        name: "__trash__", // the bin node's name
    },
});
```

**Options:**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `options.recyclebin` | object | none | Providing it enables the recycle bin |
| `options.recyclebin.id` | NodeId \| `(treeId) => NodeId` | none | Bin node id; on multi-tree tables, a function may be used to derive it per tree |
| `options.recyclebin.name` | string | none | Bin node name |

**Bin node lifecycle:**

- **Lazy creation**: automatically created on the first `write()` (appended as the root's last child), in the same transaction as your business write.
- **Position check**: if a row with the same id already exists but is not at the root's child level (level≠1), the first `write()` throws a configuration error — the bin must sit under the root. This is the position invariant.
- When not enabled, the `recycle` parameter is ignored and `clearRecycleBin()` silently returns.

:::warning Position invariant
The bin is always a child of the root: it may be reordered among the root's children, but it cannot be moved to any other level of the tree, nor be the source of a cross-tree move. This rules out the self-containment paradox ("recycling a subtree into its own descendant") and prevents recycled content from being silently lost when a business subtree is deleted.
:::

## Logical Deletion

```ts
await tree.write(async () => {
    // Logical deletion: A and all its descendants (structure preserved) move into the bin
    await tree.deleteNode(aId, { recycle: true });
});
```

After deletion:

```ts
await tree.findNode({ name: "A" });          // null — not found in the default view
await tree.getNode(aId);                     // throws NotFound
await tree.getNodes();                       // excludes A and the bin
await tree.verify();                         // true — tree structure remains intact
```

**Notes:**

- `recycle: true` only takes effect **when the recycle bin is enabled**; otherwise it is equivalent to physical deletion.
- No "re-recycling" inside the bin: under the default view, nodes inside the bin cannot be deleted (NotFound); with `includeRecyclebin: true` you enter the bin view, and deletion there is **physical** (the `recycle` parameter has no effect).
- The **entire subtree** is recycled: descendants move in with the hierarchy preserved.

## includeRecyclebin: The Bin View

All public APIs accept the `includeRecyclebin` option (default `false`):

- `false` (default): logically deleted nodes are **treated as non-existent** — invisible to queries, `NotFound` by id for reads/writes, skipped by traversal, excluded from exports. Regular business reads and writes never notice the recycle bin exists.
- `true`: enters the bin view; **the bin node and every node inside it can be operated on just like ordinary nodes** — querying, updating, moving, copying, and deleting all work as usual. **This parameter is what you need when managing the recycle bin itself** — listing its contents (rendering a "Trash" page), reading a node for restoration, permanently deleting from the bin, reordering inside the bin. Under the default view in-bin nodes are invisible; without entering the bin view you cannot even reach the target nodes.

```ts
// Queries: include bin contents
await tree.getNodes({ includeRecyclebin: true });
await tree.getNode(aId, { includeRecyclebin: true });
await tree.findNodes({ name: "A" }, { includeRecyclebin: true });

// Traversal: enters the bin subtree
await tree.forEach(callback, { includeRecyclebin: true });

// Export: the full physical tree
await tree.toJson({ includeRecyclebin: true });

// Writes: rename, move (reorder inside the bin), delete (physically) inside the bin
await tree.update({ id: aId, title: "deleted" }, { includeRecyclebin: true });
await tree.deleteNode(aId, { includeRecyclebin: true });
```

**Coverage:**

- **Enumeration/find** (`getNodes`/`findNode`/`findNodes`/`getDescendants`/`getChildren`/`getSiblings`/`getDescendantCount`/`getNthChild`): SQL-side exclusion of the bin range (filtered at the database, not in memory)
- **Exact lookup** (`getNode`): throws NotFound by default
- **Navigation** (`getNextSibling`/`getPreviousSibling`): skips the bin subtree by default, returns the next logically existing node
- **Writes** (`deleteNode`/`moveNode`/`copyNode`/`addNodes`/`update`): id paths throw NotFound by default; object paths pass under the "object-as-credential" rule
- **Traversal/export** (`forEach`/`toJson`/`toList`): skip/exclude the bin by default
- **Descendant count (`countField`)**: under the default view the count uses the **visible scope** — recycled nodes are excluded (consistent with the exported content; computed and deducted directly in the database `SELECT` expression); with `includeRecyclebin: true` it is the full physical count (see [Export](./export#countfield-descendant-count))
- **Internal mechanisms** (`verify`/`repair`/`clear`): unaffected (the bin is an ordinary tree member, participating in verification and repair)

:::tip Object as credential
Under the default view, no read API ever returns in-bin node objects — **holding an object reference means you must have read it with `includeRecyclebin: true`**. Therefore, passing node objects (instead of ids) to write APIs skips re-validation and executes normally.
:::

## Restoring Nodes

Restoring = read out in the bin view + moveNode out. There is no dedicated API, because both are ordinary nodes:

```ts
await tree.write(async () => {
    // 1. Fetch the node in the bin view
    const node = await tree.getNode(recycledId, { includeRecyclebin: true });
    // 2. Move it to the target position (here: next sibling of B)
    await tree.moveNode(node, bId, {
        pos: FlexNodeRelPosition.NextSibling,
        includeRecyclebin: true,
    });
});
// Visible again in the default view
await tree.findNode({ name: "A" }); // ✅
```

When a node enters the bin, its `level` is renumbered according to its new position under the bin (stored as-is); after moving out, it is recalculated based on the drop point — you never need to care about intermediate values.

## Clearing the Bin

```ts
await tree.write(async () => {
    // Deletes all descendants of the bin; the bin itself is kept
    await tree.clearRecycleBin();
});
```

`deleteNode(bin)` is equivalent to `clearRecycleBin()`. Both are administrative actions: not gated by `includeRecyclebin`, and emit no events. Silently returns when the recycle bin is not enabled.

## Events

The two recycle-related events follow the **state-transition rule** — `node:deleted` (with the `recycled: true` flag) is emitted only when a node transitions from "outside → inside" the bin:

```ts
tree.on("node:deleted", ({ node, recycled }) => {
    if (recycled) {
        console.log("Node moved into the recycle bin (logical deletion)", node);
    } else {
        console.log("Node physically deleted", node);
    }
});
tree.on("node:recycled", ({ node }) => {
    console.log("Dedicated event for deleteNode(recycle)", node);
});
```

| Operation | Events |
| --- | --- |
| `deleteNode(x, { recycle: true })` | `node:deleted`(recycled) + `node:recycled` |
| `moveNode(x, bin, { includeRecyclebin: true })` manual move-in | `node:deleted`(recycled) + `node:moved` |
| Reordering inside the bin (`includeRecyclebin: true`) | `node:moved` only (no deleted — no logical-deletion transition happened) |
| Restoring (move out) | `node:moved` only |
| Physical deletion inside the bin | `node:deleted` only (without recycled) |
| `clearRecycleBin()` | none |

## Multi-Tree Tables

On a multi-tree table (`treeId`), each tree needs its own bin — nodes of different trees cannot share one physical bin node. The `id` supports a function form, resolved per tree:

```ts
const tree = new FlexTreeManager("files", {
    adapter,
    treeId: 1,
    recyclebin: {
        id: (treeId: number) => treeId * 1000 + 999, // tree1→1999, tree2→2999 ...
        name: "__trash__",
    },
});
```

Each tree's bin is independent: recycling in tree A does not affect any read API of tree B.

## Multi-Root Trees

`MultiRootFlexTreeManager` supports the `recyclebin` option as-is (passed through to the internal single-tree manager): the bin is a child of the hidden root (a "root" at user-visible `level=0`), and both the `nodes` list and `toJson` exclude it by default:

```ts
const tree = new MultiRootFlexTreeManager("files", {
    adapter,
    recyclebin: { id: 999, name: "__trash__" },
});
```

## Implementation Notes

- **Logical deletion = moveNode into the bin**: fully reuses the move algorithm — structure preserved, atomic in one transaction.
- **Logical invisibility = SQL-side range filtering**: every read path appends the closed-range condition `NOT (left >= binLeft AND right <= binRight)`; row counts are correct at the database — ten thousand nodes in the bin do not change the cost of default-view queries. The bin range is cached in memory and invalidated after each write transaction commits.
- **The bin is an ordinary node**: verify/repair treat it as a regular member; the application can always operate on it as an ordinary subtree with `includeRecyclebin: true`.
