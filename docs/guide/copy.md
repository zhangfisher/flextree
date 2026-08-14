# 复制节点

:::warning 提示
 复制节点是一个数据写操作，需要在`write`方法中执行。
:::

通过`copyNode`方法可以复制一个节点（默认连同其所有后代）到指定位置。复制产生的新子树与源子树**除 id 外完全相同**，`level`、`leftValue`、`rightValue`、`treeId` 等位置属性按落点重新计算。

```ts
async copyNode(
    nodeId: NodeId,
    options?: {
        includeDescendants?: boolean    // 是否包含后代节点，默认 true
        to?: NodeId                     // 落点参照节点，默认源节点自身
        pos?: FlexNodeRelPosition       // 相对位置，默认 NextSibling
        treeId?: TreeId                 // 目标树 id，跨树复制时提供
        fields?: string[]               // 指定复制的字段列表，默认全部
        transformField?: Record<string,string>  // 字段变换表
    }
): Promise<TreeNode>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | `NodeId` | 无 | 要复制的源节点 id |
| `options.includeDescendants` | `boolean` | `true` | 是否连同后代节点一起复制；`false` 时仅复制节点本身（副本为叶子节点） |
| `options.to` | `NodeId` | 源节点自身 | 落点参照节点，副本以 `pos` 描述的相对关系落在其旁 |
| `options.pos` | `FlexNodeRelPosition` | `NextSibling` | 副本与落点参照节点的相对位置 |
| `options.treeId` | `TreeId` | 当前树 | 目标树 id；提供且不等于当前树的 treeId 时为跨树复制，此时 `to` 指向目标树中的节点 id |
| `options.fields` | `string[]` | 全部字段 | 指定复制时携带的字段名列表；`[]`（空数组）表示仅复制关键字段；关键字段（id/treeId/name/level/leftValue/rightValue）恒包含，不受此参数控制 |
| `options.transformField` | `Record<string,string>` | 无 | 字段变换表 `{ 字段名: SQL表达式 }`，作用于子树所有节点；树结构基础字段（treeId/leftValue/rightValue/level）不允许变换 |

- **返回值**：副本根节点（`TreeNode`）。

## 使用示例

```ts
import { FlexTreeManager, FlexNodeRelPosition } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{ 
    // 复制节点 A（含所有后代）到节点 B 之后
    const copyRoot = await tree.copyNode(aId, { 
        to: bId, 
        pos: FlexNodeRelPosition.NextSibling 
    })

    // 默认：复制为源节点的下一个兄弟
    const copyRoot2 = await tree.copyNode(aId)

    // 仅复制节点本身，副本为叶子节点
    const leafCopy = await tree.copyNode(aId, { includeDescendants: false })

    // 复制为源节点自己的最后一个子节点
    const childCopy = await tree.copyNode(aId, { pos: FlexNodeRelPosition.LastChild })

    // 跨树复制：复制到 treeId=2 的树中，to 是该树中的节点 id
    const crossCopy = await tree.copyNode(aId, { 
        treeId: 2, 
        to: bIdInTree2, 
        pos: FlexNodeRelPosition.LastChild 
    })
})
```

## 落点规则

- `to` 缺省时等价于源节点自身，`pos` 原样生效。例如 `pos: LastChild` 且 `to` 缺省时，副本成为源节点的最后一个子节点。
- 落点不能是源节点的**后代节点**（自引用复制），否则抛出异常。
- 落点为根节点时，`pos` 不能是 `NextSibling`/`PreviousSibling`（根节点没有兄弟），否则抛出异常。
- 支持**跨树复制**（单表多树场景），有两种方式：
  - 在目标树的 manager 上调用，`nodeId` 传入其他树的源节点 id（源按 id 全表定位）；
  - 在源树的 manager 上调用，通过 `treeId` 参数指定目标树，此时 `to` 指向目标树中的节点 id。
  - 两种方式下副本的 `treeId` 均采用落点所在树的 `treeId`。

## 选择性复制字段

表中可能存在**不重要**的字段（复制没有意义）或**有唯一约束**的字段（复制会导致冲突）。通过`fields`可以只复制指定的字段，未指定的自定义字段将被忽略（副本中为空值）：

```ts
await tree.write(async ()=>{ 
    // 只复制 title 字段，其余自定义字段（如 size、url、hashCode 等）不复制
    const copyRoot = await tree.copyNode(aId, { fields: ["title"] })

    // 空数组：仅复制关键字段（id/treeId/name/level/leftValue/rightValue）
    const bareCopy = await tree.copyNode(aId, { fields: [] })
})
```

:::tip 说明
 无论`fields`指定了什么，树的关键字段（id/treeId/name/level/leftValue/rightValue）始终会被正确复制——它们是树结构的基础，不受筛选控制。
:::

## 字段变换（transformField）

复制时可以通过`transformField`提供一个`{ 字段名: SQL表达式 }`映射，对副本中**任意字段**的值进行变换，表达式中可引用原列、按自己的数据库方言书写，作用于子树**所有节点**；未提供变换的字段原样照抄。

```ts
await tree.write(async ()=>{ 
    // 为副本 name 加后缀（SQLite / PostgreSQL）
    const copyRoot = await tree.copyNode(aId, { 
        transformField: { name: "name || '-copy'" } 
    })

    // MySQL 写法
    const copyRoot2 = await tree.copyNode(aId, { 
        transformField: { name: "CONCAT(name,'-copy')" } 
    })

    // 同时变换多个字段：id、name、自定义字段 size
    const copyRoot3 = await tree.copyNode(aId, { 
        transformField: { 
            id: "hex(randomblob(16))", 
            name: "name || '-copy'",
            size: "size * 2" 
        } 
    })
})
```

典型场景：

- **非自增主键**：id 由数据库自增生成时无需任何参数；主键不是自增的（如 uuid），提供 id 的变换表达式即可（见上方示例）
- **区分副本**：为 name 拼接后缀，避免同父同名难以分辨
- **调整副本数据**：对数值字段做运算（如计数清零 `count: "0"`）、为有唯一约束的字段生成新值（如 `slug: "slug || '-' || hex(randomblob(4))"`）

:::danger 注意
 `transformField` 中的表达式会被**原样拼接**进 `INSERT ... SELECT` 语句中执行。请勿将不可信的外部输入传入该参数，注入安全由调用方负责。
:::

:::tip 说明
 树结构基础字段（`treeId`/`leftValue`/`rightValue`/`level`）由算法按落点自动计算，**不允许**变换——即使出现在`transformField`中也会被忽略。
:::

## 性能

`copyNode` 整个操作在一个事务内以**固定条数的集合 SQL** 完成，数据库访问次数**与后代节点数量无关**——即使源节点有上万个后代，后代数据也不会被读取到应用层：

1. 一条 `INSERT ... SELECT` 将源子树以负值左右值快照为暂存副本
2. 两条 `UPDATE` 为落点腾出空间
3. 一条 `UPDATE` 将暂存副本镜像翻正到最终位置

最后按副本根的新 `leftValue` 反查返回副本根节点。

## 事件

复制完成后触发`node:added`事件，`nodes` 为 `[副本根节点]`。如需获取全部新节点，可在事件回调中通过`getDescendants(copyRoot.id)`查询。
