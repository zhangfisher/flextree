# Multi-Root Trees

In some scenarios, a single table needs to store **multiple top-level nodes** (multiple "parallel" trees), for example: multiple root directories in a file system, multiple topics in a message center, or multiple lists on a kanban board. `MultiRootFlexTreeManager` is the multi-root tree manager built for this purpose.

## Multi-Root Tree vs Multi-Tree Table

`FlexTree` provides two approaches for "multiple top-level nodes", each with its own use cases:

| | Multi-Root Tree `MultiRootFlexTreeManager` | Multi-Tree Table `FlexTreeManager` + `treeId` |
| --- | --- | --- |
| Table structure | Ordinary single-tree table, no `treeId` field needed | Requires a `treeId` field to distinguish trees |
| Root relationships | Roots are **siblings** — navigable and reorderable | Trees are fully independent and unaware of each other |
| Cross-"tree" operations | Just ordinary move/copy operations, supported natively | Cross-tree moves require explicitly specifying `treeId` |
| Number of managers | One manager for all roots | One manager instance per `treeId` |
| Use cases | A group of peer top-level nodes (directory lists, topic lists) | Isolated independent trees (one tree per user) |

:::tip How to choose
If the "multiple top-level nodes" are **a group of parallel data items** in your business (like entries in the same list), use a multi-root tree.
If each tree belongs to **a different owner** (different users or tenants, each with their own tree), use a [multi-tree table](./multitree).
:::

## How It Works

The multi-root tree is implemented with the **Hidden Root** pattern:

```
Physical layer (an ordinary single-root tree in the table)    User's view (multi-root tree)
┌──────────────────────────┐
│ __root__  L=1  R=12      │ ← Hidden root (auto-created, invisible externally)
│  ├─ A     L=2  R=5       │         ├─ A          (level 0)
│  ├─ B     L=6  R=11      │         ├─ B          (level 0)
│  │   └─ C L=7  R=10      │         │   └─ C      (level 1)
└──────────────────────────┘
```

- Internally it holds an ordinary single-tree `FlexTreeManager` and automatically creates/maintains a **hidden root node** (`level=0`, `leftValue=1`, named `__root__` by default).
- The "multiple roots" seen by the user are simply the hidden root's children. Therefore sibling navigation between roots and cross-root move/copy are all ordinary single-tree operations — every capability of `FlexTreeManager` is preserved as-is.
- The `level` in all external reads is **normalized**: user roots are reported as `level=0`, their children as `level=1`, and so on.

## Creating a Multi-Root Tree Manager

Like `FlexTreeManager`, both normal and singleton modes are supported:

```ts
import { MultiRootFlexTreeManager } from "flextree";
import sqliteAdapter from "flextree-sqlite-adapter";

// Normal mode
const tree = new MultiRootFlexTreeManager("filesys", {
    adapter: new sqliteAdapter(),
});

// Singleton mode (recommended)
const tree = MultiRootFlexTreeManager.getInstance("filesys", {
    adapter: new sqliteAdapter(),
});
```

**Constructor parameters:**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `tableName` | string | none | Required, the database table name |
| `options.adapter` | IFlexTreeAdapter | none | Required, the database adapter |
| `options.hiddenRootName` | string | `"__root__"` | Optional, the hidden root node name |
| `options.fields` | object | default field names | Optional, custom key field names (same as `FlexTreeManager`) |

:::warning Note
The multi-root tree is based on a single-tree table — **do not pass `treeId`** (passing it throws an error). The table structure is just an ordinary tree table; no `treeId` field is involved.
:::

The generic parameters are identical to `FlexTreeManager` (`Fields`/`KeyFields`), supporting custom fields and custom key field names.

## Initialization

The constructor performs no database access. Call `load()` after creation to initialize:

```ts
const tree = MultiRootFlexTreeManager.getInstance("filesys", { adapter });

await tree.load(); // Check/create the hidden root, load the root node list
```

`load()` behavior:

- **Auto-creates the hidden root**: on an empty table (or one wiped externally) the hidden root is created automatically.
- **Self-healing**: if the hidden root is accidentally deleted by external SQL, the next `load()` recreates it.
- **Idempotent**: repeated calls are safe and only refresh the root list cache.

## nodes: The Root Node List

A multi-root tree has no single `root`; instead, the synchronous property `nodes` returns all user roots:

```ts
tree.nodes  // TreeNode[], level already normalized (roots = 0)
```

- Automatically refreshed after each `write` — no manual updates needed.
- After adding/removing roots or moving nodes in/out of the root level, `nodes` reflects the latest state immediately.

## Adding Roots and Nodes

### Adding a root

When `addNodes` is called without the `at` parameter (or with `null`), the nodes are attached to the top level and become **new root nodes**:

```ts
await tree.write(async () => {
    // Add root nodes
    await tree.addNodes([{ name: "Documents" }]);
    await tree.addNodes([{ name: "Pictures" }]);

    tree.nodes.length; // 2
});
```

Nested structures are also supported, creating a root with its subtree in one call:

```ts
await tree.write(async () => {
    await tree.addNodes([
        {
            name: "Music",
            children: [
                { name: "Rock" },
                { name: "Jazz" },
            ],
        },
    ]);
});
```

### Adding child nodes

With `at` specified, everything works exactly like `FlexTreeManager`:

```ts
await tree.write(async () => {
    await tree.addNodes([{ name: "resume.doc" }], documentsId);
});
```

## Querying Nodes

The query APIs are identical to `FlexTreeManager`, with only two differences: **the hidden root is never returned**, and **level is normalized**.

```ts
// All user nodes (hidden root excluded)
const nodes = await tree.getNodes();

// level semantics follow the user's perspective: 1 = roots only, 2 = roots + children
const roots = await tree.getNodes({ level: 1 });

// Sibling navigation between roots (physically they really are siblings)
const next = await tree.getNextSibling(documentsId);   // Pictures
const siblings = await tree.getSiblings(documentsId);  // all other roots

// Parent of a root: user roots have no parent, throws FlexTreeNodeNotFoundError
const parent = await tree.getParent(documentsId);      // throws

// Descendants of a root
const files = await tree.getDescendants(documentsId);
```

- `getParent(root)` throws `FlexTreeNodeNotFoundError` (roots have no parent).
- `getAncestors(root)` returns an empty array; `getAncestorsCount(root)` returns `0`.
- Conditions like `findNodes({ level: 0 })` also use the user-perspective level.
- In `getNodes({ where })`, the `where` clause is raw SQL — the `level` inside it is the **physical value** (1 greater than the user perspective).

## Moving and Copying

Cross-root move/copy is just an ordinary same-tree operation — no special parameters needed:

```ts
await tree.write(async () => {
    // Move a subdirectory under Documents into Pictures (cross-root move)
    await tree.moveNode(resumeId, picturesId, FlexNodeRelPosition.LastChild);

    // Move a root under another root (that root becomes an ordinary child)
    await tree.moveNode(musicId, documentsId, FlexNodeRelPosition.LastChild);

    // Move a node next to a root (promoting it to a new root)
    await tree.moveNode(rockId, documentsId, FlexNodeRelPosition.NextSibling);

    // Copy an entire root (the copy becomes a new root)
    const copy = await tree.copyNode(documentsId, {
        to: picturesId,
        pos: FlexNodeRelPosition.NextSibling,
    });
});
```

- `moveUpNode`/`moveDownNode` work on roots too: roots move up/down within their sibling sequence. Moving the first root up or the last root down throws `FlexTreeNodeInvalidOperationError`.

## Deleting and Clearing

```ts
await tree.write(async () => {
    // Delete a root (along with all its descendants); other roots' coordinates shrink automatically
    await tree.deleteNode(documentsId);

    // Clear all user nodes (the hidden root is rebuilt automatically; new roots can be added afterwards)
    await tree.clear();
});
```

- The hidden root cannot be deleted: when `deleteNode` hits it, a `FlexTreeNodeInvalidOperationError` is thrown (in normal use you never touch the hidden root).
- `clear()` only removes user nodes; the tree remains usable afterwards.

## Verify and Repair

Identical to `FlexTreeManager`, passed straight through:

```ts
await tree.verify(); // Verify tree structure integrity (the hidden root passes all checks)
await tree.repair(); // Repair a broken tree structure; nodes is refreshed afterwards
```

## Exporting

`toJson` returns a **multi-root nested array** (instead of a single root object):

```ts
const json = await tree.toJson();
// [
//   { id: 2, name: "Documents", children: [{ id: 4, name: "resume.doc" }] },
//   { id: 3, name: "Pictures", children: [...] },
// ]

const list = await tree.toList();
// [
//   { id: 2, name: "Documents", pid: 0 },
//   { id: 4, name: "resume.doc", pid: 2 },
//   ...
// ]
```

- All `toJson` options (`childrenField`/`level`/`fields`/`includeKeyFields`/`countField`) are the same as `FlexTreeManager`; `level` values are normalized.
- In `toList`, user roots have `pid` set to `0` — the hidden root's id never leaks.
- `countField` is also supported: it attaches a descendant-count field to every node. Since the bin always hangs under the hidden root, each user root's count is never polluted by recycled content (see [Export](./export#countfield-descendant-count)).

## Events

The event mechanism is identical to `FlexTreeManager`; all `node:*` events fire and are subscribed to the same way:

```ts
tree.on("node:added", ({ nodes }) => {
    console.log(`${nodes.length} nodes added`);
});
```

## API Differences at a Glance

Compared with `FlexTreeManager`, the only differences of `MultiRootFlexTreeManager` are:

| Difference | Description |
| --- | --- |
| No `getRoot` / `hasRoot` / `createRoot` | No unique root in multi-root semantics; new roots are created via `addNodes` (without `at`) |
| New `nodes` | Synchronously returns the user root list, auto-refreshed after `write` |
| `toJson` returns an array | A multi-root nested array instead of a single root object |
| `getParent(root)` throws | User roots have no parent |
| `level` normalization | All read levels follow the user's perspective (roots = 0) |

All other methods (`addNodes`/`deleteNode`/`moveNode`/`copyNode`/`update`/`findNode`/`getDescendants`/`forEach`/`verify`/`repair`, etc.) have identical signatures and semantics — see the [Tree Manager](./manager) guide and related chapters.
