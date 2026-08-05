# Repairing the Tree

`FlexTree` is based on the `Left-Right Value algorithm`. The integrity of the tree structure strictly depends on the correctness of every node's `leftValue` and `rightValue`.

Directly manipulating the data table, abnormal interruption of write operations, or other external causes may corrupt the left/right values or levels of nodes. In such cases, normal query, traversal, and other operations will return incorrect results.

`FlexTreeManager` provides a `repair` method to repair a corrupted tree structure; in addition, `flextree` also exports a pure function `repairTree` that can directly repair an array of nodes without going through the database.

:::warning Note
`repair` is a write operation. It is automatically executed inside `write` and a database transaction, so **there is no need to wrap it in `write` manually**.
:::

## Repairing the Entire Tree

Call `manager.repair()` to repair the tree managed by the current manager.

```ts
import { FlexTreeManager } from 'flextree'
import SqliteAdapter from 'flextree-sqlite-adapter'

const tree = new FlexTreeManager('tree', {
    adapter: new SqliteAdapter(),
})

await tree.repair()
```

- **Notes**

    - `repair` directly reads the `id`, `level`, `leftValue`, and `rightValue` of all nodes in the table (since the tree may already be corrupted, normal query methods cannot be relied upon). After rebuilding the structure, it **writes only the changed nodes back to the database**.
    - In multiple-trees-in-a-single-table scenarios, both reading and updating are automatically scoped to the current `treeId` range, and will not affect other trees.

## Repair Algorithm

`repair` rebuilds the tree structure based on the node's `level` information. The core steps are as follows:

1. Sort by `leftValue` to preserve the original order of nodes;
2. Use a stack and judge parent-child relationships based on `level` to reassign **contiguous** `leftValue`/`rightValue`, ensuring all values fall within the `1..2N` range with no gaps;
3. Normalize `level`: the root node is `0`, incrementing by `1` per layer, automatically fixing level jumps (e.g. `0 → 3 → 7` will be normalized to `0 → 1 → 2`);
4. After repair, an integrity verification is performed automatically. A failed verification will **throw an exception** instead of returning incorrect data.

For example, a tree whose left/right values have been corrupted:

<LiteTree>
Root
    A
        A1
        A2
    B
</LiteTree>

After executing `repair`, the `leftValue`/`rightValue` of all nodes will be reassigned to contiguous and correct values, and the levels will also be normalized.

## The repairTree Pure Function

If you already hold an array of nodes (for example, from another data source or a backup), you can use the exported `repairTree` pure function to repair them directly, without going through the database.

```ts
import { repairTree } from 'flextree'

const repaired = repairTree(nodes, {
    keyFields: { /* Custom field names, optional */ },
    treeId: 1, // Inject treeId for multi-tree tables, optional
})
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodes` | `Record<string, any>[]` | None | The array of nodes to repair (will not be modified) |
| `options.keyFields` | `CustomTreeKeyFields` | default fields | Custom key field names |
| `options.treeId` | `any` | None | The `treeId` injected into the resulting nodes for multi-tree tables |

- **Notes**

    - `repairTree` is a pure function. It **does not modify the input** `nodes` and returns a new array of nodes that have been repaired and sorted by `leftValue`.
    - Nodes whose values have changed will carry `_level`/`_leftValue`/`_rightValue` metadata, recording the original values before repair for easy comparison.

:::tip Note
Before repairing, you can use the [verify](./verify.md) method to detect whether the tree structure is corrupted; after repairing, you can verify again to confirm integrity.
:::
