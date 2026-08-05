# Multi-Tree Tables

In tree tables based on left/right values, each tree can only have a single unique root node. Both `FlexTree` and `FlexTreeManager` can only manage one tree at a time.


If you have multiple trees, i.e. multiple root nodes, you can achieve this in the following way:

## Step 1: Create a Multi-Tree Table

A multi-tree table is a special kind of tree table that can present multiple trees at the same time. Each column in a multi-tree table can present a tree, and these trees are independent of each other and do not affect one another.

A multi-tree table requires an additional `treeId` field to distinguish between different trees.

```prisma

model Org {
  id            Int    @id @default(autoincrement())
  name          String?
  treeId        Int?  // [!code ++]
  level         Int?
  leftValue     Int?
  rightValue    Int? 
 //   Other fields       
}

```

## Step 2: Create Multi-Tree Objects

When creating a `FlexTree` or `FlexTreeManager`, you need to specify the value of the `treeId` field.

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

- **Notes**

    - `treeId` can be either a number or a string. When using a string `treeId`, the type of the corresponding `treeId` field in the database table should be a string type (such as `VARCHAR`).

```ts
// String treeId example
const treeB = new FlexTreeManager('org', {
    adapter: new PrismaAdapter(prisma),
    treeId: "company-a"   // Use a string as the treeId
})
```
