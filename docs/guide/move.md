# 移动节点

:::warning 提示
移动节点是一个数据写操作，需要在`write`方法中执行。
:::

## 移动节点

将节点从一个位置移动到另一个位置，可以使用`moveNode`方法。

```ts
async moveNode(
    node: NodeId | TreeNode, 
    toNode?: NodeId | TreeNode, 
    posOrOptions?: FlexNodeRelPosition | FlexTreeMoveOptions
):Promise<void>
```

第三参数既可以是`pos`枚举（向后兼容的旧风格），也可以是选项对象：

```ts
interface FlexTreeMoveOptions {
    pos?: FlexNodeRelPosition          // 相对位置，默认 NextSibling
    treeId?: TreeId                    // 跨树移动时指定目标树，见「跨树移动节点」
}
```

:::warning 注意
省略`pos`时默认为`NextSibling`（下一个兄弟节点），**不是**`LastChild`。
:::

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |
| `toNode` | NodeId \| TreeNode | null | 可选的，指定目标节点 |
| `posOrOptions` | FlexNodeRelPosition \| FlexTreeMoveOptions | NextSibling | 可选的，移动位置或选项对象 |

以下以一个简单的树为例，说明移动节点的操作：

<LiteTree>
Root
    A
        A1
        A2
        A3
    B
        B1
        B2
        B3
    C
        C1
        C2
        C3
</LiteTree>

### 最后子节点

将节点移动到`toNode`节点的最后一个子节点。

```ts
import { FlexTreeManager,LastChild } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    const anode = await tree.findNode({name:"A"})
    const bnode = await tree.findNode({name:"B"})
    // 将A节点移动到B节点下
    await tree.moveNode(anode,bnode,LastChild)      // [!code ++]
})
```

移动后的树结构如下:

<LiteTree>
Root
    B                       //! toNode
        B1
        B2
        B3
        A                   //+
            A1              //+
            A2              //+
            A3              //+
    + C
        C1
        C2
        C3
</LiteTree>

### 第一个子节点

将节点移动到`toNode`节点的最后一个子节点。

```ts
import { FlexTreeManager,FirstChild } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    const anode = await tree.findNode({name:"A"})
    const bnode = await tree.findNode({name:"B"}) 
    await tree.moveNode(anode,bnode,FirstChild)      // [!code ++]
})
```

移动后的树结构如下:

<LiteTree>
Root
    B                       //! toNode        
        A                   //+
            A1              //+
            A2              //+
            A3              //+ 
        B1
        B2
        B3
    + C
        C1
        C2
        C3
</LiteTree>
 

### 上一个兄弟节点

将节点移动为`toNode`节点的上一个兄弟节点。

```ts
import { FlexTreeManager,PreviousSibling } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    const cnode = await tree.findNode({name:"C"})
    const bnode = await tree.findNode({name:"B"}) 
    await tree.moveNode(cnode,bnode,PreviousSibling)      // [!code ++]
})
```

将`bnode`移动为`cnode`的上一个兄弟节点，移动后的树结构如下:

<LiteTree>
Root
    A                   
        A1              
        A2              
        A3              
    C                       //+
        C1                  //+
        C2                  //+
        C3                  //+
    B                       //! toNode        
        B1
        B2
        B3    
</LiteTree>

### 下一个兄弟节点

将节点移动为`toNode`节点的上一个兄弟节点。

```ts
import { FlexTreeManager,NextSibling } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    const anode = await tree.findNode({name:"A"})
    const bnode = await tree.findNode({name:"B"}) 
    await tree.moveNode(anode,bnode,NextSibling)      // [!code ++]
})
```

将`anode`移动为`cnode`的下一个兄弟节点，移动后的树结构如下:

<LiteTree>
Root
    B                       //! toNode        
        B1
        B2
        B3          
    A                       //+
        A1                  //+
        A2                  //+
        A3                  //+
    C                       
        C1                  
        C2                  
        C3                  
</LiteTree>

## 向上移动节点

`moveUpNode`方法用于向上移动节点。

```ts
async moveUpNode(node: NodeId | TreeNode):Promise<void> 
```

设想的场景就是在`UI`界面是，用户可以通过`上移`按钮将一个节点一直向上移动，直到根节点为止。

- 在同级内，向上移动节点本质上就是**与上一个兄弟节点交换位置**,或者说等效于移为其上一个兄弟节点的上一个兄弟节点。
- 当移动到父节点的第一个子节点时，**再向上移动时**，节点已经没有前一个兄弟节点时，将节点**移动为父节点的上一个兄弟节点**.

:::warning 注意
向上移动节点时，如果节点已经是根节点的第一个子节点时，则不会再向上移动。
:::

## 向下移动节点

`moveDownNode`方法用于向下移动节点。

```ts
async moveDownNode(node: NodeId | TreeNode):Promise<void> 
```

设想的场景就是在`UI`界面是，用户可以通过`下移`按钮将一个节点一直向下移动，直到树的最下方为止。

- 在同级内，向下移动节点本质上就是**与下一个兄弟节点交换位置**,或者说等效于移为其下一个兄弟节点的下一个兄弟节点。
- 当移动到父节点的最后一个子节点时，**再向下移动时**，节点已经是其父节点的最后一个节点了，节点将继续移动到**父节点的下一个兄弟节点**.


## 判定是否可以移动

`canMoveNode`方法用于判定节点是否可以移动。

```ts
async canMoveTo(
    node: NodeId | TreeNode, 
    toNode?: NodeId | TreeNode,
    options?: FlexTreeMoveOptions
):Promise<boolean>

```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode | 无 | 节点`id`或节点对象 |
| `toNode` | NodeId \| TreeNode | 无 | 目标节点`id`或节点对象 |
| `options` | FlexTreeMoveOptions | 无 | 可选的，`treeId` 指定目标树（跨树预检，语义与 `moveNode` 一致） |

- **返回值**

| 类型 | 描述 |
| --- | --- |
| `boolean` | 如果节点可以移动，则返回`true`，否则返回`false` |


- **说明**

    - 一般情况下，任何节点均不能移动到其后代节点的任意
    - 跨树预检时：移动根节点返回`true`（等效删除原树，见「跨树移动根节点」），目标树中找不到`toNode`则抛错
    - 以上`moveNode/moveUpNode/moveDownNode`方法内部已经做了判断，不需要再额外调用。

## 跨树移动节点

在单表多树场景下，可以通过`options.treeId`将节点（连同其所有后代）移动到**另一棵树**中：

```ts
import { FlexTreeManager,LastChild } from 'flextree';
// tree1 与 tree2 管理同一张多树表的不同树
const tree1 = new FlexTreeManager("org",{ adapter, treeId:1 })
const tree2 = new FlexTreeManager("org",{ adapter, treeId:2 })

await tree1.write(async ()=>{
    const anode = await tree1.findNode({name:"A"})
    const cnode = await tree2.findNode({name:"C"})
    // 将树1的A子树移动到树2中C节点的最后一个子节点位置
    await tree1.moveNode(anode,cnode,{ treeId:2, pos:LastChild })      // [!code ++]
})
```

- **说明**

    - `treeId`指定**目标树**；此时`toNode`指向该树中的节点（`id`或节点对象均可）
    - **方向是单向的**：只能将当前树的节点移出到其他树，不能把其他树的节点移入当前树——其他树的节点在当前`manager`中不存在，作为移动源会抛出`NotFound`错误；反向移动请使用目标树侧的`manager`执行
    - 移动完成后，子树所有节点的`treeId`、`level`、`leftValue`、`rightValue`均按目标树重新计算
    - 跨树移动会触发两个事件：先`node:deleted`（源树视角，节点被移离），后`node:moved`（`toTree`指向目标树）
    - `treeId`等于当前树时视为同树移动（等同不传）；单树模式下提供`treeId`将抛出错误
    - 目标为**目标树的根节点**时禁止兄弟位（`NextSibling`/`PreviousSibling`，根无兄弟；与同树规则一致）
    - 跨树移动以固定的几条集合`SQL`原子完成，数据库访问次数与子树规模无关

### 迁出为新树

跨树移动时**省略`toNode`**，则将`node`连同其子树迁出为`treeId`指定的**新树的根**：

```ts
await tree1.write(async ()=>{
    const anode = await tree1.findNode({name:"A"})
    // 将 A 子树迁出为 treeId=3 的新树，A 成为该树的根
    await tree1.moveNode(anode,undefined,{ treeId:3 })      // [!code ++]
})
```

- **说明**

    - 迁出后`node`成为新树的根（`level=0`、`leftValue=1`），子树内部结构保持不变
    - 此场景下`pos`**无效**（新树没有落点参照，传了会被忽略）
    - 目标`treeId`必须**尚无树**——已存在则抛出`Tree already exists`错误
    - 源根节点同样适用：等效于整棵树"搬家"到新的`treeId`（原 manager 随之失效）
    - 事件顺序与跨树移动一致：先`node:deleted`（源树视角）后`node:moved`

### 跨树移动根节点（等效删除原树）

跨树移动**根节点**是允许的——整棵源树（根及其所有后代）并入目标树：

```ts
await tree1.write(async ()=>{
    const root = await tree1.getRoot()
    const cnode = await tree2.findNode({name:"C"})
    // 将 tree1 的整棵树并入 tree2，作为 C 的最后一个子节点
    await tree1.moveNode(root,cnode,{ treeId:2, pos:LastChild })      // [!code ++]
})
```

:::danger 注意
此操作成功后，**tree1 所对应的管理器管理的树已被删除**：

- 对该`manager`的任何后续操作均会**失败**——读取得到空结果（`getNodes()`返回`[]`、`getRoot()`返回`null`），写入操作（如`addNodes`/`moveNode`/`deleteNode`）因找不到根节点而抛出错误
- 如需继续使用该`treeId`，必须先重新`createRoot()`创建新树
- 同样地，不能将一棵树的根节点移动到**目标树根节点**的上一个或下一个兄弟节点位置（根无兄弟）
:::

## node:moved 事件

移动完成后会触发`node:moved`事件：

```ts
tree.on("node:moved",(e)=>{
    // e.tree   移动发起时的源树
    // e.toTree 落点所在树（同树移动时 === e.tree）
    // e.from   移动的节点
    // e.to     落点参照节点
    // e.pos    相对位置
})
```

**跨树移动会额外先触发`node:deleted`事件**（源树视角，节点连同其后代被移离原树）：

```ts
tree.on("node:deleted",(e)=>{
    // e.tree  源树
    // e.node  被移离的节点（子树根）
})
```

