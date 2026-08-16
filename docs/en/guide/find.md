# Finding Nodes

The `findNode` and `findNodes` methods are used to find and return nodes.

## findNodes

`findNodes` returns the set of nodes that match the condition.

```ts
async findNodes(condition: Partial<TreeNode>): Promise<TreeNode[]> 
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `condition` |  Partial\<TreeNode\> | None | Node data |

- **Return Value**

Returns the set of nodes that match the condition.

- **Example**

```ts 
const nodes = await findNodes(name: 'node1' });
```

 

## findNode

`findNodes` returns the node that matches the condition.
```ts
async findNode(node: NodeId | Partial<TreeNode>): Promise<TreeNode> 
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `node` | NodeId \| Partial\<TreeNode\> | None | Node `id` or node object |

- **Return Value**

Returns the node that matches the condition.

- **Example**

```ts
// Returns the node whose id is 100
const node = await findNode(100);
// Returns the node whose name is node1
const node = await findNode(name: 'node1' });
```


:::warning Note
The `findNode` and `findNodes` methods only provide simple conditional queries. For more complex queries, use the database's own query methods.

Both methods support the `options.countField` parameter, which attaches a descendant-count field to the returned node data. See [Query Parameters](./query#query-parameters).
:::
