# 创建树

`FlexTree`是基于左右值算法的树存储库，树是保存在数据库表中，所以**创建树就是创建一张符合一定格式约定的数据库表**。

## 表结构

默认情况下，`FlexTree`要求每棵树表均至少具备以下字段

| 字段名称 | 数据类型 | 描述 |
| ----  |  ---- | ---- | 
| `id`  | `number` | 主键 |
| `name`  | `string` | 节点名称 |
| `level`| `number` | 节点层级，`0`代表根节点，`1-N`代表第N级节点 |
| `leftValue` | `number` | 左值 | 
| `rightValue` | `number` | 右值 | 
| `treeId` | `number` |可选，多树表时用来区别不同的树 | 



## 创建表

存储树的数据库表是**由应用自行创建**的，`FlexTree`不负责创建数据库表。

一般可以采用类似以下的`SQL`创建

```sql
    CREATE TABLE IF NOT EXISTS  org (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(60),  
        level INTEGER,  
        leftValue INTEGER, 
        rightValue INTEGER,
        -- 其他字段       
```

如果您使用`prisma`,也可以如下声明`model`：

```prisma
model Org {
  id            Int    @id @default(autoincrement())
  name          String?
  treeId        Int?
  level         Int?
  leftValue     Int?
  rightValue    Int? 
 //   其他字段       
}
```

## 自定义

默认情况下，树表要求具有`id`、`level`、`leftValue`、`rightValue`、`name`这五个必须的关健字段，如果想在一个表中存储多棵树，同还需要加上`treeId`字段。

如果您想自定义关健字段,包括关健字段的类型，比如将使用`uuid`作为主键，`FlexTree`完全支持自定义。

请参考[自定义章节](./custom)介绍。