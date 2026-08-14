# Moving Nodes

:::warning Note
Moving a node is a data write operation and must be performed inside the `write` method.
:::

## Moving a Node

To move a node from one location to another, use the `moveNode` method.

```ts
async moveNode(
    node: NodeId | TreeNode, 
    toNode?: NodeId | TreeNode, 
    posOrOptions?: FlexNodeRelPosition | FlexTreeMoveOptions
):Promise<void>
```

The third parameter can be either a `pos` enum (legacy style, kept for backward compatibility) or an options object:

```ts
interface FlexTreeMoveOptions {
    pos?: FlexNodeRelPosition          // Relative position, defaults to NextSibling
    treeId?: TreeId                    // Target tree for cross-tree moves, see "Cross-Tree Move"
}
```

:::warning Note
When `pos` is omitted, it defaults to `NextSibling` (next sibling), **not** `LastChild`.
:::

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode| None | Node `id` or node object |
| `toNode` | NodeId \| TreeNode | null | Optional. Specifies the target node |
| `posOrOptions` | FlexNodeRelPosition \| FlexTreeMoveOptions | NextSibling | Optional. Move position or options object |

The following uses a simple tree to illustrate node move operations:

<LiteTree>
Root
    A
        A1
        A2
        A3
    B
        B1
        B2
        B3
    C
        C1
        C2
        C3
</LiteTree>

### Last Child

Move the node as the last child node of the `toNode` node.

```ts
import { FlexTreeManager,LastChild } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    const anode = await tree.findNode({name:"A"})
    const bnode = await tree.findNode({name:"B"})
    // Move node A under node B
    await tree.moveNode(anode,bnode,LastChild)      // [!code ++]
})
```

The tree structure after the move is as follows:

<LiteTree>
Root
    B                       //! toNode
        B1
        B2
        B3
        A                   //+
            A1              //+
            A2              //+
            A3              //+
    + C
        C1
        C2
        C3
</LiteTree>

### First Child

Move the node as the last child node of the `toNode` node.

```ts
import { FlexTreeManager,FirstChild } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    const anode = await tree.findNode({name:"A"})
    const bnode = await tree.findNode({name:"B"}) 
    await tree.moveNode(anode,bnode,FirstChild)      // [!code ++]
})
```

The tree structure after the move is as follows:

<LiteTree>
Root
    B                       //! toNode        
        A                   //+
            A1              //+
            A2              //+
            A3              //+ 
        B1
        B2
        B3
    + C
        C1
        C2
        C3
</LiteTree>
 

### Previous Sibling

Move the node as the previous sibling of the `toNode` node.

```ts
import { FlexTreeManager,PreviousSibling } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    const cnode = await tree.findNode({name:"C"})
    const bnode = await tree.findNode({name:"B"}) 
    await tree.moveNode(cnode,bnode,PreviousSibling)      // [!code ++]
})
```

Move `bnode` as the previous sibling of `cnode`. The tree structure after the move is as follows:

<LiteTree>
Root
    A                   
        A1              
        A2              
        A3              
    C                       //+
        C1                  //+
        C2                  //+
        C3                  //+
    B                       //! toNode        
        B1
        B2
        B3    
</LiteTree>

### Next Sibling

Move the node as the previous sibling of the `toNode` node.

```ts
import { FlexTreeManager,NextSibling } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    const anode = await tree.findNode({name:"A"})
    const bnode = await tree.findNode({name:"B"}) 
    await tree.moveNode(anode,bnode,NextSibling)      // [!code ++]
})
```

Move `anode` as the next sibling of `cnode`. The tree structure after the move is as follows:

<LiteTree>
Root
    B                       //! toNode        
        B1
        B2
        B3          
    A                       //+
        A1                  //+
        A2                  //+
        A3                  //+
    C                       
        C1                  
        C2                  
        C3                  
</LiteTree>

## Moving a Node Up

The `moveUpNode` method is used to move a node up.

```ts
async moveUpNode(node: NodeId | TreeNode):Promise<void> 
```

The envisioned scenario is in a `UI` interface, where the user can keep moving a node up via the `Move Up` button until it reaches the root node.

- Within the same level, moving a node up is essentially **swapping positions with its previous sibling**, or equivalently, moving it to be the previous sibling of its previous sibling.
- When the node has become the first child of its parent node, **on the next move up**, when the node no longer has a previous sibling, the node is **moved to be the previous sibling of its parent node**.

:::warning Note
When moving a node up, if the node is already the first child of the root node, it will not be moved up any further.
:::

## Moving a Node Down

The `moveDownNode` method is used to move a node down.

```ts
async moveDownNode(node: NodeId | TreeNode):Promise<void> 
```

The envisioned scenario is in a `UI` interface, where the user can keep moving a node down via the `Move Down` button until it reaches the bottom of the tree.

- Within the same level, moving a node down is essentially **swapping positions with its next sibling**, or equivalently, moving it to be the next sibling of its next sibling.
- When the node has become the last child of its parent node, **on the next move down**, the node is already the last node of its parent, and the node will continue to move to **the next sibling of its parent node**.


## Determining Whether a Move Is Allowed

The `canMoveNode` method is used to determine whether a node can be moved.

```ts
async canMoveTo(
    node: NodeId | TreeNode, 
    toNode?: NodeId | TreeNode,
    options?: FlexTreeMoveOptions
):Promise<boolean>

```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode | None | Node `id` or node object |
| `toNode` | NodeId \| TreeNode | None | Target node `id` or node object |
| `options` | FlexTreeMoveOptions | None | Optional. `treeId` specifies the target tree (cross-tree pre-check, same semantics as `moveNode`) |

- **Return Value**

| Type | Description |
| --- | --- |
| `boolean` | Returns `true` if the node can be moved, otherwise `false` |


- **Notes**

    - In general, any node cannot be moved into any of its descendant nodes.
    - For cross-tree pre-checks: moving the root node returns `true` (equivalent to deleting the source tree, see "Moving the Root Node Across Trees"); if `toNode` is not found in the target tree, an error is thrown.
    - The `moveNode/moveUpNode/moveDownNode` methods above already perform this check internally, so you do not need to call it additionally.

## Cross-Tree Move

In a multi-tree table scenario, you can move a node (along with all its descendants) to **another tree** via `options.treeId`:

```ts
import { FlexTreeManager,LastChild } from 'flextree';
// tree1 and tree2 manage different trees in the same multi-tree table
const tree1 = new FlexTreeManager("org",{ adapter, treeId:1 })
const tree2 = new FlexTreeManager("org",{ adapter, treeId:2 })

await tree1.write(async ()=>{
    const anode = await tree1.findNode({name:"A"})
    const cnode = await tree2.findNode({name:"C"})
    // Move subtree A of tree 1 as the last child of node C in tree 2
    await tree1.moveNode(anode,cnode,{ treeId:2, pos:LastChild })      // [!code ++]
})
```

- **Notes**

    - `treeId` specifies the **target tree**; `toNode` then points to a node in that tree (either an `id` or a node object).
    - **The direction is one-way**: you can only move nodes **out of** the current tree into another tree, not the other way around — nodes of another tree do not exist in the current `manager` (using one as the source throws a NotFound error). For the reverse direction, use a manager on the target tree side.
    - After the move, the `treeId`, `level`, `leftValue`, and `rightValue` of all nodes in the subtree are recalculated for the target tree.
    - A cross-tree move emits two events: first `node:deleted` (source-tree view — the node is removed from the source tree), then `node:moved` (with `toTree` pointing to the target tree).
    - When `treeId` equals the current tree, it is treated as a same-tree move (same as omitting it); providing `treeId` in single-tree mode throws an error.
    - Sibling positions (`NextSibling`/`PreviousSibling`) are not allowed when the target is the **root node of the target tree** (a root has no siblings; same rule as same-tree moves).
    - A cross-tree move completes atomically with a fixed set of `SQL` statements — the number of database accesses is independent of the subtree size.

### Moving Out as a New Tree

When performing a cross-tree move with `toNode` **omitted**, the `node` and its subtree are moved out to become the **root of a new tree** specified by `treeId`:

```ts
await tree1.write(async ()=>{
    const anode = await tree1.findNode({name:"A"})
    // Move subtree A out as a new tree with treeId=3, A becomes its root
    await tree1.moveNode(anode,undefined,{ treeId:3 })      // [!code ++]
})
```

- **Notes**

    - After the move, `node` becomes the root of the new tree (`level=0`, `leftValue=1`); the internal structure of the subtree is preserved.
    - In this scenario `pos` is **ineffective** (a brand-new tree has no destination reference node; it is ignored if provided).
    - The target `treeId` must **not already have a tree** — otherwise a `Tree already exists` error is thrown.
    - This also applies to the source root node: equivalent to "relocating" the entire tree to a new `treeId` (the original manager becomes invalid).
    - Event order is the same as cross-tree moves: first `node:deleted` (source-tree view), then `node:moved`.

### Moving the Root Node Across Trees (Equivalent to Deleting the Source Tree)

Moving the **root node** across trees is allowed — the entire source tree (the root and all its descendants) is merged into the target tree:

```ts
await tree1.write(async ()=>{
    const root = await tree1.getRoot()
    const cnode = await tree2.findNode({name:"C"})
    // Merge the entire tree1 into tree2 as the last child of C
    await tree1.moveNode(root,cnode,{ treeId:2, pos:LastChild })      // [!code ++]
})
```

:::danger Warning
Once this operation succeeds, **the tree managed by tree1's manager has been deleted**:

- Any subsequent operation on that `manager` will **fail** — reads return empty results (`getNodes()` returns `[]`, `getRoot()` returns `null`), and write operations (such as `addNodes`/`moveNode`/`deleteNode`) throw errors because the root node no longer exists.
- To continue using that `treeId`, you must first call `createRoot()` again to create a new tree.
- Likewise, you cannot move the root node of one tree to the previous or next sibling position of the **target tree's root node** (a root has no siblings).
:::

## node:moved Event

The `node:moved` event is emitted after a move completes:

```ts
tree.on("node:moved",(e)=>{
    // e.tree   the source tree when the move was initiated
    // e.toTree the tree where the destination lives (=== e.tree for same-tree moves)
    // e.from   the moved node
    // e.to     the destination reference node
    // e.pos    the relative position
})
```

**A cross-tree move additionally emits `node:deleted` first** (source-tree view — the node and its descendants are removed from the source tree):

```ts
tree.on("node:deleted",(e)=>{
    // e.tree  the source tree
    // e.node  the removed node (subtree root)
})
```
