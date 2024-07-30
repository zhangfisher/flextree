# 移动节点

:::warning 提示
移动节点是一个数据写操作，需要在`write`方法中执行。
:::

## 移动节点

将节点从一个位置移动到另一个位置，可以使用`move`方法。

```ts
async moveNode(
    node: NodeId | TreeNode, 
    toNode?: NodeId | TreeNode, 
    pos: FlexNodeRelPosition = FlexNodeRelPosition.NextSibling
):Promise<void>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |
| `toNode` | NodeId \| TreeNode | null | 可选的，指定目标节点 |
| `pos` | FlexNodeRelPosition | FlexNodeRelPosition.NextSibling | 可选的，移动位置 |

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
    await tree.moveNode(anode,bnode)      // [!code ++]
    // LastChild是默认值，等效上句
    await tree.moveNode(anode,bnode,LastChild)// [!code ++]
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
    toNode?: NodeId | TreeNode
):Promise<boolean>

```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `node` | NodeId \| TreeNode | 无 | 节点`id`或节点对象 |
| `toNode` | NodeId \| TreeNode | 无 | 目标节点`id`或节点对象 |

- **返回值**

| 类型 | 描述 |
| --- | --- |
| `boolean` | 如果节点可以移动，则返回`true`，否则返回`false` |


- **说明**

    - 一般情况下，任何节点均不能移动到其后代节点的任意
    - 以上`moveNode/moveUpNode/moveDownNode`方法内部已经做了判断，不需要再额外调用。

