# 查询树

当创建好`FlexTreeManager`对象实例后，我们就可以通过`FlexTreeManager`对象实例来查询树。

`FlexTree`提供支持了非常丰富的查询树的`API`。
 
 
## 查询根节点

```ts
const root = await treeManager.getRoot()
```

## 查询所有节点集

`getNodes`方法用于获取树的所有节点集，支持限制返回的层级。



```ts
async getNodes(options?: { level?: number }): Promise<TreeNode[]> 
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `options` |  | 无 | 可选的，配置选项 |
| `options.level` | number | 无 | 可选的，限制返回的层级 |


- **示例**

**返回所有节点集**

```ts
const nodes = await treeManager.getNodes()
```

**限制返回所有节点集的层级**

```ts
// 只返回第1-3层节点集
const nodes = await treeManager.getNodes(3)
```

- **说明**

    `getNodes`方法返回的是有序的节点集 如:

<LiteTree>
Root
    A
    B
    C
</LiteTree>

`getNodes`返回的是:

```ts
[
    {id:1,left:1,right:8,level:1,name:"ROOT"},
    {id:2,left:2,right:3,level:2,name:"A"},
    {id:3,left:4,right:5,level:2,name:"B"},
    {id:4,left:6,right:7,level:2,name:"C"}
]
```

## 查询指定节点

`getNode`方法用于根据节点`id`用于获取指定节点。



```ts
async getNode(nodeId: NodeId): Promise<TreeNode | undefined>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId | 无 | 节点`id` |

- **说明**

- `NodeId`是一个泛型类型，默认为是`number`类型， 您也可以通过构建`FlexTree`或`FlexTreeManager`的泛型来自定义。


## 查询后代节点集

`getDescendants`方法用于获取指定节点的后代节点集，支持限制返回的层级。



```ts
    async getDescendants(
        nodeId?: NodeId | TreeNode, 
        options?: { level?: number, includeSelf?: boolean })
    : Promise<IFlexTreeNode<Fields, KeyFields>[]> 
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId | 无 | 节点`id`或节点对象,如果为`undefined`，则返回根节点的后代节点集。 |
| `options` |  | 无 | 可选的，配置选项 |
| `options.level` | number | 无 | 可选的，限制返回的层级 |
| `options.includeSelf` | boolean | false | 可选的，是否包含自身节点 |
 

## 查询子节点集

`getChildren`方法用于获取指定节点的子节点集。



```ts
    async getChildren(nodeId: NodeId | TreeNode) {
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId | 无 | 节点`id`或节点对象 |

- **说明**

- `getChildren`等效于`getDescendants(nodeId,{level:1})`方法。


## 查询第N个子节点

`getNthChild`方法用于获取指定节点的第`N`个子节点。



```ts
async getNthChild(node: NodeId | TreeNode, index: number = 1)
: Promise<TreeNode | undefined> {
```
- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |
| `index` | number | 1 | 子节点的索引，从`1`开始，`<0`代表倒数 |

- **说明**

- `getNthChild`支持传入负数，代表倒数第`N`个子节点。如`getNthChild(100,-1)`代表倒数第一个子节点。


## 查询后代节点数量

`getDescendantsCount`方法用于获取指定节点的后代节点数量。



```ts
async getDescendantsCount(
    nodeId: NodeId | TreeNode, 
    options?: { level?: number }
): Promise<number>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |
| `options` |  | 无 | 可选的，配置选项 |
| `options.level` | number | 0 | 可选的，限制层级 |


## 查询祖先节点集

`getAncestors`方法用于获取指定节点的祖先节点集。



```ts
async getAncestors(
    nodeId: NodeId | TreeNode, 
    options?: { includeSelf?: boolean }
): Promise<TreeNode[]>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |
| `options` |  | 无 | 可选的，配置选项 |
| `options.includeSelf` | boolean | false | 可选的，是否包含自身节点 |

## 查询祖先节点数量

`getAncestorsCount`方法用于获取指定节点的祖先节点数量。



```ts
async getAncestorsCount(nodeId: NodeId) 
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId | 无 | 节点`id` |


## 查询父节点

`getParent`方法用于获取指定节点的父节点。

```ts
async getParent(nodeId: NodeId | TreeNode): Promise<TreeNode>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |


## 查询兄弟节点集

`getSiblings`方法用于获取指定节点的兄弟节点集。

```ts
async getSiblings(
    nodeId: NodeId | TreeNode, 
    options?: { includeSelf?: boolean }
):Promise<TreeNode[]>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |
| `options` |  | 无 | 可选的，配置选项 |
| `options.includeSelf` | boolean | false | 可选的，是否包含自身节点 |


## 查询下一兄弟节点

`getNextSibling`方法用于获取指定节点的下一个兄弟节点。

```ts
async getNextSibling(nodeId: NodeId | TreeNode): Promise<TreeNode | undefined>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |


## 查询上一兄弟节点

`getPrevSibling`方法用于获取指定节点的上一个兄弟节点。

```ts
async getPreviousSibling(nodeId: NodeId | TreeNode) : Promise<TreeNode | undefined>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |


## 遍历节点

除了上述按关系查询节点外，`FlexTreeManager`还提供了`forEach`方法用于遍历树（或子树）的所有节点，支持**深度优先（DFS）**与**广度优先（BFS）**两种模式。

```ts
async forEach(
    callback: (node: TreeNode, children: TreeNode[]) => boolean,
    options?: ForEachOptions
): Promise<void>

interface ForEachOptions {
    mode?: 'dfs' | 'bfs'           // 遍历模式，默认 'dfs'
    startFrom?: NodeId | TreeNode  // 起始节点，默认根节点
    maxLevel?: number              // 最大遍历层级，默认无限
    includeStartNode?: boolean     // 是否包含起始节点，默认 true
}
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `callback` | `(node, children) => boolean` | 无 | 遍历回调，接收当前节点与其直接子节点；返回`false`可中断遍历 |
| `options.mode` | `'dfs' \| 'bfs'` | `'dfs'` | 遍历模式 |
| `options.startFrom` | `NodeId \| TreeNode` | 根节点 | 遍历的起始节点 |
| `options.maxLevel` | `number` | `Infinity` | 最大遍历层级 |
| `options.includeStartNode` | `boolean` | `true` | 是否包含起始节点 |

- **示例**

```ts
// 深度优先遍历整棵树
await tree.forEach((node, children) => {
    console.log(`节点 ${node.name} 有 ${children.length} 个子节点`)
    return true // 返回 false 可提前中断
})

// 广度优先遍历，并限制最多 2 层
await tree.forEach((node) => {
    console.log(node.name)
    return true
}, { mode: 'bfs', maxLevel: 2 })

// 从指定节点开始遍历
const nodeA = await tree.getNode(2)
await tree.forEach((node) => {
    console.log(node.name)
    return true
}, { startFrom: nodeA })
```

- **说明**

    - 回调返回`false`会中断遍历；返回`true`或其它值则继续。
    - `maxLevel`按层级（`level`）限制，超出层级的节点不会被访问。

