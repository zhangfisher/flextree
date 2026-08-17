# MultiRootFlexTree

## 功能概述

[FlexTree](./flextree.md) 是把树加载到内存、以查询优先的方式操作的对象树，但它只支持单根。[多根树](./multiroot.md)场景下（如文件系统、分类目录），同样需要一棵内存中的查询树——`MultiRootFlexTree` 就是多根树版本的`FlexTree`。

`MultiRootFlexTree`的本质是：**将多根树加载到内存，构建一棵查询优先的对象树，并提供一套与`FlexTree`基本一致的`API`**。

### 设计动机

与`FlexTree`相同：多根树同样基于`左右值算法`（查询优先的存储结构），读多写少场景下把树加载到内存后，导航、查找、遍历、导出全部就地完成，不再产生数据库往返。

### 核心特性

- **内存对象树**：执行`load`将全部用户根及其子树加载到内存，构建为由`FlexTreeNode`实例组成的多棵嵌套对象树。默认全量加载；配置`lazy:true`时只加载用户根及其一级子节点，其余子树按需加载。
- **零数据库查询**：已加载范围内，`getByPath`、`get`、`find`、`findAll`、`forEach`以及节点导航（`parent`、`children`、`siblings`、`ancestors`、`descendants`等）均在内存中完成。
- **无隐藏根**：直连`MultiRootFlexTreeManager`读取，数据天然过滤隐藏根、level已归一化（用户根`level=0`）——内存树中不存在隐藏根，用户根即顶层节点。
- **Live Tree**：与`FlexTree`同构的自动同步——监听共享管理器上的已提交写，自动置脏并全量重载。
- **同步导出**：`toJson`/`toList`直接基于内存树同步导出。

### 与 FlexTreeManager / MultiRootFlexTreeManager 的分工

|  | `MultiRootFlexTreeManager` | `MultiRootFlexTree` |
| ----  |  ---- | ---- |
| 定位 | 面向数据库的多根树管理器 | 内存中的多根查询树 |
| 读取 | 每次查询生成`SQL`访问数据库 | 加载后在内存中完成，零数据库查询 |
| 结构写操作 | 支持（添加/删除/移动/复制节点） | 不支持 |
| 数据更新 | `update` | 支持（`FlexTreeNode.update`，底层经事务写库） |
| 适用场景 | 写操作频繁、树规模大 | 读多写少、频繁查询 |

`MultiRootFlexTree`实例化时内部会通过单例机制共享`MultiRootFlexTreeManager`（可通过`tree.manager`访问），因此：

- 节点数据更新（`FlexTreeNode.update`）内部通过该管理器在事务中完成，成功后同步刷新内存中的节点数据。
- 结构性写操作（添加、删除、移动节点）请通过`tree.manager`执行，完成后内存树自动重载（Live Tree）。

## 创建树对象

```ts {6-9}
import { MultiRootFlexTree } from 'flextree'
import BunSqliteAdapter from 'flextree-bun-sqlite'

const driver = new BunSqliteAdapter()
await driver.open()

const tree = new MultiRootFlexTree('tree', {
    adapter: driver
})
await tree.load()
```

选项与`FlexTree`一致（`adapter`、`fields`、`recyclebin`、`lazy`），另多一个`hiddenRootName`（透传给管理器，默认`__root__`）。注意**不允许传`treeId`**——多根树基于单树表。

:::tip 提示
如果应用中已经创建了`MultiRootFlexTreeManager`实例，`MultiRootFlexTree`内部会通过`getInstance`单例机制命中同一实例——前提是您也用`MultiRootFlexTreeManager.getInstance`创建管理器（Live Tree 事件互通的关键）。
:::

## 对象树

`MultiRootFlexTree`加载后，`.nodes`返回用户根节点的`FlexTreeNode`实例列表，每个用户根挂各自的子树：

<LiteTree>
FlexTreeNode(A)                                  // 用户根, parent=undefined
    children({color:red}[])                      //*
        FlexTreeNode(A1)
        FlexTreeNode(A2)
FlexTreeNode(B)                                  // 用户根
    children({color:red}[])                      //*
        FlexTreeNode(B1)
FlexTreeNode(C)                                  // 用户根
</LiteTree>

## 加载

### 全量加载

```ts
const tree = new MultiRootFlexTree('tree', { adapter: driver })

console.log(tree.status)   // == 'idle'
await tree.load()          // 一次查询加载全部用户节点
console.log(tree.status)   // == 'loaded'
tree.nodes                 // 用户根节点实例列表
```

与`FlexTree`的一个重要差异：**空树是合法状态**。多根树下"零个用户根"是正常业务态（如刚初始化的分类表），`load()`成功返回，`nodes=[]`、`status='loaded'`，不会像`FlexTree`那样抛`FlexTreeNotFoundError`。

### 懒加载

树规模庞大时可配置`lazy:true`，`load`时只加载各用户根及其一级子节点，之后按需调用`FlexTreeNode.load()`加载子树：

```ts
const tree = new MultiRootFlexTree('tree', {
    adapter: driver,
    lazy: true
})
await tree.load()

const a1 = tree.getByPath('A/A1')!
console.log(a1.status)     // == 'loaded'（A1 自身已载入）
console.log(a1.children)   // == []（其子节点未加载）
await a1.load()            // 按需加载 A1 的子树
```

## 节点导航

`FlexTreeNode`的全部导航属性在多根树上可用，语义差异集中在**用户根**：

| 属性 | 普通节点 | 用户根 |
| ----  |  ---- | ---- |
| `parent` | 父节点 | `undefined`（隐藏根不存在于内存树） |
| `root` | 沿父链上溯到所在用户根 | 自身 |
| `siblings` | 同父的其余节点 | **其余用户根**（用户根之间是真实的兄弟关系） |
| `ancestors` | 到用户根的祖先链 | `[]` |

```ts
tree.nodes[0].parent      // undefined
tree.nodes[0].root        // 自身
tree.nodes[0].siblings    // 其余用户根的 FlexTreeNode 数组

const a1 = tree.get(3)!
a1.root                   // 所在用户根（A）
a1.ancestors              // [A]
```

- `node.level`为**归一化层级**：用户根`level=0`、其子节点`level=1`，依次类推。
- `node.tree`返回所属的`MultiRootFlexTree`实例。

## 根据路径访问节点

`getByPath`的路径以**用户根为起点**，首段在用户根中按`byField`（默认`name`）匹配，后续段在该根内解析：

```ts
tree.getByPath('A')            // 用户根 A
tree.getByPath('A/A1')         // A 下名为 A1 的节点
tree.getByPath('./A/A1')       // './' 前缀等价于无前缀
tree.getByPath('B/B1', { byField: 'name' })
```

与`FlexTree.getByPath`的差异：

- **`'/'`不再是根锚点**——多根树没有唯一根，`getByPath('/')`、`getByPath('/A')`返回`undefined`。
- **`'../'`在用户根上不可上溯**——用户根没有父节点，`'../...'`返回`undefined`。根内部节点的`'../'`相对路径语法照常可用。

`update(path, data)`使用同样的路径解析，路径不存在时抛`FlexTreeNotFoundError`：

```ts
await tree.update('A/A1', { title: '新标题' })
```

## 获取与查找节点

`get`/`find`/`findAll`/`forEach`在**全部用户树**范围内工作：

```ts
tree.get(6)                          // 按 id 跨根查找
tree.get((n) => n.name === 'C')      // 按条件查找（含用户根）
tree.find((n) => n.level > 0)        // 第一个满足条件的节点
tree.findAll((n) => n.name.startsWith('A'))
tree.forEach((node, parent) => { ... })   // 遍历全部用户树（dfs/bfs）
```

- `find`/`findAll`的查找范围**包含用户根**（多根树没有"排除自身根"的单根语义，各根独立遍历）。
- 遍历回调中的`parent`对用户根为`undefined`。

## 节点状态

`FlexTreeNode.status`语义与`FlexTree`一致（`idle`/`loading`/`loaded`/`error`）。`MultiRootFlexTree.status`为**按根聚合**的结果：

- 任一根`error` → `error`；否则任一`loading` → `loading`；否则任一`idle` → `idle`
- 全部`loaded`（或零根）→ `loaded`；未执行`load` → `idle`

## Live Tree：自动同步

与`FlexTree`的[Live Tree](./flextree.md#live-tree-自动同步)机制完全同构：

```ts
const manager = MultiRootFlexTreeManager.getInstance('tree', { adapter })  // 单例管理器
const tree = new MultiRootFlexTree('tree', { adapter })                    // 命中同一单例
await tree.load()

// 之后任何经 manager 的已提交写……
await manager.write(async () => {
    await manager.addNodes([{ name: 'D' }])
})
// ……自动触发：tree.dirty = true → 全量重载 → dirty = false
```

- **提交确认后置脏**：`node:*`事件在事务内先挂起，`write:after`携带`committed: true`后才置脏重载；**回滚不置脏**，内存树保持有效。
- **脏读防护**：重载进行中的读操作抛`FlexTreeDirtyError`。
- **自身写免重载**：`tree.update`的写路径已同步刷新内存数据。
- **clear()后以空树收场**：管理器清空全部用户根后，自动重载得到`nodes=[]`、`dirty=false`（多根树无`FlexTree`的"树不存在"歧义）。
- 边界同`FlexTree`：只感知本进程内同一单例管理器上的写，跨进程写以`sync()`/`load()`兜底。

### 多根树单例

`MultiRootFlexTree.getInstance(tableName, options)`，键为**表名+lazy**（多根树无treeId维度）：

```ts
const tree1 = MultiRootFlexTree.getInstance('tree', { adapter })
const tree2 = MultiRootFlexTree.getInstance('tree', { adapter })
expect(tree1).toBe(tree2)        // 同键命中同一实例，共享加载状态

// 同表的懒/非懒形态是不同实例
const lazyTree = MultiRootFlexTree.getInstance('tree', { adapter, lazy: true })
expect(lazyTree).not.toBe(tree1)
```

命中时校验`adapter`一致性，不一致抛`FlexTreeError`。清理用`MultiRootFlexTree.clearInstance()`（与`MultiRootFlexTreeManager.clearInstance()`成对使用）。

## 导出

`toJson`/`toList`基于内存树**同步**导出，口径与`MultiRootFlexTreeManager.toJson/toList`一致：

```ts
tree.toJson()
// [
//   { id: 2, name: 'A', children: [{ id: 3, name: 'A1' }, { id: 4, name: 'A2' }] },
//   { id: 5, name: 'B', children: [{ id: 6, name: 'B1' }] },
//   { id: 7, name: 'C' },
// ]

tree.toList()
// [
//   { id: 2, name: 'A', pid: 0 },      // 用户根 pid=0，不泄漏隐藏根 id
//   { id: 3, name: 'A1', pid: 2 },
//   ...
// ]
```

- `toJson`返回**多根嵌套数组**（`FlexTree`返回单个根对象）。
- `level`已归一化（用户根`level=0`）。
- `countField`同样支持，回收站启用时为可见口径（详见[导出](./export#countfield-后代数量)）。

## 事件

`MultiRootFlexTree`代理了内部`MultiRootFlexTreeManager`的事件机制：

```ts
tree.on('node:added', ({ nodes }) => {
    console.log(`新增了 ${nodes.length} 个节点`)
})
```

## API 差异一览

相对`FlexTree`，`MultiRootFlexTree`的API差异仅有：

| 差异 | 说明 |
| --- | --- |
| `.nodes` 取代 `.root` | 返回用户根`FlexTreeNode`实例列表；`.root`恒为`undefined` |
| `id` 恒为 `undefined` | 多根树禁`treeId` |
| `load()` 空树合法 | 零用户根时`nodes=[]`、`status='loaded'`，不抛错 |
| `getByPath` 首段匹配用户根 | `'/'`与`'../'`在树层无锚点，返回`undefined` |
| `toJson` 返回多根数组 | `toList`用户根`pid=0` |
| `find`/`findAll` 含用户根 | 各根独立遍历，无"排除根"语义 |
| `status` 按根聚合 | `error` > `loading` > `idle` > `loaded` |
| `siblings`（用户根） | 返回其余用户根 |
| 单例键无 treeId | 键为表名+lazy |

## MultiRootFlexTree API

- **属性**

| 属性 | 返回类型 | 描述 |
| ----  |  ---- | ---- |
| `nodes` | `FlexTreeNode[]` | 用户根节点实例列表；未加载时为空数组；重载进行中抛`FlexTreeDirtyError` |
| `root` | `undefined` | 恒为`undefined`（多根无单根） |
| `id` | `undefined` | 恒为`undefined`（禁treeId） |
| `status` | `FlexTreeNodeStatus` | 按根聚合的加载状态 |
| `options` | `MultiRootFlexTreeOptions` | 配置选项 |
| `manager` | `MultiRootFlexTreeManager` | 内部管理器实例（单例，可与用户管理器共享） |
| `dirty` | `boolean` | Live Tree脏标记 |
| `lazy` | `boolean` | 是否懒加载 |

- **方法**

| 方法名称 | 返回类型 | 描述 |
| ----  |  ---- | ---- |
| `getInstance` | `MultiRootFlexTree` | （静态）获取单例树实例，键为表名+lazy |
| `clearInstance` | `void` | （静态）清理单例注册 |
| `load` | `Promise<void>` | 加载全部用户树到内存（空树合法） |
| `getByPath` | `FlexTreeNode \| undefined` | 路径首段在用户根中匹配 |
| `get` | `FlexTreeNode \| undefined` | 按`id`或条件在全部用户树中获取 |
| `find` | `FlexTreeNode \| undefined` | 查找第一个满足条件的节点（含用户根） |
| `findAll` | `FlexTreeNode[]` | 查找所有满足条件的节点（含用户根） |
| `forEach` | `void` | 遍历全部用户树的节点 |
| `update` | `Promise<void>` | 根据路径更新节点数据 |
| `sync` | `Promise<void>` | 重新从数据库加载已载入节点的数据 |
| `toJson` | `FlexTreeExportJsonFormat[]` | 同步导出为多根嵌套数组 |
| `toList` | `FlexTreeExportListFormat` | 同步导出为带`pid`的列表（用户根`pid=0`） |
| `on`/`off`/`emit` | `void` | 事件订阅/移除/触发 |

节点实例为共用的`FlexTreeNode`，其`API`参见[FlexTree文档](./flextree.md#flextreenode-api)，多根语义差异见上文「节点导航」。
