# 查找节点

`findNode`和`findNodes`方法用于查找并返回节点。

## findNodes

`findNodes`返回满足条件的节点集合。

```ts
async findNodes(condition: Partial<TreeNode>): Promise<TreeNode[]> 
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `condition` |  Partial\<TreeNode\> | 无 | 节点数据 |

- **返回值**

返回满足条件的节点集合。

- **示例**

```ts 
const nodes = await findNodes(name: 'node1' });
```
 

## findNode

`findNodes`返回满足条件的节点。
```ts
async findNode(node: NodeId | Partial<TreeNode>): Promise<TreeNode> 
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `node` | NodeId \| Partial\<TreeNode\> | 无 | 节点`id`或节点对象 |

- **返回值**

返回满足条件的节点。

- **示例**

```ts
// 返回id为100的节点
const node = await findNode(100);
// 返回name为node1的节点
const node = await findNode(name: 'node1' });
```


:::warning 提示
`findNode`和`findNodes`方法只提供简单的条件查询，如果需要更复杂的查询，可以使用数据库的查询方法。
:::
