# Deleting Nodes

:::warning Note
Deleting a node is a data write operation and must be performed inside the `write` method.
:::

## Deleting Nodes

The `deleteNode` method is used to delete a tree node along with its descendants.

```ts
async deleteNode(
    nodeId: NodeId | TreeNode,
    options?: {
        recycle?: boolean
        includeRecyclebin?: boolean
    }
): Promise<void>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode | None | Node `id` or node object |
| `options.recycle` | boolean | `false` | Logical deletion: move the subtree into the recycle bin instead of physically deleting it |
| `options.includeRecyclebin` | boolean | `false` | `false` (default): in-bin nodes are treated as non-existent — deleting one throws `NotFound`; `true`: enters the recycle-bin view so in-bin nodes can be deleted (physically). Required when managing recycle-bin contents (see [below](#includerecyclebin-deleting-in-bin-nodes)) |

### Physical Deletion (default)

By default the node and all of its descendants are deleted, and the left/right values of the nodes to the right are pulled back:

```ts
await tree.write(async () => {
    // A and all of its descendants are deleted from the table
    await tree.deleteNode(aId);
});
```

### Logical Deletion (Recycle Bin)

Once the recycle bin is enabled, `recycle: true` **moves** the target subtree into the recycle bin instead of physically deleting it — structure preserved, data retained, but logically gone:

```ts
await tree.write(async () => {
    // A and all of its descendants (structure preserved) move into the recycle bin
    await tree.deleteNode(aId, { recycle: true });
});

// From then on A is logically invisible in the default view:
await tree.findNode({ name: "A" });   // null
await tree.getNode(aId);              // throws NotFound
```

**Notes:**

- `recycle: true` only takes effect **once the recycle bin is enabled**; without it, this is a physical deletion.
- The **entire subtree** is recycled: descendants enter the bin together with the hierarchy.
- Deleting the **bin node itself** is equivalent to clearing the recycle bin (`clearRecycleBin()`): the bin node is kept, all of its descendants are deleted.

For the full recycle-bin feature (enabling configuration, restoring nodes, clearing, event semantics) see [Recycle Bin](./recyclebin).

### includeRecyclebin: Deleting In-Bin Nodes

Once a node has been logically deleted (moved into the recycle bin), it no longer exists logically — by default, calling `deleteNode` throws **node not found** (`FlexTreeNodeNotFoundError`):

```ts
await tree.write(async () => {
    await tree.deleteNode(aId, { recycle: true });   // A moves into the recycle bin
});

await tree.write(async () => {
    await tree.deleteNode(aId);                      // throws NotFound —— A is logically deleted
});
```

Passing `includeRecyclebin: true` skips that check and deletes the in-bin node from the recycle-bin view — this is a **physical deletion** (the `recycle` parameter has no effect; deleting something already in the bin removes it for good):

```ts
await tree.write(async () => {
    // Permanently delete A and all of its descendants from the recycle bin
    await tree.deleteNode(aId, { includeRecyclebin: true });
});
```

- Suited for "remove some of the recycle bin's contents" (use `clearRecycleBin()` to empty it all)
- Nodes outside the bin are unaffected: `includeRecyclebin: true` works on them as usual and can be combined with `recycle: true`
- Generally speaking, **managing recycle-bin contents** (listing, restoring, permanently deleting in-bin nodes) requires `includeRecyclebin: true` — with `true`, the bin and every node inside it can be operated on just like ordinary nodes; under the default view they are invisible and unreachable

## Clearing the Tree

The `clear` method is used to clear all nodes of the tree.

```ts
async clear(): Promise<void>
```
