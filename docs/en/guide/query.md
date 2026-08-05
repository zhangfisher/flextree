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
}
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `callback` | `(node, children) => boolean` | None | Traversal callback; receives the current node and its direct children; return `false` to break the traversal |
| `options.mode` | `'dfs' \| 'bfs'` | `'dfs'` | Traversal mode |
| `options.startFrom` | `NodeId \| TreeNode` | root node | Start node of the traversal |
| `options.maxLevel` | `number` | `Infinity` | Maximum traversal level |
| `options.includeStartNode` | `boolean` | `true` | Whether to include the start node |

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
```

- **Notes**

    - Returning `false` from the callback breaks the traversal; returning `true` or any other value continues.
    - `maxLevel` limits by `level`; nodes beyond the level will not be visited.
