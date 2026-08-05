# 添加节点

:::warning 提示
 添加节点是一个数据写操作，需要在`write`方法中执行。
:::

## 创建根节点

通过`createRoot`方法可以创建根节点。

```ts

import { FlexTreeManager } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

// 必须在write方法内执行，否则会触发异常
await tree.write(async ()=>{ 
    await tree.createRoot({    // 创建根节点
        name:"Root",
        // .... 其他节点属性    
    })  
})
```

- `createRoot`方法必须在`write`方法内执行，否则会触发异常。
- 一棵树只能有一个根节点，如果再次调用`createRoot`方法，会抛出异常。


## 添加节点

当创建了`FlexTreeManager`后就可以通过`addNodes`方法来添加一个或多个节点。

```ts
async addNodes(
    nodes: Partial<TreeNode>[], 
    atNode?: NodeId | TreeNode | null, 
    pos: FlexNodeRelPosition = FlexNodeRelPosition.LastChild
):void

enum FlexNodeRelPosition {
    LastChild = 0,
    FirstChild = 1,
    NextSibling = 2,
    PreviousSibling = 3,
}

```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodes` | `Partial<TreeNode>[]` | 无 | 节点对象数组 |
| `atNode` | `NodeId \| TreeNode` | null  | 可选的，指定在哪个节点下添加 |
| `pos` | `FlexNodeRelPosition` | `FlexNodeRelPosition.LastChild` | 可选的，添加位置 |

### 嵌套批量添加

除了传入扁平的节点数组外，`addNodes`还支持**嵌套结构**，即在一次调用中传入一棵完整的子树，通过`children`字段描述节点之间的父子关系。此时推荐使用`options`对象形式的参数：

```ts
async addNodes(
    nodes: FlexTreeNodeInput[],
    options?: {
        at?: NodeId | TreeNode | null   // 父节点，默认根节点
        pos?: FlexNodeRelPosition       // 添加位置，默认 LastChild
        childrenField?: string          // 子节点字段名，默认 'children'
    }
): Promise<void>
```

- **示例**

```ts
await tree.write(async () => {
    await tree.addNodes([
        {
            name: "A",
            children: [            // A 的子节点
                { name: "A1" },
                { name: "A2" },
            ],
        },
        {
            name: "B",
            children: [
                { name: "B1" },
            ],
        },
    ])
})
```

生成的树结构如下：

<LiteTree>
Root
    A
        A1
        A2
    B
        B1
</LiteTree>

- **说明**

    - 嵌套结构中的`children`字段**仅用于描述添加时的层级关系**，不会被写入数据库（数据库通过左右值维护层级）。
    - 默认子节点字段名为`children`，可通过`options.childrenField`自定义（例如某些数据源使用`subs`、`child`等字段名时）。

### 最后子节点

将一个或多个节点添加为`atNode`节点的最后一个子节点。

```ts {4-14}
import { FlexTreeManager } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{  
    // 创建根节点
    await tree.createRoot({name:"Root"}) 
    // 在根节点下添加节点
    await tree.addNodes([
        {name: "A"},   
        {name: "B"},
        {name: "C"},
    ])
})  

```

生成的树结构如下:

<LiteTree>
Root
    A           //+
    B           //+
    C           //+
</LiteTree>

在上例中，我们在根节点下添加了三个子节点（**省略了`atNode`和`pos`参数**）。

接下来我们在`A`节点下添加两个子节点。

```ts 
import { LastChild } from "flextree"

await tree.write(async ()=>{ 
    const anode = await tree.findNode({name:"A"})
    // 在根节点下添加节点
    await tree.addNodes([// [!code ++]
        {name: "A1"},// [!code ++]
        {name: "A2"}// [!code ++]
    ],anode,LastChild)  // [!code ++]
})

```

生成的树结构如下:


<LiteTree>
Root
    A
        A1      //+
        A2      //+
    B
    C
</LiteTree>


### 第一个子节点

将一个或多个节点添加为`atNode`节点的第一个子节点。

 
```ts {4-14} 

import { FirstChild } from "flextree"

await tree.write(async ()=>{   
    const anode = await tree.findNode({name:"A"})
    // 第1次添加
    await tree.addNodes([
        {name: "A1"},
    ],anode,FirstChild)
    // 第2次添加
    await tree.addNodes([
        {name: "A2"},
    ],anode,FirstChild)
    // 第3次添加
    await tree.addNodes([
        {name: "A3"},
    ],anode,FirstChild)
})  

```

生成的树结构如下:

<LiteTree>
Root
    A               //! atNode
        A3          //+ 第3次添加
        A2          //+ 第2次添加
        A1          //+ 第1次添加    
    B
    C
</LiteTree>


### 下一个兄弟节点

将一个或多个节点添加为`atNode`节点的下一个兄弟节点。


```ts {4-14} 

import { NextSibling } from "flextree"

await tree.write(async ()=>{   
    const anode = await tree.findNode({name:"A"})
    // 第1次添加
    await tree.addNodes([
        {name: "A1"},
    ],anode,NextSibling)
    // 第2次添加
    await tree.addNodes([
        {name: "A2"},
    ],anode,NextSibling)
    // 第3次添加
    await tree.addNodes([
        {name: "A3"},
    ],anode,NextSibling)
})  

```

生成的树结构如下:

<LiteTree>
Root
    A               //! atNode
    A3          //+ 第3次添加
    A2          //+ 第2次添加
    A1          //+ 第1次添加    
    B
    C
</LiteTree>

### 上一个兄弟节点


将一个或多个节点添加为`atNode`节点的上一个兄弟节点。


```ts {4-14} 

import { PreviousSibling } from "flextree"

await tree.write(async ()=>{   
    const anode = await tree.findNode({name:"A"})
    // 第1次添加
    await tree.addNodes([
        {name: "A1"},
    ],anode,PreviousSibling)
    // 第2次添加
    await tree.addNodes([
        {name: "A2"},
    ],anode,PreviousSibling)
    // 第3次添加
    await tree.addNodes([
        {name: "A3"},
    ],anode,PreviousSibling)
})  

```

生成的树结构如下:

<LiteTree>
Root    
    A1          //+ 第1次添加
    A2          //+ 第2次添加
    A3          //+ 第3次添加
    A               //! atNode 
    B
    C
</LiteTree>


