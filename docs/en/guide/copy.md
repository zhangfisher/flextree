# Copy Node

:::warning Note
 Copying a node is a write operation and must be performed inside the `write` method.
:::

Use `copyNode` to copy a node (by default together with all its descendants) to a specified position. The new subtree is **identical to the source subtree except for the id** — position attributes such as `level`, `leftValue`, `rightValue` and `treeId` are recalculated based on the destination.

```ts
async copyNode(
    nodeId: NodeId,
    options?: {
        includeDescendants?: boolean    // whether to include descendants, default true
        to?: NodeId                     // destination reference node, default the source node itself
        pos?: FlexNodeRelPosition       // relative position, default NextSibling
        treeId?: TreeId                 // target tree id, provide for cross-tree copy
        fields?: string[]               // fields to copy, default all
        transformField?: Record<string,string>  // field transform map
    }
): Promise<TreeNode>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | `NodeId` | — | The id of the source node to copy |
| `options.includeDescendants` | `boolean` | `true` | Whether to copy descendants along with the node; when `false`, only the node itself is copied (the copy becomes a leaf) |
| `options.to` | `NodeId` | source node itself | The destination reference node; the copy is placed relative to it according to `pos` |
| `options.pos` | `FlexNodeRelPosition` | `NextSibling` | The relative position of the copy to the destination reference node |
| `options.treeId` | `TreeId` | current tree | Target tree id; when provided and different from the current tree's treeId, this is a cross-tree copy and `to` refers to a node id in the target tree |
| `options.fields` | `string[]` | all fields | List of field names to copy; `[]` (empty array) means copying key fields only; key fields (id/treeId/name/level/leftValue/rightValue) are always included and not affected by this parameter |
| `options.transformField` | `Record<string,string>` | — | Field transform map `{ field: SQL expression }`, applied to all nodes in the subtree; tree structure fields (treeId/leftValue/rightValue/level) cannot be transformed |

- **Return value**: the copy root node (`TreeNode`).

## Examples

```ts
import { FlexTreeManager, FlexNodeRelPosition } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{ 
    // Copy node A (with all descendants) after node B
    const copyRoot = await tree.copyNode(aId, { 
        to: bId, 
        pos: FlexNodeRelPosition.NextSibling 
    })

    // Default: copy as the next sibling of the source node
    const copyRoot2 = await tree.copyNode(aId)

    // Copy only the node itself; the copy is a leaf
    const leafCopy = await tree.copyNode(aId, { includeDescendants: false })

    // Copy as the last child of the source node itself
    const childCopy = await tree.copyNode(aId, { pos: FlexNodeRelPosition.LastChild })

    // Cross-tree copy: copy into the tree with treeId=2; 
    // `to` refers to a node id in that tree
    const crossCopy = await tree.copyNode(aId, { 
        treeId: 2, 
        to: bIdInTree2, 
        pos: FlexNodeRelPosition.LastChild 
    })
})
```

## Destination rules

- When `to` is omitted, it defaults to the source node itself, and `pos` takes effect as-is. For example, with `pos: LastChild` and no `to`, the copy becomes the last child of the source node.
- The destination cannot be a **descendant** of the source node (self-referential copy); otherwise an exception is thrown.
- When the destination is the root node, `pos` cannot be `NextSibling`/`PreviousSibling` (the root has no siblings); otherwise an exception is thrown.
- **Cross-tree copy** is supported (multi-tree single-table scenario) in two ways:
  - Call it on the destination tree's manager, passing a source node id from another tree (the source is located by id across the whole table);
  - Call it on the source tree's manager, specifying the target tree via the `treeId` option — then `to` refers to a node id in the target tree.
  - In both cases the copy's `treeId` adopts the `treeId` of the destination tree.

## Selective field copy

A table may contain **unimportant** fields (no point in copying) or fields with **unique constraints** (copying would cause conflicts). Use `fields` to copy only the specified fields; unspecified custom fields are skipped (left empty in the copy):

```ts
await tree.write(async ()=>{ 
    // Copy only the title field; other custom fields (e.g. size, url, hashCode) are skipped
    const copyRoot = await tree.copyNode(aId, { fields: ["title"] })

    // Empty array: copy only the key fields (id/treeId/name/level/leftValue/rightValue)
    const bareCopy = await tree.copyNode(aId, { fields: [] })
})
```

:::tip Note
 No matter what `fields` specifies, the tree's key fields (id/treeId/name/level/leftValue/rightValue) are always copied correctly — they are the foundation of the tree structure and are not affected by the filter.
:::

## Field transforms (transformField)

Provide a `{ field: SQL expression }` map via `transformField` to transform the value of **any field** in the copy. Expressions can reference the original columns and should be written in your own database dialect. The map applies to **all nodes** in the subtree; fields without a transform are copied as-is.

```ts
await tree.write(async ()=>{ 
    // Append a suffix to the copy's name (SQLite / PostgreSQL)
    const copyRoot = await tree.copyNode(aId, { 
        transformField: { name: "name || '-copy'" } 
    })

    // MySQL syntax
    const copyRoot2 = await tree.copyNode(aId, { 
        transformField: { name: "CONCAT(name,'-copy')" } 
    })

    // Transform multiple fields at once: id, name and the custom field size
    const copyRoot3 = await tree.copyNode(aId, { 
        transformField: { 
            id: "hex(randomblob(16))", 
            name: "name || '-copy'",
            size: "size * 2" 
        } 
    })
})
```

Typical scenarios:

- **Non-auto-increment primary keys**: no parameter is needed when id is auto-increment; when it is not (e.g. uuid), provide a transform expression for id (see above)
- **Distinguishing copies**: append a suffix to name so same-name siblings are easier to tell apart
- **Adjusting copy data**: arithmetic on numeric fields (e.g. resetting a counter `count: "0"`), generating fresh values for unique-constrained fields (e.g. `slug: "slug || '-' || hex(randomblob(4))"`)

:::danger Warning
 Expressions in `transformField` are concatenated **as-is** into the executed `INSERT ... SELECT` statement. Never pass untrusted external input to this parameter — injection safety is the caller's responsibility.
:::

:::tip Note
 Tree structure fields (`treeId`/`leftValue`/`rightValue`/`level`) are computed automatically by the algorithm based on the destination and **cannot** be transformed — entries for them in `transformField` are ignored.
:::

## Performance

`copyNode` completes the entire operation inside one transaction with a **fixed number of set-based SQL statements**. The number of database round-trips is **independent of the number of descendants** — even if the source node has tens of thousands of descendants, the descendant data is never loaded into the application layer:

1. One `INSERT ... SELECT` snapshots the source subtree as a staging copy with negative left/right values
2. Two `UPDATE`s make room at the destination
3. One `UPDATE` mirrors the staging copy into its final position

Finally, the copy root is fetched by its computed new `leftValue` and returned.

## Events

When the copy completes, the `node:added` event is emitted with `nodes` set to `[copyRoot]`. To obtain all new nodes, query them in the event callback via `getDescendants(copyRoot.id)`.
