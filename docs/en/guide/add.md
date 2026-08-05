# Adding Nodes

:::warning Note
 Adding a node is a data write operation and must be performed inside the `write` method.
:::

## Creating the Root Node

You can create the root node with the `createRoot` method.

```ts

import { FlexTreeManager } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

// Must be executed inside the write method, otherwise an exception is thrown
await tree.write(async ()=>{ 
    await tree.createRoot({    // Create the root node
        name:"Root",
        // .... other node properties    
    })  
})
```

- The `createRoot` method must be executed inside the `write` method, otherwise an exception is thrown.
- A tree can only have one root node. Calling `createRoot` again will throw an exception.


## Adding Nodes

Once a `FlexTreeManager` is created, you can use the `addNodes` method to add one or more nodes.

```ts
async addNodes(
    nodes: Partial<TreeNode>[], 
    atNode?: NodeId | TreeNode | null, 
    pos: FlexNodeRelPosition = FlexNodeRelPosition.LastChild
):void

enum FlexNodeRelPosition {
    LastChild = 0,
    FirstChild = 1,
    NextSibling = 2,
    PreviousSibling = 3,
}

```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodes` | `Partial<TreeNode>[]` | None | Array of node objects |
| `atNode` | `NodeId \| TreeNode` | null  | Optional. Specifies under which node to add |
| `pos` | `FlexNodeRelPosition` | `FlexNodeRelPosition.LastChild` | Optional. Add position |

### Nested Batch Adding

Besides accepting a flat array of nodes, `addNodes` also supports a **nested structure** — passing a complete subtree in a single call and describing the parent-child relationships via the `children` field. In this case the `options` object form is recommended:

```ts
async addNodes(
    nodes: FlexTreeNodeInput[],
    options?: {
        at?: NodeId | TreeNode | null   // Parent node; defaults to the root node
        pos?: FlexNodeRelPosition       // Add position; defaults to LastChild
        childrenField?: string          // Child field name; defaults to 'children'
    }
): Promise<void>
```

- **Example**

```ts
await tree.write(async () => {
    await tree.addNodes([
        {
            name: "A",
            children: [            // Children of A
                { name: "A1" },
                { name: "A2" },
            ],
        },
        {
            name: "B",
            children: [
                { name: "B1" },
            ],
        },
    ])
})
```

The generated tree structure is as follows:

<LiteTree>
Root
    A
        A1
        A2
    B
        B1
</LiteTree>

- **Notes**

    - The `children` field in the nested structure is **only used to describe the hierarchy at the time of adding**; it is not written to the database (the hierarchy is maintained through left/right values in the database).
    - The default child field name is `children`. It can be customized via `options.childrenField` (for example, when some data sources use field names like `subs` or `child`).

### Last Child

Adds one or more nodes as the last child of the `atNode` node.

```ts {4-14}
import { FlexTreeManager } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{  
    // Create the root node
    await tree.createRoot({name:"Root"}) 
    // Add nodes under the root node
    await tree.addNodes([
        {name: "A"},   
        {name: "B"},
        {name: "C"},
    ])
})  

```

The generated tree structure is as follows:

<LiteTree>
Root
    A           //+
    B           //+
    C           //+
</LiteTree>

In the example above, we added three child nodes under the root node (**omitting the `atNode` and `pos` parameters**).

Next we add two child nodes under node `A`.

```ts 
import { LastChild } from "flextree"

await tree.write(async ()=>{ 
    const anode = await tree.findNode({name:"A"})
    // Add nodes under the root node
    await tree.addNodes([// [!code ++]
        {name: "A1"},// [!code ++]
        {name: "A2"}// [!code ++]
    ],anode,LastChild)  // [!code ++]
})

```

The generated tree structure is as follows:


<LiteTree>
Root
    A
        A1      //+
        A2      //+
    B
    C
</LiteTree>


### First Child

Adds one or more nodes as the first child of the `atNode` node.

 
```ts {4-14} 

import { FirstChild } from "flextree"

await tree.write(async ()=>{   
    const anode = await tree.findNode({name:"A"})
    // 1st add
    await tree.addNodes([
        {name: "A1"},
    ],anode,FirstChild)
    // 2nd add
    await tree.addNodes([
        {name: "A2"},
    ],anode,FirstChild)
    // 3rd add
    await tree.addNodes([
        {name: "A3"},
    ],anode,FirstChild)
})  

```

The generated tree structure is as follows:

<LiteTree>
Root
    A               //! atNode
        A3          //+ 3rd add
        A2          //+ 2nd add
        A1          //+ 1st add    
    B
    C
</LiteTree>


### Next Sibling

Adds one or more nodes as the next sibling of the `atNode` node.


```ts {4-14} 

import { NextSibling } from "flextree"

await tree.write(async ()=>{   
    const anode = await tree.findNode({name:"A"})
    // 1st add
    await tree.addNodes([
        {name: "A1"},
    ],anode,NextSibling)
    // 2nd add
    await tree.addNodes([
        {name: "A2"},
    ],anode,NextSibling)
    // 3rd add
    await tree.addNodes([
        {name: "A3"},
    ],anode,NextSibling)
})  

```

The generated tree structure is as follows:

<LiteTree>
Root
    A               //! atNode
    A3          //+ 3rd add
    A2          //+ 2nd add
    A1          //+ 1st add    
    B
    C
</LiteTree>

### Previous Sibling


Adds one or more nodes as the previous sibling of the `atNode` node.


```ts {4-14} 

import { PreviousSibling } from "flextree"

await tree.write(async ()=>{   
    const anode = await tree.findNode({name:"A"})
    // 1st add
    await tree.addNodes([
        {name: "A1"},
    ],anode,PreviousSibling)
    // 2nd add
    await tree.addNodes([
        {name: "A2"},
    ],anode,PreviousSibling)
    // 3rd add
    await tree.addNodes([
        {name: "A3"},
    ],anode,PreviousSibling)
})  

```

The generated tree structure is as follows:

<LiteTree>
Root    
    A1          //+ 1st add
    A2          //+ 2nd add
    A3          //+ 3rd add
    A               //! atNode 
    B
    C
</LiteTree>

