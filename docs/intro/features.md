# 功能优势

`FlexTree`在`左右值`算法的基础上，提供了一套完整、易用、类型安全的树存储管理能力。其主要优势体现在以下几个方面。

## 简洁的 API

`FlexTree`提供了语义化的方法命名，几乎覆盖所有常见的树操作，且无需手写`SQL`：

```ts
// 查询
await tree.getChildren(node)
await tree.getDescendants(node, { level: 2, includeSelf: true })
await tree.getAncestors(node)
await tree.getParent(node)
await tree.getSiblings(node)

// 更新（需在 write 中执行）
await tree.addNodes([...], { at: node })
await tree.moveNode(source, target, LastChild)
await tree.deleteNode(node)
```

同时，`FlexTree`基于`TypeScript`开发，提供完整的泛型支持——自定义字段、自定义关键字段名均能获得精准的类型提示。

## 高效的树查询

得益于`左右值`算法，`FlexTree`的所有关系查询（后代、祖先、子节点、兄弟、父节点等）均可在**单条`SQL`**内完成，无需递归查询。树的层级越深，相比邻接列表的优势越明显。查询时还支持限定层级（`level`）、是否包含自身（`includeSelf`）等细粒度选项。

## 完整的树操作

围绕树的生命周期，`FlexTree`提供了完整的操作能力：

- **添加**：`createRoot`创建根节点；`addNodes`支持在`最后子节点`、`第一个子节点`、`上一个兄弟`、`下一个兄弟`四种位置插入，并支持以嵌套`children`结构一次性添加整棵子树。
- **删除**：`deleteNode`删除节点及其整个子树；`clear`清空整棵树。
- **移动**：`moveNode`支持四种相对位置移动，另提供`moveUpNode`/`moveDownNode`实现节点上移/下移。
- **更新**：`update`修改节点业务字段。
- **查找**：`findNode`/`findNodes`按条件检索节点。

## 数据安全保障

`FlexTree`从多个层面保障树操作的数据安全：

- **事务化写入**：`write`内的所有操作被包裹在同一个数据库事务中，任一步失败整体回滚，杜绝半成品树结构。
- **并发脏读防护**：写操作进行时，外部的并发读取会自动等待写完成，避免读到左右值的中间态。
- **完整性与修复**：`verify`基于纯`SQL`校验树结构是否被破坏；`repair`可重建被破坏的左右值与层级。

## 多数据库与可扩展

`FlexTree`通过适配器模式解耦了树逻辑与数据库访问：

- 内置`SQLite`、`Prisma`、`Bun SQLite`三种适配器，覆盖常见场景。
- 内置多数据库`SQL`转义器，支持`SQLite`、`MySQL`、`PostgreSQL`、`Oracle`、`SQL Server`等方言的差异化生成。
- 只需实现`IFlexTreeAdapter`接口，即可接入任意其他数据库。

## 灵活的定制能力

- **自定义字段**：可自定义`id`、`name`、`leftValue`、`rightValue`、`level`、`treeId`等关键字段的名称与类型，适配已有表结构。
- **单表多树**：通过`treeId`在一张表中存储多棵独立的树，`treeId`支持数字或字符串。
- **单例管理**：`FlexTreeManager.getInstance`基于表名复用实例，避免重复创建。

## 遍历与导出

- **遍历**：`forEach`支持`深度优先（DFS）`与`广度优先（BFS）`两种模式，可中断、可限制层级。
- **导出**：`toJson`/`toList`可将树导出为嵌套`JSON`或带`pid`的扁平列表。
- **后代数量**：所有查询与导出方法均支持`countField`参数，由数据库在`SQL`中直接计算并附加每个节点的后代数量字段（回收站场景下为可见口径）。
- **内存树**：`FlexTree`对象将树加载到内存，提供`getByPath`路径访问、懒加载等更丰富的`API`。

## 事件机制

`FlexTreeManager`内置事件机制，除写操作前后的`write:before`/`write:after`外，还提供`node:added`、`node:deleted`、`node:moved`、`node:updated`、`node:cleared`等节点级事件，便于业务侧感知树的变更；事务提交前还有`write:commit`事件，聚合呈现本次`write`的全部`SQL`。

## 局限性

`FlexTree`的优势源于`左右值`算法，其局限性同样源于此。选型时应结合实际场景权衡：

- **写操作成本较高**：任何节点的添加、删除、移动都需要重排相关节点的左右值，可能影响`1-N`行记录。`FlexTree`是**查询优先**的存储结构，最适合**读多写少**的场景；若业务以频繁的结构变更为主，邻接列表可能更合适。
- **不支持并发写**：基于左右值的树严格依赖值的一致性，同一棵树的并发写会被拒绝（抛出异常）。读操作虽然可以并发，但同一时刻只能有一个写操作。
- **对直接修改数据库敏感**：任何绕过`FlexTree`、直接以`SQL`修改树表的操作（尤其是改动`leftValue`/`rightValue`/`level`）都可能破坏树结构。此类情况可借助`verify`检测、`repair`修复。
- **整型左右值的理论上限**：左右值为整数，超大规模的树（例如单棵树节点数接近整型上限）可能触及取值范围限制，实际业务中极少遇到。
- **跨树移动开销**：在单表多树场景下，将子树从一棵树移动到另一棵树，涉及跨树的左右值重排，开销高于树内移动。

:::tip 选型建议
如果你的场景是**组织架构、分类目录、菜单、评论嵌套等读多写少的树形数据**，`FlexTree`的查询性能与开发效率优势明显；如果是**高频写入、频繁结构调整**的场景，建议充分评估写性能后再做选择。
:::
