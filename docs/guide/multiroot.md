# 多根树

有些场景下，一张表需要存储**多个顶层节点**（多棵"平行"的树），例如：文件系统的多个根目录、消息中心的多个话题、看板的多个列表。`MultiRootFlexTreeManager` 就是为此而生的多根树管理器。

## 多根树 vs 多树表

`FlexTree` 提供了两种"多个顶层节点"的方案，适用场景不同：

| | 多根树 `MultiRootFlexTreeManager` | 多树表 `FlexTreeManager` + `treeId` |
| --- | --- | --- |
| 表结构 | 普通单树表，无需 `treeId` 字段 | 需要 `treeId` 字段区分树 |
| 根节点关系 | 根之间是**兄弟**，可导航、可排序 | 各树完全独立，互不感知 |
| 跨"树"操作 | 就是普通的移动/复制，天然支持 | 需要显式指定 `treeId` 做跨树移动 |
| 管理器数量 | 一个管理器管理全部根 | 每个 `treeId` 一个管理器实例 |
| 适用场景 | 一组平级的顶层节点（目录列表、话题列表） | 相互隔离的独立树（每个用户一棵树） |

:::tip 如何选择
如果"多个顶层节点"在业务上是**一组并列的数据**（像同一个列表的多个条目），用多根树；
如果每棵树属于**不同的主体**（不同用户、不同租户各自一棵树），用[多树表](./multitree)。
:::

## 实现原理

多根树基于`隐藏根`模式实现：

```
物理层（表里是一棵普通单根树）         用户视角（多根树）
┌──────────────────────────┐
│ __root__  L=1  R=12      │ ← 隐藏根（自动创建，对外不可见）
│  ├─ A     L=2  R=5       │        ├─ A          (level 0)
│  ├─ B     L=6  R=11      │        ├─ B          (level 0)
│  │   └─ C L=7  R=10      │        │   └─ C      (level 1)
└──────────────────────────┘
```

- 内部持有一个普通的单树 `FlexTreeManager`，自动创建并维护一个**隐藏根节点**（`level=0`、`leftValue=1`、名称默认 `__root__`）。
- 用户看到的"多根"即隐藏根的子节点，因此根之间的兄弟导航、跨根移动/复制，全部是普通的单树操作，`FlexTreeManager` 的全部能力原样保留。
- 对外所有读取的 `level` 已**归一化**：用户根显示为 `level=0`，其子节点为 `level=1`，依此类推。

## 创建多根树管理器

与 `FlexTreeManager` 一样，支持普通模式与单例模式：

```ts
import { MultiRootFlexTreeManager } from "flextree";
import sqliteAdapter from "flextree-sqlite-adapter";

// 普通模式
const tree = new MultiRootFlexTreeManager("filesys", {
    adapter: new sqliteAdapter(),
});

// 单例模式（推荐）
const tree = MultiRootFlexTreeManager.getInstance("filesys", {
    adapter: new sqliteAdapter(),
});
```

**构造器参数：**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `tableName` | string | 无 | 必须的，数据库表名称 |
| `options.adapter` | IFlexTreeAdapter | 无 | 必须的，访问数据库的适配器 |
| `options.hiddenRootName` | string | `"__root__"` | 可选的，隐藏根节点名称 |
| `options.fields` | object | 默认字段名 | 可选的，自定义关键字段名称（同 `FlexTreeManager`） |

:::warning 注意
多根树基于单树表实现，**不能传入 `treeId`**（传入会抛出异常）。表结构就是普通的树表，不需要 `treeId` 字段参与。
:::

泛型参数与 `FlexTreeManager` 完全一致（`Fields`/`KeyFields`），支持自定义字段与自定义关键字段名称。

## 初始化

构造函数不做任何数据库访问，创建后需要调用 `load()` 完成初始化：

```ts
const tree = MultiRootFlexTreeManager.getInstance("filesys", { adapter });

await tree.load(); // 检查/创建隐藏根，加载根节点列表
```

`load()` 的行为：

- **自动创建隐藏根**：空表（或表中被外部清空）时自动创建隐藏根节点。
- **自愈**：隐藏根被外部 SQL 误删后，下次调用 `load()` 会自动重建。
- **幂等**：重复调用安全，仅刷新根节点列表缓存。

## nodes：根节点列表

多根树没有唯一的 `root`，取而代之的是同步属性 `nodes`，返回所有用户根节点：

```ts
tree.nodes  // TreeNode[]，level 已归一化（根=0）
```

- 每次 `write` 完成后自动刷新，无需手动更新。
- 增加根、删除根、节点移入/移出根层级后，`nodes` 立即反映最新状态。

## 增加根与节点

### 增加根

`addNodes` 不指定 `at` 参数（或传 `null`）时，节点会挂到顶层，成为**新的根节点**：

```ts
await tree.write(async () => {
    // 增加一个根节点
    await tree.addNodes([{ name: "Documents" }]);
    await tree.addNodes([{ name: "Pictures" }]);

    tree.nodes.length; // 2
});
```

也支持一次传入嵌套结构，直接创建带子树的根：

```ts
await tree.write(async () => {
    await tree.addNodes([
        {
            name: "Music",
            children: [
                { name: "Rock" },
                { name: "Jazz" },
            ],
        },
    ]);
});
```

### 增加子节点

指定 `at` 后与 `FlexTreeManager` 完全一致：

```ts
await tree.write(async () => {
    await tree.addNodes([{ name: "resume.doc" }], documentsId);
});
```

## 查询节点

查询 API 与 `FlexTreeManager` 一致，差异仅有两点：**不返回隐藏根**、**level 已归一化**。

```ts
// 所有用户节点（不含隐藏根）
const nodes = await tree.getNodes();

// level 语义按用户视角：1=只返回根节点，2=根+子节点
const roots = await tree.getNodes({ level: 1 });

// 根之间的兄弟导航（物理上它们本来就是兄弟）
const next = await tree.getNextSibling(documentsId);     // Pictures
const siblings = await tree.getSiblings(documentsId);    // 其余所有根

// 根的父节点：用户根没有父节点，抛 FlexTreeNodeNotFoundError
const parent = await tree.getParent(documentsId);        // 抛异常

// 根的后代
const files = await tree.getDescendants(documentsId);
```

- `getParent(根)` 抛出 `FlexTreeNodeNotFoundError`（根没有父节点）。
- `getAncestors(根)` 返回空数组，`getAncestorsCount(根)` 返回 `0`。
- `findNodes({ level: 0 })` 等条件中的 `level` 同样按用户视角换算。
- `getNodes({ where })` 中的 `where` 是原始 SQL，其中的 `level` 为**物理值**（比用户视角大 1）。

## 移动与复制

跨根移动/复制就是普通的同树操作，无需任何特殊参数：

```ts
await tree.write(async () => {
    // 把 Documents 下的一个子目录移到 Pictures 下（跨根移动）
    await tree.moveNode(resumeId, picturesId, FlexNodeRelPosition.LastChild);

    // 把一个根移到另一个根下面（该根变成普通子节点）
    await tree.moveNode(musicId, documentsId, FlexNodeRelPosition.LastChild);

    // 把某个节点移到某根的旁边（升级为新的根）
    await tree.moveNode(rockId, documentsId, FlexNodeRelPosition.NextSibling);

    // 复制整个根（副本成为新根）
    const copy = await tree.copyNode(documentsId, {
        to: picturesId,
        pos: FlexNodeRelPosition.NextSibling,
    });
});
```

- `moveUpNode`/`moveDownNode` 对根同样有效：根在其兄弟序列中上移/下移。第一个根再上移、最后一个根再下移会抛出 `FlexTreeNodeInvalidOperationError`。

## 删除与清空

```ts
await tree.write(async () => {
    // 删除一个根（连同其全部后代），其余根的坐标自动回缩
    await tree.deleteNode(documentsId);

    // 清空所有用户节点（隐藏根自动重建，之后可继续添加新根）
    await tree.clear();
});
```

- 隐藏根不可删除：`deleteNode` 命中隐藏根时抛出 `FlexTreeNodeInvalidOperationError`（正常使用时不会接触到隐藏根）。
- `clear()` 只清除用户节点，清空后树仍可继续使用。

## 校验与修复

与 `FlexTreeManager` 一致，直接透传：

```ts
await tree.verify(); // 校验树结构完整性（隐藏根满足全部校验规则）
await tree.repair(); // 修复被破坏的树结构，修复后自动刷新 nodes
```

## 导出

`toJson` 返回**多根嵌套数组**（而不是单个根对象）：

```ts
const json = await tree.toJson();
// [
//   { id: 2, name: "Documents", children: [{ id: 4, name: "resume.doc" }] },
//   { id: 3, name: "Pictures", children: [...] },
// ]

const list = await tree.toList();
// [
//   { id: 2, name: "Documents", pid: 0 },
//   { id: 4, name: "resume.doc", pid: 2 },
//   ...
// ]
```

- `toJson` 的所有选项（`childrenField`/`level`/`fields`/`includeKeyFields`）与 `FlexTreeManager` 一致，`level` 值已归一化。
- `toList` 中用户根的 `pid` 为 `0`，不会泄漏隐藏根的 id。

## 事件

事件机制与 `FlexTreeManager` 一致，所有 `node:*` 事件均会触发，订阅方式相同：

```ts
tree.on("node:added", ({ nodes }) => {
    console.log(`新增了 ${nodes.length} 个节点`);
});
```

## API 差异一览

相对 `FlexTreeManager`，`MultiRootFlexTreeManager` 的 API 差异仅有：

| 差异 | 说明 |
| --- | --- |
| 无 `getRoot` / `hasRoot` / `createRoot` | 多根语义下无唯一根，新根通过 `addNodes`（不指定 `at`）创建 |
| 新增 `nodes` | 同步返回用户根节点列表，`write` 后自动刷新 |
| `toJson` 返回数组 | 多根嵌套数组，而不是单个根对象 |
| `getParent(根)` 抛异常 | 用户根没有父节点 |
| `level` 归一化 | 所有读取的 level 按用户视角（根=0） |

其余全部方法（`addNodes`/`deleteNode`/`moveNode`/`copyNode`/`update`/`findNode`/`getDescendants`/`forEach`/`verify`/`repair` 等）签名与语义完全一致，可参照[树管理器](./manager)及各指南章节使用。
