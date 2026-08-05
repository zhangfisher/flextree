# Creating a Tree

`FlexTree` is a tree storage repository based on the Left-Right Value algorithm. Trees are persisted in database tables, so **creating a tree means creating a database table that follows a set of format conventions**.

## Table Structure

By default, `FlexTree` requires every tree table to have at least the following fields

| Field Name | Data Type | Description |
| ----  |  ---- | ---- | 
| `id`  | `number` | Primary key |
| `name`  | `string` | Node name |
| `level`| `number` | Node level; `0` indicates the root node, `1-N` indicates the Nth level |
| `leftValue` | `number` | Left value | 
| `rightValue` | `number` | Right value | 
| `treeId` | `number` | Optional; used to distinguish different trees in a multi-tree table | 



## Creating the Table

The database table that stores the tree is **created by the application itself**; `FlexTree` does not create the database table.

Generally, you can create it with `SQL` like the following:

```sql
    CREATE TABLE IF NOT EXISTS  org (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(60),  
        level INTEGER,  
        leftValue INTEGER, 
        rightValue INTEGER,
        -- Other fields       
```

If you are using `prisma`, you can also declare the `model` like this:

```prisma
model Org {
  id            Int    @id @default(autoincrement())
  name          String?
  treeId        Int?
  level         Int?
  leftValue     Int?
  rightValue    Int? 
 //   Other fields       
}
```

## Customization

By default, a tree table is required to have the five key fields `id`, `level`, `leftValue`, `rightValue`, and `name`. To store multiple trees in a single table, you additionally need the `treeId` field.

If you want to customize the key fields — including their types, for example using `uuid` as the primary key — `FlexTree` fully supports customization.

See the [Customization](./custom) section for details.
