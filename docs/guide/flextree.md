# FlexTree

## 功能概述

本节之前，我们一直使用`FlexTreeManager`进行示例讲解。本节开始将介绍一个专注于查询的树对象`FlexTree`。

`FlexTree`的本质是：**将数据库中的树加载到内存，构建一棵查询优先的对象树，并提供一套友好的`API`**。

:::tip 提示
`FlexTree`只支持单根。多根树（见[多根树](./multiroot.md)）请使用同构的[MultiRootFlexTree](./multiroottree.md)——API 与`FlexTree`基本一致，差别仅在多根。
:::

### 设计动机

`FlexTree`基于`左右值算法`，这本身就是一个查询优先的存储结构：查询效率高，但更新效率低（更新需要调整大量节点的左右值），因此特别适用于**读多写少**的场景。

在此类场景下，如果继续通过`FlexTreeManager`读取树，每次查询（获取子节点、查找节点、判断关系等）都会生成`SQL`并访问数据库；而树一旦加载到内存，这些查询完全可以就地完成，不必反复产生数据库往返。`FlexTree`与节点对象`FlexTreeNode`就是为此引入的。

### 核心特性

- **内存对象树**：执行`load`将树加载到内存，构建为由`FlexTreeNode`实例组成的嵌套对象树。默认全量加载；配置`lazy:true`时只加载根节点及其一级子节点，其余子树按需加载（见下文懒加载）。
- **零数据库查询**：已加载范围内，`getByPath`、`get`、`find`、`findAll`、`forEach`以及节点导航（`parent`、`children`、`ancestors`、`descendants`等）均在内存中完成，**不会再产生数据库查询**。
- **友好`API`**：像操作普通`JavaScript`对象一样操作树——属性导航、路径访问、条件查找、双模式遍历一应俱全：

```ts
const tree = new FlexTree('tree', { adapter: sqliteDriver })
await tree.load()

const a = tree.getByPath('Root/A')!     // 路径访问，支持 ./ ../ / 相对路径语法
a.parent                                // 属性导航：父节点
a.children                              // 属性导航：子节点数组
a.descendants                           // 属性导航：所有后代
tree.find((n) => n.name === 'B')        // 条件查找
tree.forEach((n) => console.log(n))     // 遍历（dfs/bfs）
```

- **懒加载**：树规模庞大时可配置`lazy:true`，`load`时只加载根节点及其一级子节点，之后按需调用`FlexTreeNode.load()`加载子树，避免一次性载入整棵大树。
- **数据同步**：数据库中的数据被其他途径修改后，调用`sync`刷新内存树。
- **同步导出**：`toJson`/`toList`直接基于内存树同步导出，无需访问数据库。

### 与 FlexTreeManager 的分工

|  | `FlexTreeManager` | `FlexTree` |
| ----  |  ---- | ---- |
| 定位 | 面向数据库的树管理器 | 内存中的查询树 |
| 读取 | 每次查询生成`SQL`访问数据库 | 加载后在内存中完成，零数据库查询 |
| 结构写操作 | 支持（添加/删除/移动/复制节点） | 不支持 |
| 数据更新 | `update` | 支持（`FlexTreeNode.update`，底层经事务写库） |
| 适用场景 | 写操作频繁、树规模大 | 读多写少、频繁查询 |

`FlexTree`实例化时内部会自动创建一个`FlexTreeManager`对象（可通过`tree.manager`访问），因此：

- 节点数据更新（`FlexTreeNode.update`）内部通过该管理器在事务中完成，成功后同步刷新内存中的节点数据。
- 结构性写操作（添加、删除、移动节点）请通过`tree.manager`执行，完成后调用`tree.load()`重新加载或`tree.sync()`刷新内存树。

## 创建树对象

`FlexTree`是一个类，专门用于加载树到内存中，提供更方便的树`API`。

```ts {8-10}
import type { FlexTreeOptions, IFlexTreeNode } from 'flextree'
import { FlexTreeManager,FlexTree, FlexTreeVerifyError } from 'flextree'

import SqliteAdapter from 'flextree-sqlite-adapter' 
const sqliteDriver = new SqliteAdapter()
await sqliteDriver.open()

const tree = new FlexTree('tree', {
    adapter: sqliteDriver,
})
await tree.load()

```

`FlexTree`的选项`FlexTreeOptions`在`FlexTreeManagerOptions`的基础上增加了一个`lazy`选项：

```ts
export type FlexTreeOptions<TreeIdType = any> = FlexTreeManagerOptions<TreeIdType> & {
    lazy?: boolean       // 是否启用懒加载，默认 false
}
```

| 选项 | 数据类型 | 默认值 | 描述 |
| ---- |  ---- | ---- | ---- |
| `adapter` | `IFlexTreeAdapter` | 无 | 数据库适配器实例 |
| `treeId` | `TreeIdType` | 无 | 单表多树时的树标识 |
| `fields` | `object` | 无 | 自定义关键字段映射 |
| `recyclebin` | `FlexTreeRecyclebinOptions` | 无 | 回收站配置，提供即启用 |
| `lazy` | `boolean` | `false` | 是否启用懒加载 |

其余选项与`FlexTreeManager`一致，详见[管理器](./manager.md)。

:::tip 提示
如果应用中已经创建了`FlexTreeManager`实例，也可以通过其`getTree`方法构建`FlexTree`对象，详见[导出](./export.md#gettree)。
:::

## 对象树

**`FlexTree`对象加载后，会构建一系列由`FlexTreeNode`组成的嵌套的对象实例树，如下：**

<LiteTree>
FlexTreeNode(Root)
    children({color:red}[])                                //*     
       FlexTreeNode(A)
            children({color:red}[])                        //*                 
                FlexTreeNode(A1)
                FlexTreeNode(A2)
                FlexTreeNode(A3)
        FlexTreeNode(B)
            children({color:red}[])                        //*             
                FlexTreeNode(B1)
                FlexTreeNode(B2)
                FlexTreeNode(B3)
        FlexTreeNode(C)                
            children({color:red}[])                        //*               
                FlexTreeNode(C1)
                FlexTreeNode(C2)
                FlexTreeNode(C3)
</LiteTree>


## 泛型

由于`FlexTree`实例化时内部会自动创建一个`FlexTreeManager`对象，其泛型与`FlexTreeManager`一样。

```ts 
export class FlexTree<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields
>
```

定制关键字段的方法也一样，如下：

```ts {4-6,12-14}
import { FlexTree } from "flextree"
import PrismaAdapter from "flextree-prisma-adapter"

    const tree = new FlexTree<{ 
        size: number
    },
    {
        id:['pk',number],
        treeId:['tree',number],
        name:"title",
        leftValue:'lft',
        rightValue:'rgt'
    }>('org', {
        adapter: new PrismaAdapter(prisma),
        fields:{
            id:'pk',
            treeId:'tree',
            name:'title',
            leftValue:'lft',
            rightValue:"rgt"
        }
    })
```

可以参考[FlexTreeManager](./manager.md)介绍。

## 加载 

执行`FlexTree.load`从数据库中加载树到内存中。

### 全量加载 

```ts
const tree = new FlexTree('tree')

console.log(tree.status)  // == 'idle'
// 将树一次性加载到内存中
await tree.load()
console.log(tree.status)  // == 'loaded'
// 获取根节点 FlexTreeNode 实例
tree.root

``` 

### 懒加载 

如果树节点太多，也可以启用懒加载，手动控制节点的加载

```ts
const tree = new FlexTree('tree',{
    lazy:true
})
 
await tree.load()

``` 

以上代码在懒加载模式下，只会加载根节点以及其子节点，对象树如下:

<LiteTree>
FlexTreeNode(Root)
    children({color:red}[])                                //* []   
       FlexTreeNode(A)
            children({color:red}[])                        // length=0                
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A1)       // 未加载                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A2)        // 未加载 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A3)         // 未加载
        FlexTreeNode(B)
            children({color:red}[])                        // length=0           
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}B1)       // 未加载                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}B2)        // 未加载 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}B3)         // 未加载
        FlexTreeNode(C)                
            children({color:red}[])                        // length=0           
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C1)       // 未加载                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C2)        // 未加载 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C3)         // 未加载
</LiteTree>

以上`A`、`B`、`C`三个节点的状态为`idle`，并且其所有子节点和后代节点均未加载。

然后，接下来您可以按需自行调用`FlexTreeNode.load()`加载

比如，以下代码将加载`B`节点:

```ts
const bnode = tree.getByPath("Root/B")

console.log(bnode.status)  // == 'idle'
await bnode.load()
console.log(bnode.status)  // == 'loaded'

```

`B`节点加载后的对象树:


<LiteTree>
FlexTreeNode(Root)
    children({color:red}[])                                //* []   
       FlexTreeNode(A)
            children({color:red}[])                        // length=0                
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A1)       // 未加载                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A2)        // 未加载 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}A3)         // 未加载
        FlexTreeNode(B)                                     // loaded
            children({color:red}[])                        // length=3           
                FlexTreeNode(B1)                        
                FlexTreeNode(B2)        
                FlexTreeNode(B3)          
        FlexTreeNode(C)                
            children({color:red}[])                        // length=0           
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C1)       // 未加载                    
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C2)        // 未加载 
                {color:#ddd;text-decoration: line-through}FlexTreeNode({color:#ddd}C3)         // 未加载
</LiteTree>
  
:::warning 提示
`FlexTree`和`FlexTreeNode`对象实例均有`load`方法，`FlexTree.load`方法用于加载整个树，而`FlexTreeNode.load`方法仅用于加载指定节点。懒加载模式下`FlexTreeNode.load`也只会加载该节点及其一级子节点。
:::

## 根据路径访问节点

当`FlexTree`或`FlexTreeNode`加载完毕后，可以通过使用`FlexTree`和`FlexTreeNode`对象实例的`getByPath`来获取指定路径的节点实例。

```ts
getByPath(
    path: string, 
    options?: { byField?: string, delimiter?: string }
): FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId> | undefined 

```

- **参数**

| 字段名称 | 数据类型 | 描述 |
| ----  |  ---- | ---- | 
| `path` | `string` | 节点在树中的位置 |
| `options` | `object` | 选项 |
| `options.byField` | `string` | 指定路径是由哪一个字段值组成，默认`name` |
| `options.delimiter` | `string` | 路径的分隔符，默认`/` |

- **返回值**

返回指定路径的`FlexTreeNode`节点实例，如果节点不存在则返回`undefined`。


- **示例**

```ts
tree.getByPath('/')
tree.getByPath('./')
tree.getByPath('./A')
tree.getByPath('./A/A-1')
tree.getByPath('./A/A-1/A-1-1')
tree.getByPath('A')
tree.getByPath('A/A-1')
tree.getByPath('A/A-1/A-1-1') 

const b1 = root.getByPath('B')!
b1.getByPath('../A')
b1.getByPath('../A/A-1')
b1.getByPath('../A/A-1/A-1-1')

b1.getByPath('B-1')
b1.getByPath('B-1/B-1-1')

```

- **说明**

    - `FlexTree`和`FlexTreeNode`对象实例均有`getByPath`方法，`FlexTree.getByPath`方法用于在整个树检索，而`FlexTreeNode.getByPath`方法的路径是相对于节点的。
    - 可以使用相对路径语法,`./`表示当前节点，`../`代表父节点，`../../`代表祖先节点等。
    - 懒加载模式下，如果路径中的某个节点未加载，则会返回`undefined`，此时需要先调用对应节点的`load()`方法。


## 获取节点

使用`FlexTree`和`FlexTreeNode`对象实例的`get`方法来获取在所在节点及其后代节点中返回指定的实例。

```ts
get(
    nodeIdOrCondition: NodeId | ((node: FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>) => boolean)
): FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId> | undefined
```

- **参数**

| 字段名称 | 数据类型 | 描述 |
| ----  |  ---- | ---- |
| `nodeIdOrCondition` | `NodeId \| Function` | 节点`id`或者条件函数 |

- **返回值**

返回指定`nodeId`或第一个满足条件的`FlexTreeNode`节点实例，如果节点不存在则返回`undefined`。

- **示例**

```ts
// 按 id 获取节点
const node = tree.get(1)

// 按条件获取第一个满足条件的节点
const node2 = tree.get((node) => node.name === 'A')

// 在指定节点及其后代中获取
const a = tree.getByPath('Root/A')!
const child = a.get(5)
```

- **说明**

    - `FlexTree.get`在整个树（含根节点）中查找；`FlexTreeNode.get`在当前节点及其后代节点中查找。

## 查找节点

`FlexTree`和`FlexTreeNode`提供`find`和`findAll`方法，用于在后代节点中查找满足条件的节点。

```ts
find(
    condition: (node: FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>) => boolean
): FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId> | undefined

findAll(
    condition: (node: FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>) => boolean
): FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>[]
```

- **参数**

| 字段名称 | 数据类型 | 描述 |
| ----  |  ---- | ---- |
| `condition` | `Function` | 条件函数，返回`true`表示匹配 |

- **返回值**

- `find`：返回第一个满足条件的节点，如果没有则返回`undefined`
- `findAll`：返回所有满足条件的节点数组

- **示例**

```ts
// 查找所有名称以 A 开头的节点
const nodes = tree.findAll((node) => node.name.startsWith('A'))

// 查找第一个 level > 2 的节点
const node = tree.find((node) => node.level > 2)
```

:::warning 提示
`find`和`findAll`的查找范围是后代节点，**不包括自身节点**（`FlexTree`中即不包括根节点）。
:::

## 遍历节点

`FlexTree`和`FlexTreeNode`提供`forEach`方法遍历节点。

```ts
forEach(
    callback: (node: FlexTreeNode, parent: FlexTreeNode | undefined) => void,
    options?: {
        includeSelf?: boolean       // 是否包含自身节点，默认 false
        ignoreErrors?: boolean      // 是否忽略 callback 抛出的错误，默认 true
        mode?: 'dfs' | 'bfs'        // 遍历模式：深度优先/广度优先，默认 'dfs'
    }
): void
```

- **示例**

```ts
// 深度优先遍历整棵树
tree.forEach((node, parent) => {
    console.log(node.name, node.id)
})

// 广度优先遍历，并且包含根节点
tree.forEach((node) => {
    console.log(node.name)
}, { mode: 'bfs', includeSelf: true })

// 从指定节点开始遍历其后代
const a = tree.getByPath('Root/A')!
a.forEach((node) => {
    console.log(node.name)
})
```

在`callback`中抛出`FlexTreeAbortError`可以中断遍历：

```ts
import { FlexTreeAbortError } from 'flextree'

tree.forEach((node) => {
    if (node.name === 'A-1-1') throw new FlexTreeAbortError()
    console.log(node.name)
})
```

## 节点导航

`FlexTreeNode`提供了一组属性用于访问关联节点，所有属性均基于已加载的内存树，**不会产生数据库查询**。

| 属性 | 数据类型 | 描述 |
| ----  |  ---- | ---- |
| `parent` | `FlexTreeNode \| undefined` | 父节点，根节点返回`undefined` |
| `children` | `FlexTreeNode[] \| undefined` | 直接子节点，见下方说明 |
| `siblings` | `FlexTreeNode[] \| undefined` | 兄弟节点（不包括自身） |
| `ancestors` | `FlexTreeNode[]` | 所有祖先节点，按离根节点由近到远排序 |
| `descendants` | `FlexTreeNode[]` | 所有后代节点 |
| `root` | `FlexTreeNode` | 所在树的根节点 |
| `tree` | `FlexTree` | 所属的`FlexTree`对象 |

- **示例**

```ts
const root = tree.root!
root.children          // [A, B, C]
root.descendants       // 所有后代节点

const a = tree.getByPath('Root/A')!
a.parent               // Root 节点
a.siblings             // [B, C]
a.ancestors            // [Root]
```

- **说明**

    - `children`的取值：叶子节点为`undefined`；非叶子节点已加载时为子节点数组；懒加载模式下未加载时为空数组`[]`。

## 更新节点

`FlexTree`和`FlexTreeNode`提供`update`方法更新节点数据。

```ts
// FlexTreeNode.update
async update(data: Partial<TreeNode>): Promise<void>

// FlexTree.update（按路径更新）
async update(path: string, data: Partial<TreeNode>): Promise<void>
```

- **示例**

```ts
// 更新指定节点
const a = tree.getByPath('Root/A')!
await a.update({ name: 'A-新名称' })

// 按路径更新
await tree.update('Root/A/A-1', { name: 'A-1-新名称' })
```

- **说明**

    - 更新操作通过[写操作](./write.md)机制在事务中执行，成功后会同时更新内存中的节点数据。
    - 更新数据中不能包括关键字段（`id`、`treeId`、`level`、`leftValue`、`rightValue`），但`name`除外。
    - `FlexTree.update`在路径不存在时会抛出`FlexTreeNotFoundError`。

## 节点状态

`FlexTreeNode`节点实例具有状态属性`status`，用于表示节点的加载状态。在懒加载模式下可以通过该属性判断节点是否已加载。

```ts
type FlexTreeNodeStatus = 'idle' | 'loading' | 'loaded' | 'error'
```

- **状态取值**

| 状态 | 描述 |
| ----  |  ---- |
| `idle` | 未加载，实例化后未加载节点数据时的初始状态 |
| `loading` | 加载中 |
| `loaded` | 已加载 |
| `error` | 加载出错 |

:::warning 提示
当节点存在子节点时，必须是所有子节点均已加载，节点状态才为`loaded`。所以懒加载模式下，未加载的中间节点状态为`idle`。
`FlexTree.status`等于根节点的状态，未执行`load`之前为`idle`。
:::

## 同步数据

当数据库中的节点数据发生变化后（例如被其他进程修改），可以使用`sync`方法重新从数据库中加载节点数据来刷新内存中的树。

```ts
// FlexTree.sync：重新加载整棵树的数据
async sync(): Promise<void>

// FlexTreeNode.sync：重新加载当前节点
async sync(includeDescendants: boolean = false): Promise<void>
```

- **示例**

```ts
// 刷新整棵树
await tree.sync()

// 仅刷新指定节点
const a = tree.getByPath('Root/A')!
await a.sync()

// 刷新指定节点及其所有后代
await a.sync(true)
```

:::warning 提示
`sync`仅刷新已加载节点的数据，不会改变内存树的结构。如果树的结构发生了变化（如新增、删除了节点），建议重新执行`tree.load()`加载整棵树。
:::

## Live Tree：自动同步

`FlexTree`内部基于`FlexTreeManager`单例（键为表名+`treeId`）：当您通过`FlexTreeManager.getInstance`创建管理器并执行写操作时，`FlexTree`能够监听到这些写事件，并自动保持内存树与数据库一致——这就是**Live Tree**。

### 工作机制

```ts
const manager = FlexTreeManager.getInstance('tree', { adapter })   // 单例管理器
const tree = new FlexTree('tree', { adapter })                     // 内部命中同一单例
await tree.load()

// 之后任何经 manager 的已提交写……
await manager.write(async () => {
    await manager.addNodes([{ name: 'C' }], parentNode)
})
// ……会自动触发：tree.dirty = true → 全量重载内存树 → 重载完成后 dirty = false
```

具体行为：

1. **事件捕获**：`FlexTree`订阅内部管理器的全部节点事件（`node:added`、`node:deleted`、`node:updated`、`node:moved`、`node:recycled`、`node:cleared`）。
2. **提交确认**：`node:*`事件在事务内、`COMMIT`前触发，可能随回滚化为乌有。因此置脏延迟到`write:after`携带`committed: true`确认提交后才执行——**回滚不置脏**，内存树保持有效。
3. **自动重载**：确认提交后置`tree.dirty = true`并**自动启动全量重载**（按树的`lazy`配置执行）。重载成功后`dirty`清除；重载失败则保持`dirty = true`，此时内存树不可信，可稍后手动`load()`/`sync()`重试。
4. **脏读防护**：重载进行期间，任何读操作（`root`、`get`、`getByPath`、`find`、`findAll`、`forEach`、`toJson`、`toList`）会抛出`FlexTreeDirtyError`，避免读到中间态数据。

```ts
try {
    const node = tree.getByPath('C')   // 重载进行中会抛 FlexTreeDirtyError
} catch (e) {
    if (e instanceof FlexTreeDirtyError) {
        // 稍后重试，或等待自动重载完成
    }
}
```

### 说明

- **自身发起的写不触发重载**：通过`FlexTree.update`（或节点`update`）更新数据时，写路径会同步刷新内存中的节点数据，无须重载。
- **管理器单例键为表名+treeId**：`FlexTreeManager.getInstance('tree', { treeId: 1 })`与`getInstance('tree', { treeId: 2 })`是两个实例；同键重复获取命中同一实例。命中时校验`adapter`一致性，不一致抛`FlexTreeError`。
- **`lazy`归`FlexTree`所有**：单例管理器只承载连接与存储配置（`adapter`、字段映射、`recyclebin`等），`lazy`是`FlexTree`实例自己的读取行为——同一棵树可以同时存在懒加载与非懒加载两个`FlexTree`实例。
- **`clear()`后的空表是合法终态**：自动重载发现树已不存在时，`root`置空、`dirty`清除，不视为错误（直接调用`load()`加载空表仍会抛错，保持既有语义）。
- **边界**：Live Tree 只感知**本进程内同一单例管理器**上的写。跨进程、跨实例（如直接`new FlexTreeManager`未走单例）的写不可见，此时以`sync()`/`load()`兜底。

### FlexTree 单例

`FlexTree`自身也提供与`FlexTreeManager`同构的单例机制，适合"多处获取同一棵活树"的场景——单例树共享加载状态（`load`、`dirty`、自动重载）：

```ts
const tree1 = FlexTree.getInstance('tree', { adapter })
const tree2 = FlexTree.getInstance('tree', { adapter })
expect(tree1).toBe(tree2)            // 同键命中同一实例

await tree1.load()
tree2.root                           // 已可见——共享加载状态
```

- **键为表名+treeId+lazy**：多树表中同表不同树、同一棵树的懒/非懒形态，各自持有实例。
- **命中校验`adapter`一致性**，不一致抛`FlexTreeError`。
- **清理**：`FlexTree.clearInstance()`清空全部，或`FlexTree.clearInstance('tree')`清理指定表（连带其多树与懒/非懒形态）。测试场景中应与`FlexTreeManager.clearInstance()`成对使用。
- 单例树在已提交写后自动重载，所有引用处看到一致的最新树——见上文工作机制。

## 导出

`FlexTree`和`FlexTreeNode`提供`toJson`和`toList`方法，将内存中的树导出为`JSON`对象或带`pid`的列表数组。

```ts
tree.toJson()                     // 导出整棵树
tree.toJson({ level: 2 })         // 只导出到第 2 级
tree.toList()                     // 导出为列表

const a = tree.getByPath('Root/A')!
a.toJson()                        // 导出 A 节点及其后代
```

:::tip 提示
与`FlexTreeManager.toJson`不同，`FlexTree`和`FlexTreeNode`的`toJson`/`toList`是**同步方法**，直接基于内存中已加载的树生成结果。详细的参数说明请参考[导出](./export.md)。
:::

### 后代数量 countField

导出时指定`countField`后，每个节点会附加一个表示**后代节点数量**的字段（叶子节点为`0`）：

```ts
tree.toJson({ countField: 'count' })
tree.toList({ countField: 'count' })
```

- 数量按`(rightValue - leftValue - 1) / 2`计算，恒为**全量后代数**——不受`level`截断影响
- `countField`与`id`同地位：指定`fields`过滤时照样附加，不受`includeKeyFields`控制
- 与节点已有字段重名时会抛出`FlexTreeError`
- 启用[回收站](./recyclebin.md)时为**可见口径**：默认视角下数量不含已被回收的节点（与导出内容一致）
- `FlexTree`在`load`/`sync`时会自动预取回收站区间以保证上述口径，无需手动处理

## 事件

`FlexTree`代理了内部`FlexTreeManager`的事件机制，可以通过`on`/`off`/`emit`订阅、移除和触发事件。

```ts
tree.on('node:added', ({ nodes }) => {
    console.log('节点已添加', nodes)
})

tree.off('node:added', handler)
```

:::tip 提示
支持的事件列表与`FlexTreeManager`一致，请参考[管理器事件](./manager.md#事件)。
:::

## FlexTree API

- **属性**

| 属性 | 返回类型 | 描述 |
| ----  |  ---- | ---- |
| `id` | `TreeId` | 树的`treeId` |
| `root` | `FlexTreeNode \| undefined` | 根节点，未加载时为`undefined`；重载进行中抛`FlexTreeDirtyError` |
| `status` | `FlexTreeNodeStatus` | 树的加载状态，等于根节点的状态；未执行`load`时为`idle` | 
| `options` | `FlexTreeOptions` | 配置选项 |
| `manager` | `FlexTreeManager` | 内部的`FlexTreeManager`实例（单例，可与用户管理器共享） |
| `dirty` | `boolean` | Live Tree脏标记：已提交写已发生且重载未完成（或已失败）时为`true` |

- **方法**

| 方法名称 | 返回类型 | 描述 |
| ----  |  ---- | ---- |
| `getInstance` | `FlexTree` | （静态）获取单例树实例，键为表名+treeId+lazy |
| `clearInstance` | `void` | （静态）清理单例注册 |
| `load` | `Promise<void>` | 加载整棵树到内存中 |
| `getByPath` | `FlexTreeNode \| undefined` | 根据路径获取节点 |
| `get` | `FlexTreeNode \| undefined` | 按`id`或条件获取节点 |
| `find` | `FlexTreeNode \| undefined` | 查找第一个满足条件的后代节点 |
| `findAll` | `FlexTreeNode[]` | 查找所有满足条件的后代节点 |
| `forEach` | `void` | 遍历树节点 |
| `update` | `Promise<void>` | 根据路径更新节点数据 |
| `sync` | `Promise<void>` | 重新从数据库加载整棵树数据 | 
| `toJson` | `FlexTreeExportJsonFormat` | 序列化树为`JSON`对象 |
| `toList` | `FlexTreeExportListFormat` | 序列化树为带`pid`的列表数组 |
| `on` | `void` | 监听事件 |
| `off` | `void` | 移除事件监听 |
| `emit` | `void` | 触发事件 |

## FlexTreeNode API

- **属性**

| 属性 | 返回类型 | 描述 |
| ----  |  ---- | ---- |
| `id` | `NodeId` | 节点`id` |
| `name` | `string` | 节点名称 |
| `level` | `number` | 节点层级 |
| `leftValue` | `number` | 节点左值 |
| `rightValue` | `number` | 节点右值 |
| `treeId` | `TreeId` | 所属树的`treeId` |
| `fields` | `TreeNode` | 节点原始数据对象（包括自定义字段） |
| `status` | `FlexTreeNodeStatus` | 节点的加载状态 |
| `parent` | `FlexTreeNode \| undefined` | 父节点 |
| `children` | `FlexTreeNode[] \| undefined` | 直接子节点 |
| `siblings` | `FlexTreeNode[] \| undefined` | 兄弟节点（不包括自身） |
| `ancestors` | `FlexTreeNode[]` | 所有祖先节点 |
| `descendants` | `FlexTreeNode[]` | 所有后代节点 |
| `root` | `FlexTreeNode` | 所在树的根节点 |
| `tree` | `FlexTree` | 所属的`FlexTree`对象 |

- **方法**

| 方法名称 | 返回类型 | 描述 |
| ----  |  ---- | ---- |
| `load` | `Promise<void>` | 加载节点及其子节点（懒加载时仅加载一级子节点） |
| `getByPath` | `FlexTreeNode \| undefined` | 根据相对路径获取节点 |
| `get` | `FlexTreeNode \| undefined` | 在自身及后代节点中按`id`或条件获取节点 |
| `find` | `FlexTreeNode \| undefined` | 查找后代节点中第一个满足条件的节点 |
| `findAll` | `FlexTreeNode[]` | 查找后代节点中所有满足条件的节点 |
| `forEach` | `void` | 遍历自身及后代节点，支持`dfs`/`bfs`模式 |
| `update` | `Promise<void>` | 更新节点数据（不包括关键字段） |
| `sync` | `Promise<void>` | 重新从数据库加载节点数据 |
| `toJson` | `FlexTreeExportJsonFormat` | 导出当前节点及其后代为`JSON`对象 |
| `toList` | `FlexTreeExportListFormat` | 导出当前节点及其后代为带`pid`的列表数组 |
| `toString` | `string` | 返回`名称<id>`格式的字符串，如`A<2>` |
