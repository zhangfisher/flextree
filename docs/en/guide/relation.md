# Node Relations

The `getNodeRelation` method is used to get the relationship between two nodes.

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

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `srcNode` | NodeId \| TreeNode | None | Source node |
| `targetNode` | NodeId \| TreeNode | None | Target node |

- **Return Value**

Returns a `FlexTreeNodeRelation` enum value representing the relationship between the two nodes.
 

The values of `FlexTreeNodeRelation` are as follows:

| Enum value | Description |
| --- | --- |
| `Self` | The two nodes are the same node |
| `Siblings` | The two nodes are siblings |
| `Descendants` | The source node is a descendant of the target node |
| `Ancestors` | The source node is an ancestor of the target node |
| `DiffTree` | The two nodes are not on the same tree |
| `SameTree` | The two nodes are on the same tree |
| `SameLevel` | The two nodes are on the same level |
| `Unknow` | Unknown relationship |
