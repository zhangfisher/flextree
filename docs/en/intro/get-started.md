# Quick Start

When developing a `Nodejs` application that needs to store a tree in a database, `FlexTree` is recommended.

`FlexTree` is a tree-storage management component based on the `Left-Right Value` algorithm. It provides efficient tree-structure storage and access and supports a full range of tree operations such as CRUD, traversal, move, and query.

In this tutorial, we'll use developing an organization-chart manager as an example to demonstrate how to use `FlexTree`.

A simple organization chart tree looks like this:

<LiteTree>
- A公司
    + 行政中心
        总裁办              
        人力资源部
        财务部              
        行政部              
        法务部
        审计部              
        信息中心            
    + 市场中心
        市场部
        销售部
        客服部
        品牌部
        市场策划部
        市场营销部
    + 研发中心
        移动研发部
        平台研发部
        测试部    
        运维部    
        产品部
        设计部
</LiteTree>

:::warning Note

This website is built with `vitepress`, and the tree above is rendered by the open-source library [LiteTree](https://zhangfisher.github.io/lite-tree/).

:::


## Step 1: Install the Core Library

First, install the `flextree` core library.

```ts
npm install flextree
// or
yarn add flextree
// or
pnpm add flextree
// or
bun add flextree
```

## Step 2: Configure a Database Adapter

Next, install the database driver `flextree-sqlite-adapter`. `flextree` supports any database for storage; here we use `sqlite3` as an example.

You need to install the `flextree-sqlite-adapter` driver.

```ts
npm install flextree-sqlite-adapter
// or
yarn add flextree-sqlite-adapter
// or
pnpm add flextree-sqlite-adapter
// or
bun add flextree-sqlite-adapter
```

`flextree-sqlite-driver` is the `sqlite3` database driver for `flextree`, storing data in a `sqlite3` database.

:::warning Note
If you are using a database such as `MySQL` or `PostgreSQL`, you can install the corresponding driver such as `flextree-prima-driver`, or build a custom driver based on the `IFlexTreeAdapter` provided by `flextree`.
:::


## Step 3: Create the Tree Table

Next, we need to create the **organization-chart tree table `org`** in the database.

If you are using an `sqlite` database, you can create the table with the following `sql` statement:

```ts
import SqliteAdapter from 'flextree-sqlite-adapter';

const sqliteAdapter = new SqliteAdapter("org.db")
await sqliteAdapter.open()
await sqliteAdapter.exec(`
    CREATE TABLE IF NOT EXISTS  org (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(60),  
        level INTEGER,  
        leftValue INTEGER, 
        rightValue INTEGER,
`)
```

Above, we created an `org` table with the following fields:

| Field | Type | Description |
| --- | --- | --- |
| `id` | INTEGER | Primary key, auto-increment |
| `name` | VARCHAR(60) | Name |
| `level` | INTEGER | Level |
| `leftValue` | INTEGER | Left value |
| `rightValue` | INTEGER | Right value |

In general, the fields above are required; you may add others based on your actual situation.

:::warning  Note
In general, creating the table is the application's responsibility—`flextree` does not create tables. This section only demonstrates the tree-table structure you need to create.
:::

## Step 4: Create the Tree Manager

Next, we create an organization-chart tree manager `OrgManager` to manage the organization tree.

```ts {7-9}
import { FlexTreeManager } from 'flextree';
import SqliteAdapter from 'flextree-sqlite-adapter';

const sqliteAdapter = new SqliteAdapter("org.db")
await sqliteAdapter.open()

const orgManager = new FlexTreeManager("org",{
    adapter: sqliteAdapter     
})
```

:::tip Note
It's recommended to create the manager via the singleton method `FlexTreeManager.getInstance("org", { adapter: sqliteAdapter })`—the same table name returns the same instance. See [Manager](../guide/manager.md) for details.
:::

## Step 5: Add Tree Nodes

Now we can start adding nodes to the organization tree.

```ts
// Create a root node
await orgManager.createRoot({
    name: "A公司"
})
// Add the first-level department child nodes of the organization
await orgManager.addNodes([
    { name: "行政中心" },
    { name: "市场中心" },
    { name: "研发中心"} 
])
 
// Add the department child nodes of 行政中心.
const node = await orgManager.findNode({name:"行政中心"})
await orgManager.addNodes( [
        { name: "总裁办" },
        { name: "人力资源部" },
        { name: "财务部" },
        { name: "行政部" },
        { name: "法务部" },
        { name: "审计部" }
    ],node)   // Add as child nodes of node
```

We can use the `addNodes` method to add nodes to the tree. `addNodes` supports batch addition and multiple forms of adding child nodes.

## Step 6: Access the Tree

Above we created a complete tree; next we can access it in two ways:

- Access the tree via `FlexTreeManager`
- Access the tree via the `FlexTree` object

### Getting Nodes

```ts
// Get all nodes
await orgManager.getNodes() 
// Limit by level—fetch only levels 1-3, excluding level 4 and below
await orgManager.getNodes(3) 
// Get a node by id
await orgManager.getNode(1) 
// Get the root node of the tree
await orgManager.getRoot()

// Get the node whose name is 行政中心
const node = await orgManager.findNode({name:"行政中心"})
// Get the children of the node <行政中心>
await orgManager.getChildren(node)
// Get all descendants of the node <行政中心>
await orgManager.getDescendants(node)
// Get all descendants of the node <行政中心>, including itself
await orgManager.getDescendants(node,{includeSelf:true})
// Get all descendants of the node <行政中心>, with a level limit
await orgManager.getDescendants(node,{level:2})
// Get the children of the node <行政中心>; level=1 is equivalent to fetching only direct children
await orgManager.getDescendants(node,{level:1})

// Get all ancestors of the node <行政中心>
await orgManager.getAncestors(node) 
// Get the parent of the node <行政中心>
await orgManager.getParent(node) 
// Get all siblings of the node <行政中心>
await orgManager.getSiblings(node)  
// Get all siblings of the node <行政中心>, including itself
await orgManager.getSiblings(node,{includeSelf:true})  
// Get the next sibling of the node <行政中心>
await orgManager.getNextSibling(node)
// Get the previous sibling of the node <行政中心>
await orgManager.getPrevSibling(node)
```

### Finding Nodes

```ts
// Find the node whose name is 行政中心; returns only the first matching node
await orgManager.findNode({name:"行政中心"})
// Find all nodes whose level=1
await orgManager.findNodes({level:1})
```

:::warning Note
`FlexTree` provides only simple query capabilities; for more complex queries, use your database's query features.
:::


### Moving Nodes

```ts
import { FirstChild, LastChild,PreviousSibling,NextSibling } from 'flextree'
const admin = await orgManager.findNode({name:"行政中心"})
const market = await orgManager.findNode({name:"市场中心"})

// Move 行政中心 under 市场中心 as its last child
await orgManager.move(admin,market)  
await orgManager.move(admin,market,LastChild)  // Equivalent to the above
// Move 行政中心 under 市场中心 as its first child
await orgManager.move(admin,market,FirstChild)
// Move 行政中心 before 市场中心 as its previous sibling
await orgManager.move(admin,market,PreviousSibling)
// Move 行政中心 after 市场中心 as its next sibling
await orgManager.move(admin,market,NextSibling)

// Move 行政中心 up
await orgManager.moveUpNode(admin)  
// Move 行政中心 down
await orgManager.moveDownNode(admin)  
```

### Deleting Nodes

```ts
const admin = await orgManager.findNode({name:"行政中心"})
// Delete the 行政中心 node and all its descendants
await orgManager.deleteNode(admin)
// Clear the tree
await orgManager.clear()  
```


### Querying Node Relations

```ts

const admin = await orgManager.findNode({name:"行政中心"})
const market = await orgManager.findNode({name:"市场中心"})

// Return the relation between the admin node and the market node
const relation = await getNodeRelation(admin,market)

// Possible values of relation
export enum FlexTreeNodeRelation {
    Self = 0,
    Parent = 1,
    Child = 2,
    Siblings = 3,
    Descendants = 4,
    Ancestors = 5,
    DiffTree = 6,
    SameTree = 7,
    SameLevel = 8,
    Unknow = 9,
} 
 
```
