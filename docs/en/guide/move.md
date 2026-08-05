# Moving Nodes

:::warning Note
Moving a node is a data write operation and must be performed inside the `write` method.
:::

## Moving a Node

To move a node from one location to another, use the `move` method.

```ts
async moveNode(
    node: NodeId | TreeNode, 
    toNode?: NodeId | TreeNode, 
    pos: FlexNodeRelPosition = FlexNodeRelPosition.NextSibling
):Promise<void>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode| None | Node `id` or node object |
| `toNode` | NodeId \| TreeNode | null | Optional. Specifies the target node |
| `pos` | FlexNodeRelPosition | FlexNodeRelPosition.NextSibling | Optional. Move position |

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
    await tree.moveNode(anode,bnode)      // [!code ++]
    // LastChild is the default value, equivalent to the line above
    await tree.moveNode(anode,bnode,LastChild)// [!code ++]
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
    toNode?: NodeId | TreeNode
):Promise<boolean>

```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode | None | Node `id` or node object |
| `toNode` | NodeId \| TreeNode | None | Target node `id` or node object |

- **Return Value**

| Type | Description |
| --- | --- |
| `boolean` | Returns `true` if the node can be moved, otherwise `false` |


- **Notes**

    - In general, any node cannot be moved into any of its descendant nodes.
    - The `moveNode/moveUpNode/moveDownNode` methods above already perform this check internally, so you do not need to call it additionally.
