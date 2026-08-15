# Querying the Tree

Once a `FlexTreeManager` instance is created, we can query the tree through the `FlexTreeManager` instance.

`FlexTree` provides a very rich set of `API`s for querying trees.
 
 
## Querying the Root Node

```ts
const root = await treeManager.getRoot()
```

## Querying All Nodes

The `getNodes` method is used to retrieve all nodes of the tree and supports limiting the level of nodes returned.



```ts
async getNodes(options?: { level?: number }): Promise<TreeNode[]> 
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `options` |  | None | Optional. Configuration options |
| `options.level` | number | None | Optional. Limits the level returned |


- **Example**

**Return all nodes**

```ts
const nodes = await treeManager.getNodes()
```

**Limit the level of returned nodes**

```ts
// Only return nodes at levels 1-3
const nodes = await treeManager.getNodes(3)
```

- **Notes**

    The `getNodes` method returns an ordered set of nodes. For example:

<LiteTree>
Root
    A
    B
    C
</LiteTree>

`getNodes` returns:

```ts
[
    {id:1,left:1,right:8,level:1,name:"ROOT"},
    {id:2,left:2,right:3,level:2,name:"A"},
    {id:3,left:4,right:5,level:2,name:"B"},
    {id:4,left:6,right:7,level:2,name:"C"}
]
```

## Querying a Specific Node

The `getNode` method retrieves a specific node by its `id`.



```ts
async getNode(nodeId: NodeId): Promise<TreeNode | undefined>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId | None | Node `id` |

- **Notes**

- `NodeId` is a generic type, defaulting to `number`. You can also customize it via the generics of `FlexTree` or `FlexTreeManager`.


## Querying Descendant Nodes

The `getDescendants` method retrieves the descendant nodes of a specified node and supports limiting the level returned.



```ts
    async getDescendants(
        nodeId?: NodeId | TreeNode, 
        options?: { level?: number, includeSelf?: boolean })
    : Promise<IFlexTreeNode<Fields, KeyFields>[]> 
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId | None | Node `id` or node object. If `undefined`, returns the descendants of the root node. |
| `options` |  | None | Optional. Configuration options |
| `options.level` | number | None | Optional. Limits the level returned |
| `options.includeSelf` | boolean | false | Optional. Whether to include the node itself |
 

## Querying Child Nodes

The `getChildren` method retrieves the child nodes of a specified node.



```ts
    async getChildren(nodeId: NodeId | TreeNode) {
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId | None | Node `id` or node object |

- **Notes**

- `getChildren` is equivalent to `getDescendants(nodeId,{level:1})`.


## Querying the Nth Child Node

The `getNthChild` method retrieves the `N`-th child node of a specified node.



```ts
async getNthChild(node: NodeId | TreeNode, index: number = 1)
: Promise<TreeNode | undefined> {
```
- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode| None | Node `id` or node object |
| `index` | number | 1 | The index of the child node, starting from `1`. `<0` means counting from the end |

- **Notes**

- `getNthChild` accepts negative numbers, which represent the `N`-th child from the end. For example, `getNthChild(100,-1)` means the last child node.


## Querying the Number of Descendants

The `getDescendantsCount` method retrieves the number of descendant nodes of a specified node.



```ts
async getDescendantsCount(
    nodeId: NodeId | TreeNode, 
    options?: { level?: number }
): Promise<number>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| None | Node `id` or node object |
| `options` |  | None | Optional. Configuration options |
| `options.level` | number | 0 | Optional. Limits the level |


## Querying Ancestor Nodes

The `getAncestors` method retrieves the ancestor nodes of a specified node.



```ts
async getAncestors(
    nodeId: NodeId | TreeNode, 
    options?: { includeSelf?: boolean }
): Promise<TreeNode[]>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| None | Node `id` or node object |
| `options` |  | None | Optional. Configuration options |
| `options.includeSelf` | boolean | false | Optional. Whether to include the node itself |

## Querying the Number of Ancestors

The `getAncestorsCount` method retrieves the number of ancestor nodes of a specified node.



```ts
async getAncestorsCount(nodeId: NodeId) 
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId | None | Node `id` |


## Querying the Parent Node

The `getParent` method retrieves the parent node of a specified node.

```ts
async getParent(nodeId: NodeId | TreeNode): Promise<TreeNode>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| None | Node `id` or node object |


## Querying Sibling Nodes

The `getSiblings` method retrieves the sibling nodes of a specified node.

```ts
async getSiblings(
    nodeId: NodeId | TreeNode, 
    options?: { includeSelf?: boolean }
):Promise<TreeNode[]>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| None | Node `id` or node object |
| `options` |  | None | Optional. Configuration options |
| `options.includeSelf` | boolean | false | Optional. Whether to include the node itself |


## Querying the Next Sibling

The `getNextSibling` method retrieves the next sibling of a specified node.

```ts
async getNextSibling(nodeId: NodeId | TreeNode): Promise<TreeNode | undefined>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| None | Node `id` or node object |


## Querying the Previous Sibling

The `getPreviousSibling` method retrieves the previous sibling of a specified node.

```ts
async getPreviousSibling(nodeId: NodeId | TreeNode) : Promise<TreeNode | undefined>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| None | Node `id` or node object |


## Traversing Nodes

In addition to the relationship-based queries above, `FlexTreeManager` also provides a `forEach` method to traverse all nodes of a tree (or subtree), supporting both **Depth-First Search (DFS)** and **Breadth-First Search (BFS)** modes.

:::warning Key point: one callback = one node **plus all its children**
`forEach` does not traverse "one node at a time". Each callback invocation handles **one node together with all of its direct children** — the `children` in the `(node, children)` signature is the node's freshly fetched, complete child list (one database query retrieves an entire level).

This brings two key properties:

- **Especially suited to lazy loading of large trees**: the `(node, children)` received by each callback is exactly the complete rendering unit of one node in a tree UI component — the current node plus all of its children, naturally matching the "load children when a node expands" lazy-loading interaction. Combined with `maxLevel: 1` from any `startFrom`, only one level is fetched at a time: expanding a node queries just that node's child level, and unexpanded parts generate no queries at all.
- **Built for large tree tables**: the traversal is streaming, with memory usage of **O(tree breadth), not O(node count)** — the BFS queue holds only the current level, and DFS releases each subtree once processed. Trees with millions of nodes can be traversed without loading the whole tree into memory.
- **SQL count = callback count**: each visited node performs one `getChildren` query (a single SQL fetching all of that node's children). Tree-shaped traversal cannot be expressed in a single SQL; fetching each node's child level is a deliberate streaming design.

Comparison: `toJson`/`toList` load the entire tree into memory before assembling — for exporting large trees, prefer streaming with `forEach`.
:::

```ts
async forEach(
    callback: (node: TreeNode, children: TreeNode[]) => boolean,
    options?: ForEachOptions
): Promise<void>

interface ForEachOptions {
    mode?: 'dfs' | 'bfs'           // Traversal mode, default 'dfs'
    startFrom?: NodeId | TreeNode  // Start node, defaults to the root node
    maxLevel?: number              // Maximum traversal level, default unlimited
    includeStartNode?: boolean     // Whether to include the start node, default true
    includeRecyclebin?: boolean    // Whether to enter the recycle bin, default false (effective when the recycle bin is enabled)
}
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `callback` | `(node, children) => boolean` | None | Traversal callback; **receives the current node and all of its direct children** (one callback handles one level); return `false` to break the traversal |
| `options.mode` | `'dfs' \| 'bfs'` | `'dfs'` | Traversal mode |
| `options.startFrom` | `NodeId \| TreeNode` | root node | Start node of the traversal |
| `options.maxLevel` | `number` | `Infinity` | Maximum traversal level |
| `options.includeStartNode` | `boolean` | `true` | Whether to include the start node |
| `options.includeRecyclebin` | `boolean` | `false` | Whether to enter the recycle-bin subtree (see [Recycle Bin](./recyclebin)) |

- **Example**

```ts
// Depth-first traversal of the entire tree
await tree.forEach((node, children) => {
    console.log(`Node ${node.name} has ${children.length} child nodes`)
    return true // Return false to break early
})

// Breadth-first traversal, limited to at most 2 levels
await tree.forEach((node) => {
    console.log(node.name)
    return true
}, { mode: 'bfs', maxLevel: 2 })

// Traverse starting from a specific node
const nodeA = await tree.getNode(2)
await tree.forEach((node) => {
    console.log(node.name)
    return true
}, { startFrom: nodeA })

// Stream-process a large tree: process while traversing, memory decoupled from tree size
await tree.forEach((node, children) => {
    if (children.length === 0) {
        exportLeaf(node) // Process leaf nodes one by one, no need to wait for the whole tree to load
    }
    return true
})

// Lazy loading for large trees: expanding a node queries just its child level (1 SQL each time)
async function expandNode(nodeId: NodeId): Promise<TreeNode[]> {
    // Fetch only the node's direct child level; unexpanded subtrees cost zero queries
    let children: TreeNode[] = []
    await tree.forEach((node, kids) => {
        children = kids
        return false // interrupt after a single callback
    }, { startFrom: nodeId, maxLevel: 1 })
    return children
}
```

- **Notes**

    - Returning `false` from the callback breaks the traversal; returning `true` or any other value continues.
    - `maxLevel` limits by `level`; nodes beyond the level will not be visited.
    - Do not perform write operations during traversal (writes must run inside `write()`, and interleaving them with traversal reads may observe intermediate states).
