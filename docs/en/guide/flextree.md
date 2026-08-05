# FlexTree

Before this section, we have been using `FlexTreeManager` for the examples. From this section on, we introduce `FlexTree`, an object focused on querying.

Since `FlexTree` is based on the `Left-Right Value algorithm`, which is a read-optimized storage structure, it has high query efficiency but lower update efficiency.
So in principle it is especially suited for scenarios where reads outnumber updates. To make it easier to work with the tree, the `FlexTree` object and the node object `FlexTreeNode` are introduced.

 

## Creating the Tree Object

`FlexTree` is a class dedicated to loading a tree into memory and providing more convenient tree `API`s.

```ts {8-10}
import type { FlexTreeOptions, IFlexTreeNode } from 'flextree'
import { FlexTreeManager,FlexTree, FlexTreeVerifyError } from 'flextree'

import SqliteAdapter from 'flextree-sqlite-adapter' 
const sqliteDriver = new SqliteAdapter()
await sqliteDriver.open()

const tree = new FlexTree('tree', {
    adapter: sqliteDriver,
})
await tree.load()

```

## Object Tree

**After the `FlexTree` object is loaded, it builds a nested tree of object instances composed of `FlexTreeNode`s, as follows:**

<LiteTree>
FlexTreeNode(Root)
    children({color:red}[])                                //*     
       FlexTreeNode(A)
            children({color:red}[])                        //*                 
                FlexTreeNode(A1)
                FlexTreeNode(A2)
                FlexTreeNode(A3)
        FlexTreeNode(B)
            children({color:red}[])                        //*             
                FlexTreeNode(B1)
                FlexTreeNode(B2)
                FlexTreeNode(B3)
                FlexTreeNode(B)
        FlexTreeNode(C)                
            children({color:red}[])                        //*               
                FlexTreeNode(C1)
                FlexTreeNode(C2)
                FlexTreeNode(C3)
</LiteTree>


## Generics

Because `FlexTree` internally creates a `FlexTreeManager` object automatically when instantiated, its generics are the same as those of `FlexTreeManager`.

```ts 
export class FlexTree<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields
>
```

The way to customize key fields is the same as well, as follows:

```ts {4-6,12-14}
import { FlexTree } from "felxtree"
import PrismaAdapter from "flextree-prisma-adapter"

    const tree = new FlexTree<{ 
        size: number
    },
    {
        id:['pk',number],
        treeId:['tree',number],
        name:"title",
        leftValue:'lft',
        rightValue:'rgt'
    }>('org', {
        adapter: new PrismaAdapter(prisma),
        fields:{
            id:'pk',
            treeId:'tree',
            name:'title',
            leftValue:'lft',
            rightValue:"rgt"
        }
    })
```

See the [FlexTreeManager](./manager.md) introduction.

## Loading 

Execute `FlexTree.load` to load the tree from the database into memory.

### Full Load 

```ts
const tree = new FlexTree('tree')

console.log(tree.status)  // == not-loaded
// Load the tree into memory all at once
await tree.load()
console.log(tree.status)  // ==  loaded
// Get the root FlexNode instance
tree.root

``` 

### Lazy Loading 

If the tree has too many nodes, you can also enable lazy loading to manually control which nodes are loaded

```ts
const tree = new FlexTree('tree',{
    lazy:true
})
 
await tree.load()

``` 

In lazy loading mode, the above code only loads the root node and its children; the object tree is as follows:

<LiteTree>
FlexTreeNode(Root)
    children({color:red}[])                                //* []   
       FlexTreeNode(A)
            children({color:red}[])                        // length=0                
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A1)       // Not loaded                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A2)        // Not loaded 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A3)         // Not loaded
        FlexTreeNode(B)
            children({color:red}[])                        // length=0           
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}B1)       // Not loaded                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}B2)        // Not loaded 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}B3)         // Not loaded
        FlexTreeNode(C)                
            children({color:red}[])                        // length=0           
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C1)       // Not loaded                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C2)        // Not loaded 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C3)         // Not loaded
</LiteTree>

The three nodes `A`, `B`, and `C` above are in the `not-loaded` state, and none of their children or descendants are loaded.

Then, you can call `FlexTreeNode.load()` on demand to load them.

For example, the following code loads node `B`:

```ts
const bnode = tree.getByPath("Root/B")

console.log(bnode.status)  // == 'not-loaded'
await bnode.load()
console.log(bnode.status)  // == 'loaded'

```

The object tree after node `B` is loaded:


<LiteTree>
FlexTreeNode(Root)
    children({color:red}[])                                //* []   
       FlexTreeNode(A)
            children({color:red}[])                        // length=0                
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A1)       // Not loaded                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A2)        // Not loaded 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A3)         // Not loaded
        FlexTreeNode(B)                                     // loaded
            children({color:red}[])                        // length=3           
                FlexTreeNode(B1)                        
                FlexTreeNode(B2)        
                FlexTreeNode(B3)          
        FlexTreeNode(C)                
            children({color:red}[])                        // length=0           
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C1)       // Not loaded                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C2)        // Not loaded 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C3)         // Not loaded
</LiteTree>
  
:::warning Note
Both `FlexTree` and `FlexTreeNode` instances have a `load` method. `FlexTree.load` is used to load the entire tree, while `FlexTreeNode.load` only loads a specific node.
:::

## Accessing Nodes by Path

When the `FlexTree` or `FlexTreeNode` is loaded, you can use the `getByPath` method on the `FlexTree` and `FlexTreeNode` instances to get the node instance at a specified path.

```ts
getByPath(
    path: string, 
    options?: { byField?: string, delimiter?: string }
): FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId> | undefined 

```

- **Parameters**

| Field Name | Data Type | Description |
| ----  |  ---- | ---- | 
| `path` | `string` | Position of the node in the tree |
| `options` | `object` | Options |
| `options.byField` | `string` | Specifies which field value the path is composed of; defaults to `name` |
| `options.delimiter` | `string` | Path delimiter; defaults to `/` |

- **Return Value**

Returns the `FlexTreeNode` instance at the specified path, or `undefined` if the node does not exist.


- **Example**

```ts
tree.getByPath('/')
tree.getByPath('./')
tree.getByPath('./A')
tree.getByPath('./A/A-1')
tree.getByPath('./A/A-1/A-1-1')
tree.getByPath('A')
tree.getByPath('A/A-1')
tree.getByPath('A/A-1/A-1-1') 

const b1 = root.getByPath('B')!
b1.getByPath('../A')
b1.getByPath('../A/A-1')
b1.getByPath('../A/A-1/A-1-1')

b1.getByPath('B-1')
b1.getByPath('B-1/B-1-1')

```

- **Notes**

    - Both `FlexTree` and `FlexTreeNode` instances have a `getByPath` method. `FlexTree.getByPath` searches the entire tree, while `FlexTreeNode.getByPath` uses a path relative to the node.
    - You can use relative path syntax: `./` means the current node, `../` means the parent node, `../../` means an ancestor node, and so on.


## Getting a Node

Use the `get` method on `FlexTree` and `FlexTreeNode` instances to return the specified instance among the node itself and its descendants.

```ts
get(nodeId: NodeId): FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId> | undefined
```
- **Parameters**

| Field Name | Data Type | Description |
| ----  |  ---- | ---- |
| `nodeId` | `NodeId` | Unique identifier of the node | 

- **Return Value**

Returns the `FlexTreeNode` instance with the specified `nodeId`, or `undefined` if the node does not exist.

## Node Status

When lazy loading is enabled via `FlexTree.options.lazy=true`, the `FlexTreeNode` instance has a status property that indicates the node's loading state.

```ts
type FlexTreeNodeStatus = 'not-loaded' | 'loading' | 'loaded' | 'error'
```

- **Status values**

| Status | Description |
| ----  |  ---- |
| `not-loaded` | Not loaded |
| `loading` | Loading |
| `loaded` | Loaded |
| `error` | Loading error |
 
## Syncing Data

`FlexTree` and `FlexTreeNode` provide a `sync` method to reload node data from the database.

```ts
async sync(includeDescendants: boolean = false):void
```

## FlexTree

- **Properties**

| Method Name | Return Type | Description |
| ----  |  ---- | ---- |
| `root` | `FlexTreeNode` | Returns the root node |
| `status` | `string` | Gets the status of the root node | 
| `options` | `FlexTreeOptions` | Gets the options |
| `manager` | `FlexTreeManager` | Gets the manager |


- **Methods**

| Method Name | Return Type | Description |
| ----  |  ---- | ---- |
| `load` | `Promise<void>` | Loads the tree into memory |
| `getByPath` | `FlexTreeNode` | Gets a node by path |
| `get` | `FlexTreeNode` | Gets a node |
| `find` | `FlexTreeNode[]` | Finds nodes |
| `toJson` | `TreeNode` | Serializes the tree to an object |
| `toList` | `TreeNode[]` | Serializes the tree to a `pid` array |
| `on` | `void` | Listens to an event |
| `off` | `void` | Removes an event listener |
| `emit` | `void` | Emits an event |
| `sync` | `void` | Syncs data | 

## FlexNode


- **Properties**

| Method Name | Return Type | Description |
| ----  |  ---- | ---- |
| `root` | `FlexTreeNode` | Returns the root node |
| `status` | `string` | Gets the status of the root node | 
| `options` | `FlexTreeOptions` | Gets the options |
| `manager` | `FlexTreeManager` | Gets the manager |


- **Methods**

| Method Name | Return Type | Description |
| ----  |  ---- | ---- |
| `load` | `Promise<void>` | Loads the tree into memory |
| `getByPath` | `FlexTreeNode` | Gets a node by path |
| `get` | `FlexTreeNode` | Gets a node |
| `find` | `FlexTreeNode[]` | Finds nodes |
| `toJson` | `TreeNode` | Serializes the tree to an object |
| `toList` | `TreeNode[]` | Serializes the tree to a `pid` array | 
| `sync` | `void` | Syncs data | 
