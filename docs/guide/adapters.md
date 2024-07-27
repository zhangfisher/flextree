# 数据库适配器


## 查询方式

`FlexTree`提供了`2`种查询树的方式，包括：

### 使用FlexTreeManager查询

通过核心的`FlexTreeManager`类来执行树的各种查询。

```ts

import { FlexTreeManager } from "felxtree"
import SqliteAdapter from 'flextree-sqlite-adapter';
const sqliteAdapter = new SqliteAdapter("org.db")

const treeManager = new FlexTreeManager({
    adapter: sqliteAdapter     
})

```

- 通过`FlexTreeManager`实例方法来查询树
- 上例中使用`flextree-sqlite-adapter`来示例如，如果您使用`MySQL`、`PostgreSQL`、`MongoDB`、`Redis`等数据库，可以使用
`prisma`等适配器，只需将`SqliteAdapter`替换为`PrismaAdapter`即可。
