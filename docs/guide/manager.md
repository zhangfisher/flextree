# 树管理器

`FlexTree`的核心类是`FlexTreeManager`，负责树的创建、修改、删除等操作。`FlexTreeManager`提供了一系列的方法来操作树，包括创建树、添加节点、删除节点、获取节点等。

## 创建管理器

```ts
import { FlexTreeManager } from "felxtree"
import sqltieAdapter from "felxtree-sqltie-adapter"

const tree = new FlexTreeManager("tree",{
    adapter: new sqltieAdapter(),
})

```

创建一个`FlexTreeManager`对象，至少需要传入两个参数：

- `tableName`：数据库表名称,即树存储在哪一个表中。
- `adapter`: 访问数据库的适配器，`FlexTree`提供了`sqlite`、`prisma`等适配器。


`FlexTreeManager`的构造器签名如下：

```ts {3,4}
class FlexTreeManager{
    constructor(
        tableName: string,          
        options?: FlexTreeManagerOptions<KeyFields['treeId']>
    ) 
}
```

**构造器参数如下：**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `tableName` | string | 无 | 必须的，数据库表名称 |
| `options` | FlexTreeManagerOptions | {} | 可选的，配置选项 |
| `options.treeId` | string | 无 | 可选，当多树表时指定 |
| `options.adapter` | IDatabaseDriver | 无 | 必须的，访问数据库的适配器 |
| `options.keyFields` | KeyFields | | 可选的，自定义树节点的关键字段名称 |

## 泛型参数


`FlexTreeManager`支持两个泛型参数：

```ts
export class FlexTreeManager<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields
>
```

- `Fields`

默认情况下，树具有`id`,`name`、`leftValue`、`rightValue`、`treeId`等关键字段，因此您通过`treeManager`对象实例操作树时，可以直接使用这些字段,并具有类型提示。

但是在实际应用场景中，我们的每个树节点除了这些关键字段外，还会声明其他字段，可以通过`Fields`泛型参数来指定，以便可以获取到对应的类型提示。


```ts {4-6,12-14}
import { FlexTreeManager } from "felxtree"

const tree = new FlexTreeManager<{
    size:number,
    color:string
    icon:string
}>("tree",{ ...})

const node = await tree.getNode(1)

// node具有类型提示
node.size // number
node.color // string
node.icon // string


```

- `KeyFields`

默认情况下，树具有`id`,`name`、`leftValue`、`rightValue`、`treeId`等关键字段，如果您需要自定义这些关键字段名称，可以通过`KeyFields`泛型参数来指定。

```ts  
    const tree = new FlexTreeManager<{ 
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

- 可以只指定部分关键字段名称，未指定的字段名称将使用默认值。
- `KeyFields`泛型参数的类型为`CustomTreeKeyFields`，默认值为`DefaultTreeKeyFields`。
 

