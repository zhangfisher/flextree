# 多树表

在基于左右值的树表中，每棵树只能有一个唯一的根节点。通过`FlexTree`和`FlexTreeManager`均只能管理一棵树。


如果有多棵树，即有多个根节点，则可能通过以下方式来实现：

## 第1步: 创建多树表

多树表是一种特殊的树表，它可以同时展示多棵树。多树表的每一列都可以展示一棵树，这些树之间是相互独立的，互不影响。

多树表需要增加一个额外的字段`treeId`来区分不同的树。

```prisma

model Org {
  id            Int    @id @default(autoincrement())
  name          String?
  treeId        Int?  // [!code ++]
  level         Int?
  leftValue     Int?
  rightValue    Int? 
 //   其他字段       
}

```

## 第2步: 创建多树对象

在创建`FlexTree`或`FlexTreeManager`时，需要指定`treeId`字段的值。

```ts

const tree = new FlexTreeManager('org', {
    adapter: new PrismaAdapter(prisma), 
    treeId:1   // [!code ++]
})

const tree = new FlexTree('tree', {
    adapter: new PrismaAdapter(prisma), 
    treeId:2  // [!code ++]
})
```

- **说明**

    - `treeId`既可以是数字，也可以是字符串。当使用字符串`treeId`时，数据库表中对应的`treeId`字段类型应为字符串类型（如`VARCHAR`）。

```ts
// 字符串 treeId 示例
const treeB = new FlexTreeManager('org', {
    adapter: new PrismaAdapter(prisma),
    treeId: "company-a"   // 使用字符串作为 treeId
})
```

