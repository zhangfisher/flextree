# 修复树

`FlexTree` 基于`左右值算法`，树结构的完整性严格依赖每一个节点的`leftValue`和`rightValue`的正确性。

由于直接操作数据表、写操作异常中断或其他外部原因，可能导致节点的左右值或层级被破坏。此时正常的查询、遍历等操作会返回错误的结果。

`FlexTreeManager` 提供了`repair`方法用于修复被破坏的树结构；此外`flextree`还导出了纯函数`repairTree`，可脱离数据库直接对节点数组进行修复。

:::warning 提示
`repair`是一个写操作，其内部会自动在`write`与数据库事务中执行，因此**无需手动包裹在`write`中**。
:::

## 修复整棵树

调用`manager.repair()`即可修复当前管理器所管理的树。

```ts
import { FlexTreeManager } from 'flextree'
import SqliteAdapter from 'flextree-sqlite-adapter'

const tree = new FlexTreeManager('tree', {
    adapter: new SqliteAdapter(),
})

await tree.repair()
```

- **说明**

    - `repair`会直接读取表中所有节点的`id`、`level`、`leftValue`、`rightValue`（由于树可能已被破坏，不能依赖正常的查询方法），重建结构后**仅将发生变化的节点写回数据库**。
    - 在单表多树场景下，读取与更新都会自动限定在当前`treeId`范围内，不会跨树影响。

## 修复算法

`repair`基于节点的`level`（层级）信息重建树结构，核心步骤如下：

1. 按`leftValue`排序，保留节点原有的先后顺序；
2. 借助栈、基于`level`判断父子关系，重新分配**连续**的`leftValue`/`rightValue`，确保所有值落在`1..2N`区间内且完整无缺口；
3. 规范化`level`：根节点为`0`，每层递增`1`，自动修复跳级（如`0 → 3 → 7`会被规范为`0 → 1 → 2`）；
4. 修复后自动进行完整性校验，校验失败会**抛出异常**而非返回错误数据。

例如，一棵左右值被破坏的树：

<LiteTree>
Root
    A
        A1
        A2
    B
</LiteTree>

执行`repair`后，所有节点的`leftValue`/`rightValue`会被重新分配为连续且正确的值，层级也会被规范化。

## repairTree 纯函数

如果已经持有节点数组（例如来自其他数据源或备份），可以使用导出的`repairTree`纯函数直接修复，无需经过数据库。

```ts
import { repairTree } from 'flextree'

const repaired = repairTree(nodes, {
    keyFields: { /* 自定义字段名，可选 */ },
    treeId: 1, // 多树表时注入 treeId，可选
})
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodes` | `Record<string, any>[]` | 无 | 待修复的节点数组（不会被修改） |
| `options.keyFields` | `CustomTreeKeyFields` | 默认字段 | 自定义关键字段名 |
| `options.treeId` | `any` | 无 | 多树表时注入到结果节点的`treeId` |

- **说明**

    - `repairTree`是纯函数，**不会修改入参**`nodes`，返回修复并按`leftValue`排序后的新节点数组。
    - 值发生变化的节点会附带`_level`/`_leftValue`/`_rightValue`元数据，记录修复前的原值，便于对比。

:::tip 提示
修复前可以使用[校验](./verify.md)方法检测树结构是否被破坏，修复后可再次校验以确认完整性。
:::
