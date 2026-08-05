# Updating Nodes

## Update Notes

Since the tree is stored in a database table and each node corresponds to a record, **updating a node simply means updating the corresponding record in the database table.**

In principle, you can directly use the database operation method you are most familiar with (such as `prisma`, `typeORM`, etc.) to update nodes, but please pay special attention to the following points:

- **You cannot directly update the key fields that the tree depends on, such as `leftValue`, `rightValue`, `level`, and `treeId`**, because these fields are automatically generated based on the structure of the tree. **Directly updating them will corrupt the tree structure**.
- Since `FlexTree` nodes are extensible, you can customize other fields beyond the tree's key fields, and these fields can be updated directly.


:::warning Special Note
You cannot directly update the key fields that the tree depends on, such as `leftValue`, `rightValue`, `level`, and `treeId`.
:::

## update

For your convenience, we provide a simple `update` method that can only be used to update non-key fields.

```ts
async update(node: Partial<TreeNode> | Partial<TreeNode>[]): Promise<void>
```

- **Parameters**

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `node` | Partial\<TreeNode\> \| Partial\<TreeNode\>[] | None | The node or array of nodes to update |

- **Return**

| Type | Description |
| --- | --- |
| `Promise\<void\>` | None |

- **Example**

```ts
const node = await tree.update({
    id: 1,
    name: 'new name',
    description: 'new description'
});
```

- **Notes**

    - When you use the `update` method, key fields such as `leftValue`, `rightValue`, `level`, and `treeId` will be filtered out to avoid accidentally corrupting the tree structure.
    - Since the `update` method does not involve updates to the tree structure, it does not need to be executed inside the `write` method.
