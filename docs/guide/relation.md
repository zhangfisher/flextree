# 节点关系

`getNodeRelation`方法用于获取两个节点之间的关系。

```ts
async getNodeRelation(
    srcNode: NodeId | TreeNode, 
    targetNode: NodeId | TreeNode
): Promise<FlexTreeNodeRelation> 


enum FlexTreeNodeRelation {
    Self = 0,
    Parent = 1,
    Child = 2,
    Siblings = 3,
    Descendants = 4,
    Ancestors = 5,
    DiffTree = 6,
    SameTree = 7,
    SameLevel = 8,
    Unknow = 9,
}

```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `srcNode` | NodeId \| TreeNode | 无 | 源节点 |
| `targetNode` | NodeId \| TreeNode | 无 | 目标节点 |

- **返回值**

返回一个`FlexTreeNodeRelation`枚举值，表示两个节点之间的关系。
 

`FlexTreeNodeRelation`取值如下：

| 枚举值 | 描述 |
| --- | --- |
| `Self` | 两个节点是同一个节点 |
| `Siblings` | 两个节点是兄弟节点 |
| `Descendants` | 源节点是目标节点的后代节点 |
| `Ancestors` | 源节点是目标节点的祖先节点 |
| `DiffTree` | 两个节点不在同一棵树上 |
| `SameTree` | 两个节点在同一棵树上 |
| `SameLevel` | 两个节点在同一层级上 |
| `Unknow` | 未知关系 |




