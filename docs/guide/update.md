# 更新节点

## 更新说明

由于树是存储在数据库表中，每个节点对应一条记录，所以**更新节点的操作就是更新数据库表中的对应记录。**

原则上，您可以直接使用您最熟悉的数据库操作方式（比如`prisma`,`typeORM`等）来更新节点，但是需要特别需要注意以下几点：

- **不能直接更新`leftValue`、`rightValue`、`level`、`treeId`等树依赖的关健字段**，因为这些字段是根据树的结构自动生成的，**直接更新将导致树结构被破坏**。
- 由于`FlexTree`的节点是可以扩展的，除了树的关键字段外，您可以自定义其他字段，这些字段是可以直接更新的。


:::warning 特殊注意
不能直接更新`leftValue`、`rightValue`、`level`、`treeId`等树依赖的关健字段
:::

## update

为了方便您的操作，我们提供了一个简单的`update`方法，只能用于更新非关键字段。

```ts
async update(node: Partial<TreeNode> | Partial<TreeNode>[]): Promise<void>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `node` | Partial\<TreeNode\> \| Partial\<TreeNode\>[] | 无 | 要更新的节点或节点数组 |

- **返回**

| 类型 | 描述 |
| --- | --- |
| `Promise\<void\>` | 无 |

- **示例**

```ts
const node = await tree.update({
    id: 1,
    name: 'new name',
    description: 'new description'
});
```

- **说明**

    - 当您使用`update`方法时，会过滤掉`leftValue`、`rightValue`、`level`、`treeId`等关键字段，以避免意外破坏树结构。
    - 由于`update`方法不会涉及到对树的结构更新，所以可以不用在`write`方法中执行。


