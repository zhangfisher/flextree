# 回收站

删除节点时直接物理删除往往太"果断"——用户误删、业务需要可撤销的删除时，你需要**回收站**。FlexTree 的回收站提供**逻辑删除**能力：删除的子树连同内部结构一起被移入回收站，需要时可恢复，不需要时可清空。

## 概述

回收站功能由 `recyclebin` 配置启用，核心概念只有一个——**Bin 节点**：

```
物理层（表里 bin 是根的一个子节点）        用户视角（默认）
┌────────────────────────────┐
│ R        L=1  R=12         │            R
│  ├─ A    L=2  R=3          │            ├─ A
│  ├─ B    L=4  R=5          │            └─ B
│  └─ bin  L=6  R=11         │  ← bin 及其后代"逻辑不存在"
│      ├─ D  L=7  R=8        │     （已被逻辑删除的 D、E）
│      └─ E  L=9  R=10       │
└────────────────────────────┘
```

- 回收站是根节点下的一个**特殊位置的普通节点**（恒为根的子节点），由你配置其 `id` 与 `name`。
- `deleteNode(node, { recycle: true })` 时，节点及其后代（保持内部结构）通过 `moveNode` 移入 bin 下——**逻辑删除**。
- **默认视角下，bin 及其后代表现为不存在**：查询查不到、查找找不到、遍历不进入、导出不含、更新/移动/删除抛 NotFound。
- 需要展示或操作回收站内容时（如文件管理器的"回收站"页面），传 `includeRecyclebin: true`——此时 bin 及其后代就是普通节点，一切操作照常。

:::tip 一条原则
被放进回收站的节点，在**逻辑上已被删除**。`includeRecyclebin=false`（默认）时它们与不存在的节点毫无区别；`=true` 时它们与普通节点毫无区别。没有中间态。
:::

## 启用回收站

在管理器配置中提供 `recyclebin` 即启用，不提供即完全关闭（零开销，表里也不会有多余节点）：

```ts
import { FlexTreeManager } from "flextree";
import sqliteAdapter from "flextree-sqlite-adapter";

const tree = new FlexTreeManager("files", {
    adapter: new sqliteAdapter(),
    recyclebin: {
        id: 9999,          // 回收站节点的 id
        name: "__trash__", // 回收站节点的名称
    },
});
```

**配置项：**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `options.recyclebin` | object | 无 | 提供即启用回收站功能 |
| `options.recyclebin.id` | NodeId \| `(treeId) => NodeId` | 无 | 回收站节点 id；多树表下可传函数按树取值 |
| `options.recyclebin.name` | string | 无 | 回收站节点名称 |

**Bin 节点的生命周期：**

- **懒创建**：启用后首次 `write()` 时自动创建（挂到根的最后一个子节点位置），与业务写在同一事务中。
- **位置校验**：若表中已存在同 id 的行但不在根孩子层（level≠1），首次 `write()` 抛出配置错误——回收站必须位于根下，这是位置不变量。
- 未启用时 `recycle` 参数被忽略，`clearRecycleBin()` 静默返回。

:::warning 位置不变量
Bin 恒为根节点的子节点：可以在根的孩子中重排位置，但不允许移动到树的其他层级，也不允许作为跨树移动的源。这是为了杜绝"把子树回收到自己的后代里"的自包含悖论，以及回收内容随业务子树删除而意外丢失。
:::

## 逻辑删除

```ts
await tree.write(async () => {
    // 逻辑删除：A 及其全部后代（保持结构）移入回收站
    await tree.deleteNode(aId, { recycle: true });
});
```

删除后：

```ts
await tree.findNode({ name: "A" });          // null —— 默认视角查不到
await tree.getNode(aId);                     // 抛 NotFound
await tree.getNodes();                       // 不含 A，也不含 bin
await tree.verify();                         // true —— 树结构依然完整
```

**注意：**

- `recycle: true` **仅在启用回收站后生效**；未启用时等同物理删除。
- 回收站内不允许"二次回收"：默认视角下站内节点删不到（NotFound）；`includeRecyclebin: true` 进入回收站视角后删除，即**物理删除**（`recycle` 参数无效）。
- 回收的是**整个子树**：后代连同层级结构一并进站。

## 回收站视角

所有公共 API 均支持 `includeRecyclebin` 选项（默认 `false`）：

- `false`（默认）：被逻辑删除的节点**视为不存在**——查询查不到、按 id 读取/写入抛 `NotFound`、遍历不进入、导出不含。业务侧的常规读写完全感知不到回收站的存在。
- `true`：进入回收站视角，**回收站（bin 节点）及其内部的所有节点均可以像普通节点一样进行一切操作**——查询、修改、移动、复制、删除照常。**当需要管理回收站本身时——列出回收站列表（渲染"回收站页面"）、读取站内节点用于恢复、从站内彻底删除、站内重排——就需要此参数**；默认视角下站内节点不可见，不进入回收站视角就找不到操作目标。

```ts
// 查询：含回收站内容
await tree.getNodes({ includeRecyclebin: true });
await tree.getNode(aId, { includeRecyclebin: true });
await tree.findNodes({ name: "A" }, { includeRecyclebin: true });

// 遍历：进入回收站子树
await tree.forEach(callback, { includeRecyclebin: true });

// 导出：完整物理树
await tree.toJson({ includeRecyclebin: true });

// 写操作：站内改名、移动（站内重排）、删除（物理）
await tree.update({ id: aId, title: "已删除" }, { includeRecyclebin: true });
await tree.deleteNode(aId, { includeRecyclebin: true });
```

**覆盖面：**

- **枚举/查找**（`getNodes`/`findNode`/`findNodes`/`getDescendants`/`getChildren`/`getSiblings`/`getDescendantCount`/`getNthChild`）：SQL 端排除 bin 区间（数据库端过滤，非拉回内存再过滤）
- **精确查找**（`getNode`）：默认抛 NotFound
- **导航**（`getNextSibling`/`getPreviousSibling`）：默认跳过 bin 子树，返回下一个逻辑存在的节点
- **写操作**（`deleteNode`/`moveNode`/`copyNode`/`addNodes`/`update`）：id 路径默认 NotFound；对象路径按"对象即凭证"放行
- **遍历/导出**（`forEach`/`toJson`/`toList`）：默认不进入/不含回收站
- **后代数量（`countField`）**：默认视角为**可见口径**——数量不含已被回收的节点（与导出内容一致，由数据库在 SELECT 表达式中直接计算并扣减）；`includeRecyclebin: true` 时为物理全集数量（见[导出](./export#countfield-后代数量)）
- **内部机制**（`verify`/`repair`/`clear`）：不受影响（bin 是普通树成员，参与校验与修复）

:::tip 对象即凭证
默认视角下所有读接口都不会返回站内节点对象——**能拿到对象引用，必然已经 `includeRecyclebin: true` 读取过**。因此向写 API 传节点对象（而非 id）时不重复校验，照常执行。
:::

## 恢复节点

恢复 = 站内视角读出 + moveNode 移出。没有专用 API，因为两者都是普通节点：

```ts
await tree.write(async () => {
    // 1. 站内视角取出节点
    const node = await tree.getNode(recycledId, { includeRecyclebin: true });
    // 2. 移到目标位置（此处：B 的下一个兄弟）
    await tree.moveNode(node, bId, {
        pos: FlexNodeRelPosition.NextSibling,
        includeRecyclebin: true,
    });
});
// 默认视角重新可见
await tree.findNode({ name: "A" }); // ✅
```

节点进站时 `level` 会按 bin 下的新位置重新编号（照实存储），移出后按落点重新计算——无需关心中间值。

## 清空回收站

```ts
await tree.write(async () => {
    // 删除 bin 下所有子孙，bin 自身保留
    await tree.clearRecycleBin();
});
```

`deleteNode(bin)` 与 `clearRecycleBin()` 等效。两者均为管理动作：不受 `includeRecyclebin` 门控、不发出事件。未启用回收站时静默返回。

## 事件

回收相关的两个事件遵循**状态跃迁规则**——`node:deleted`（带 `recycled: true` 标识）仅在节点发生"站外→站内"跃迁时发出：

```ts
tree.on("node:deleted", ({ node, recycled }) => {
    if (recycled) {
        console.log("节点进入回收站（逻辑删除）", node);
    } else {
        console.log("节点被物理删除", node);
    }
});
tree.on("node:recycled", ({ node }) => {
    console.log("deleteNode(recycle) 专用事件", node);
});
```

| 操作 | 事件 |
| --- | --- |
| `deleteNode(x, { recycle: true })` | `node:deleted`(recycled) + `node:recycled` |
| `moveNode(x, bin, { includeRecyclebin: true })` 手动进站 | `node:deleted`(recycled) + `node:moved` |
| 站内重排（`includeRecyclebin: true`） | 仅 `node:moved`（无 deleted——节点未发生逻辑删除跃迁） |
| 恢复移出 | 仅 `node:moved` |
| 站内物理删除 | 仅 `node:deleted`（不带 recycled） |
| `clearRecycleBin()` | 无事件 |

## 多树表

单表多树（`treeId`）下，每棵树需要自己的 bin——不同树的节点不能共用一个物理 bin 节点。`id` 支持函数形式，按树取值：

```ts
const tree = new FlexTreeManager("files", {
    adapter,
    treeId: 1,
    recyclebin: {
        id: (treeId: number) => treeId * 1000 + 999, // tree1→1999, tree2→2999 ...
        name: "__trash__",
    },
});
```

各树的 bin 相互独立：A 树的回收不影响 B 树的任何读接口。

## 多根树

`MultiRootFlexTreeManager` 原样支持 `recyclebin` 配置（透传给内部单树管理器）：bin 是隐藏根的子节点（用户视角 `level=0` 的一个"根"），`nodes` 列表与 `toJson` 默认都不含它：

```ts
const tree = new MultiRootFlexTreeManager("files", {
    adapter,
    recyclebin: { id: 999, name: "__trash__" },
});
```

## 实现原理速览

- **逻辑删除 = moveNode 进站**：完全复用移动算法，结构保持、事务原子。
- **逻辑不存在 = SQL 端区间过滤**：所有读路径追加 `NOT (left >= binLeft AND right <= binRight)` 闭区间条件，行数在数据库端就已正确——bin 里堆一万个节点，默认视角的查询开销不变。bin 区间有内存缓存，写事务提交后失效。
- **bin 是普通节点**：verify/repair 把它当普通成员校验与重建；应用层永远可以 `includeRecyclebin: true` 把它当普通子树操作。
