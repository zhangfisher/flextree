# 校验树

`FlexTree`是基于左右值算法的树结构，其**树结构的完整性严格依赖于数据库中每一个节点的`leftValue`和`rightValue`值的正确性**。

但是如果因为一些异常错误操作导致了树结构的`leftValue`和`rightValue`值不正确，那么将导致树结构被破坏。

`FlexTreeManager`提供了`verify`校验方法来检查树结构的完整性。

```ts
import type { FlexTreeOptions, IFlexTreeNode } from 'flextree'
import { FlexTreeManager,FlexTree, FlexTreeVerifyError } from 'flextree'

import SqliteAdapter from 'flextree-sqlite-adapter' 
const sqliteDriver = new SqliteAdapter()
await sqliteDriver.open()

const tree = new FlexTree('tree', {
    adapter: sqliteDriver,
})
await tree.load()
 // 校验树结构是否正确
tree.verify() // true/false     // [!code ++]
 
```


- **说明**

    - `verify`方法会检查树结构的完整性，如果树结构完整则返回`true`，否则返回`false`。
    - 如果树结构不完整，将抛出`FlexTreeVerifyError`异常，异常中包含了校验失败的节点信息。
    - `verify`方法不会对树结构进行修复，只是检查树结构的完整性。
- **校验机制**

    `verify`基于纯`SQL`实现校验，无需将所有节点加载到内存，适合大规模树的校验。其内部依次执行以下检查，任一不通过即抛出`FlexTreeVerifyError`：

| 检查项 | 说明 |
| --- | --- |
| 节点总数 | 根节点`rightValue / 2`应等于树的实际节点总数 |
| 值完整性 | 所有`leftValue`/`rightValue`的并集恰好为`{1, 2, ..., 2n}`，无缺失值 |
| 基本关系 | 每个节点的`rightValue`必须大于`leftValue` |
| 唯一性 | `leftValue`与`rightValue`各自不出现重复值 |
| 层级关系 | 根节点`level`为`0`，且任意父子节点的`level`差值必须为`1` |

:::tip 提示
如果`verify`校验失败，说明树结构已被破坏，可以使用[修复](./repair.md)功能重建树结构。
:::

    