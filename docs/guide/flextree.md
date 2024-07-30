# FlexTree

本节之前，我们一直使用`FlexTreeManager`进行示例讲解。本节开始将介绍一个专注于查询的对象`FlexTree`。

由于`FlexTree`基于`左右值算法`，这是一个查询优先的存储结构，查询效率高，但更新效率低。
所以，原则上，特别适用于查询大于更新的场景，因此为了更好地操作树引入了对象`FlexTree`和节点对象`FlexTreeNode`。
 

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

## 对象树

**`FlexTree`对象加载后，会构建一系列由`FlexTeeeNode`组成的嵌套的对象实例树，如下：**

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
                FlexTreeNode(B)
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
import { FlexTree } from "felxtree"
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

console.log(tree.status)  // == not-loaded
// 将树一次性加载到内存中
await tree.load()
console.log(tree.status)  // ==  loaded
// 获取根节点FlexNode实例
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

以上代码在懒加载模式下，只要加载根节点以及其子节点，对象树如下:

<LiteTree>
FlexTreeNode(Root)
    children({color:red}[])                                //* []   
       FlexTreeNode(A)
            children({color:red}[])                        // length=0                
                {color:#ddd}FlexTreeNode({color:#ddd}A1)       // 未加载                    
                {color:#ddd}FlexTreeNode({color:#ddd}A2)        // 未加载 
                {color:#ddd}FlexTreeNode({color:#ddd}A3)         // 未加载
        FlexTreeNode(B)
            children({color:red}[])                        // length=0           
                {color:#ddd}FlexTreeNode({color:#ddd}B1)       // 未加载                    
                {color:#ddd}FlexTreeNode({color:#ddd}B2)        // 未加载 
                {color:#ddd}FlexTreeNode({color:#ddd}B3)         // 未加载
        FlexTreeNode(C)                
            children({color:red}[])                        // length=0           
                {color:#ddd}FlexTreeNode({color:#ddd}C1)       // 未加载                    
                {color:#ddd}FlexTreeNode({color:#ddd}C2)        // 未加载 
                {color:#ddd}FlexTreeNode({color:#ddd}C3)         // 未加载
</LiteTree>

以上`A`、`B`、`C`三个节点的状态为`not-loaded`，并且其所有子节点和后代节点均未加载。

然后，接下来您可以按需自行调用`FlexTreeNode.load()`加载

比如，以下代码将加载`B`节点:

```ts
const bnode = tree.getByPath("Root/B")

console.log(bnode.status)  // == 'not-loaded'
await bnode.load()
console.log(bnode.status)  // == 'loaded'

```

`B`节点加载后的对象树:


<LiteTree>
FlexTreeNode(Root)
    children({color:red}[])                                //* []   
       FlexTreeNode(A)
            children({color:red}[])                        // length=0                
                {color:#ddd}FlexTreeNode({color:#ddd}A1)       // 未加载                    
                {color:#ddd}FlexTreeNode({color:#ddd}A2)        // 未加载 
                {color:#ddd}FlexTreeNode({color:#ddd}A3)         // 未加载
        FlexTreeNode(B)                                     // loaded
            children({color:red}[])                        // length=3           
                FlexTreeNode(B1)                        
                FlexTreeNode(B2)        
                FlexTreeNode(B3)          
        FlexTreeNode(C)                
            children({color:red}[])                        // length=0           
                {color:#ddd}FlexTreeNode({color:#ddd}C1)       // 未加载                    
                {color:#ddd}FlexTreeNode({color:#ddd}C2)        // 未加载 
                {color:#ddd}FlexTreeNode({color:#ddd}C3)         // 未加载
</LiteTree>
  
:::warning 提示
`FlexTree`和`FlexTreeNode`对象实例均有`load`方法，`FlexTree.load`方法用于加载整个树，而`FlexTreeNode.load`方法仅用于加载指定节点。
:::

## 根据路径访问节点

当`FlexTree`或`FlexTreeNode`加载完毕后，可以通过`getByPath`来获取指定路径的节点实例。

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

 

:::warning 提示
`FlexTree`和`FlexTreeNode`对象实例均有`getByPath`方法，`FlexTree.getByPath`方法用于在整个树检索，而`FlexTreeNode.getByPath`方法的路径是相对于节点的，可以使用相对路径语法等。
:::



## FlexNode

