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



