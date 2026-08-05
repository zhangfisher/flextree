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
        detach?: boolean
    }
): Promise<void> {

```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| None | Node `id` or node object |
| `options` |  | None | Optional configuration options |
| `options.detach` | boolean | false | Optional. Whether to perform a soft delete (detach) |

- **Notes**

**`detach`**

By default, deleting a node removes the node and all of its descendants.
If set to `true`, the target subtree is only detached from the tree structure (a soft delete): its `leftValue` and `rightValue` are set to `negative values` and the left/right values of the nodes to its right are pulled back, but the records themselves are retained.
This mode is used internally by `moveNode` (the source node is first detached from its original position, then the move SQL re-attaches it to the target position); it does not need to be set for ordinary deletes.


## Clearing the Tree

The `clear` method is used to clear all nodes of the tree.

```ts
async clear(): Promise<void> {
```

