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

除了上述按关系查询节点外，`FlexTreeManager`还提供了`forEach`方法用于遍历树（或子树）的所有节点，支持`深度优先DFS`与`广度优先BFS`两种模式。

:::warning 重点：一次回调 = 一个节点**及其全部子节点**
`forEach`并不是"一次遍历一个节点"。每回调一次，处理的是**一个节点连同它的所有直接子节点**——回调签名 `(node, children)` 中的 `children` 就是该节点刚查出来的完整子节点列表（一次数据库查询取回一整层）。

这带来两个关键特性：

- **特别适用于大型树的懒加载**：回调拿到的 `(node, children)` 恰好就是 UI 树组件一个节点的完整渲染单元——当前节点 + 其全部子节点，天然对应"展开一个节点时加载其子层"的懒加载交互。配合 `maxLevel: 1` 从任意 `startFrom` 开始，每次只取一层，展开哪个节点就查哪个节点的子层，未展开的部分完全不产生查询。
- **适合遍历大型树表**：遍历是流式的，内存占用为 **O(树宽度) 而非 O(节点数)**——BFS 队列只持有当前层，DFS 处理完一个子树即释放。百万级节点的树也能遍历，不需要把整棵树装进内存。
- **SQL 次数 = 回调次数**：每个被访问节点执行一次 `getChildren` 查询（一条 SQL 取回该节点的全部子节点）。树形遍历无法用单条 SQL 表达，逐节点取子层是为流式处理刻意设计的。

对比：`toJson`/`toList` 会把整棵树加载进内存再组装——大树导出请优先用 `forEach` 流式处理。
:::

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
    includeRecyclebin?: boolean    // 是否遍历回收站内的节点：false（默认）回收站节点视为不存在、不进入；true 作为普通节点进入遍历
}
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `callback` | `(node, children) => boolean` | 无 | 遍历回调，**接收当前节点与其全部直接子节点**（一次回调处理一层）；返回`false`可中断遍历 |
| `options.mode` | `'dfs' \| 'bfs'` | `'dfs'` | 遍历模式 |
| `options.startFrom` | `NodeId \| TreeNode` | 根节点 | 遍历的起始节点 |
| `options.maxLevel` | `number` | `Infinity` | 最大遍历层级 |
| `options.includeStartNode` | `boolean` | `true` | 是否包含起始节点 |
| `options.includeRecyclebin` | `boolean` | `false` | `false`（默认）回收站内节点视为不存在、不进入遍历；`true` 时站内节点作为普通节点参与遍历（见[回收站](./recyclebin)） |

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

// 流式处理大树：边遍历边处理，内存与树规模解耦
await tree.forEach((node, children) => {
    if (children.length === 0) {
        exportLeaf(node) // 逐个处理叶子节点，无需等待整棵树加载
    }
    return true
})

// 大型树的懒加载：展开哪个节点就查哪个节点的子层（每次仅 1 条 SQL）
async function expandNode(nodeId: NodeId): Promise<TreeNode[]> {
    // 只取该节点的直接子层，未展开的子树零查询
    let children: TreeNode[] = []
    await tree.forEach((node, kids) => {
        children = kids
        return false // 只需要一个回调即中断
    }, { startFrom: nodeId, maxLevel: 1 })
    return children
}
```

- **说明**

    - 回调返回`false`会中断遍历；返回`true`或其它值则继续。
    - `maxLevel`按层级（`level`）限制，超出层级的节点不会被访问。
    - 遍历过程中**不要执行写操作**（写需在 `write()` 内且与遍历的读交错可能读到中间态）。

## 查询参数

各查询方法的`options`成员项汇总介绍。除`forEach`的专属参数（`mode`/`startFrom`/`maxLevel`/`includeStartNode`）外，以下参数在多个查询方法间通用：

### countField

指定后，返回的每条节点数据会附加一个表示**后代节点数量**的字段（叶子节点为`0`）。适用于所有查询方法（`getNodes`/`getNode`/`getDescendants`/`getChildren`/`getNthChild`/`getAncestors`/`getParent`/`getSiblings`/`getNextSibling`/`getPreviousSibling`/`getRoot`/`findNodes`/`findNode`）与导出方法（`toJson`/`toList`，见[导出](./export)）。

```ts
const nodes = await treeManager.getNodes({ countField: "count" })
// [ {id:1,name:"ROOT",count:3,...}, {id:2,name:"A",count:0,...}, ... ]
```

- 数量按`(rightValue - leftValue - 1) / 2`计算，由数据库在`SQL`中直接完成
- 恒为**全量后代数**——不受`level`等截断参数影响
- 与`getDescendantsCount(node)`（默认视角）结果一致
- 与节点已有字段重名时会抛出`FlexTreeError`
- 启用回收站时为**可见口径**：默认视角下数量不含已被回收的节点；`includeRecyclebin: true`时为物理全集数量

### level

限定返回的层级。`0`（默认）表示不限制；`getNodes`中`level=N`返回第`1-N`层节点；`getDescendants`中`level=N`返回参照节点下`N`层之内的后代。`countField`的数量计算不受其影响。

### includeSelf

是否包含参照节点自身，默认`false`。适用于`getDescendants`/`getAncestors`/`getSiblings`。

### includeRecyclebin

是否在查询中包含回收站内的节点，默认`false`（启用回收站后生效，见[回收站](./recyclebin)）。

- `false`（默认）：被逻辑删除（已进回收站）的节点**视为不存在**——`getNodes`/`getDescendants`/`findNodes`等查不到它们，`getNode`按 id 读取抛`NotFound`，遍历与导出结果不含它们
- `true`：进入回收站视角，**回收站（bin 节点）及其内部的所有节点均可以像普通节点一样进行一切操作**——查询、修改、移动、复制、删除照常

**何时需要设为`true`：管理回收站本身时。** 默认视角下站内节点完全不可见，任何针对回收站内容的操作——列出回收站列表（渲染"回收站页面"）、读取站内节点用于恢复、从站内彻底删除、站内重排——都必须先以`includeRecyclebin: true`进入回收站视角才能读到、操作到目标节点。

适用于所有读取方法。与`countField`组合时控制其口径：默认为可见数量（不含站内），`true`为物理全集数量。

### fields

限定返回的字段名称，默认返回全部字段。适用于`getNodes`。指定后`id`与`countField`附加字段仍然保留。

