
[Home](https:/github.com/zhangfisher/flextree) | [简体中文](./readme_cn.md)  

`FlexTree` is a tree storage and management component based on the `left-right` algorithm, which provides efficient tree structure storage and access, and supports a variety of tree operations such as add, delete, modify, query, traversal, and movement.

**Features**

- based on the `Nested Set Model`, efficient tree structure storage and access.
- simple and easy-to-use `API`
- rich tree operations, such as `add`, `delete`, `modify`, `query`, `traversal`, `movement`, etc.
- developed using `TypeScript`, providing complete and friendly type definitions
- supports any database storage, such as `SQLite`, `MySQL`, `PostgreSQL`, etc.
- `95%+` test coverage to ensure code quality
- suitable for `Node.js` environment

# Nested Set Model 

When developing `Nodejs` applications, when you need to store trees in the database, there are several common storage structures:

- Adjacency List Structure
- Path Enumeration Structure
- Nested Tree Structure
- Closure Table Structure

Each algorithm has its own advantages and disadvantages, and the appropriate algorithm should be chosen based on the actual application scenario.

`Nested Set Model` (also known as `Left-Right Value` model) is a method used to store tree structure data, represented by two fields (commonly referred to as `lft` and `rgt`) indicating the position of nodes in the tree.

In the Nested Set Model, the `lft` value of each node is less than the `lft` values of all its descendants, and the `rgt` value is greater than the `rgt` values of all its descendants. This allows us to retrieve all descendants of a node with a simple query by looking for all nodes whose `lft` and `rgt` values fall within this range.

The distribution of left and right values in the Nested Set Model is determined by `Depth-First Search` traversal. During the traversal, a `lft` value is assigned whenever entering a node, and an `rgt` value is assigned whenever leaving a node. Thus, the `lft` and `rgt` values of each node form an interval, and all values within this interval correspond to the node's descendants.

 
![](./docs/intro/lr.png)

eg:

| id | leftValue | rightValue | name |
|----|-----|-----|------|
| 1  | 1   | 14  | root |
| 2  | 2   | 9   | A    |
| 3  | 10  | 11  | B    |
| 4  | 12  | 13  | C    |
| 5  | 3   | 4   | A-1  |
| 6  | 5   | 6   | A-2  |
| 7  | 7   | 8   | A-3  |



<ul>
    <li>
        root
        <ul>
            <li>A
                <ul>
                    <li>A-1</li>
                    <li>A-2</li>
                    <li>A-3</li>
                </ul>
            </li>
            <li>B</li>
            <li>C</li>
    </li>
</ul>


# Getting Started

## Step 1: Install the core library


```ts
npm install flextree
// or
yarn add flextree
// or
pnpm add flextree
```

## Step 2: Configure the database adapter


Next, depending on how your application accesses the database, you need to install the corresponding database adapter.

In this example, we use `Sqlite`, and install the database adapter `flextree-sqlite-adapter`.
 
```ts
npm install flextree-sqlite-adapter
// or
yarn add flextree-sqlite-adapter
// or
pnpm add flextree-sqlite-adapter
```

`flextree-sqlite-adapter` is the `sqlite3` database driver for `flextree`, based on the `sqlite3` database storage.

If you are using a `MySQL`, `PostgreSQL`, or other database, you can install the corresponding driver, such as `flextree-prima-adapter`, or customize the driver based on the `IFlexTreeAdapter` provided by `flextree`.

## Step 3: Create a tree table

Next, we need to create a tree table in the database.

If you are using the `sqlite` database, you can use the following `sql` statement to create the table:

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


In general, the above fields are required, and you can add other fields as needed.


## Step 4: Create a tree manager

Next, we create a tree manager `OrgManager` to manage the tree.


```ts 
import { FlexTreeManager } from 'flextree';
import SqliteAdapter from 'flextree-sqlite-adapter';

const sqliteAdapter = new SqliteAdapter("org.db")
await sqliteAdapter.open()

const orgManager = new FlexTreeManager("org",{
    adapter: sqliteAdapter     
})
```


## Step 5: Add tree nodes

Then we can start adding nodes to the organization tree.


然后我们就可以开始向组织架构树中添加节点了。 

```ts
// create root node
await orgManager.createRoot({
    name: "Root"
})
// add child nodes to the root node
await orgManager.addNodes([
    { name: "A" },
    { name: "B" },
    { name: "C"} 
])
 
const node = await orgManager.findNode({name:"A"})
await orgManager.addNodes( [
        { name: "A1" },
        { name: "A2" },
        { name: "A3" },
        { name: "A4" }
    ],node)   

```

Above, we created a complete tree structure, with the root node `Root`, and three child nodes `A`, `B`, and `C` under the root node, and four child nodes `A1`, `A2`, `A3`, and `A4` under the `A` node.
 
we can use the `addNodes` method to add nodes to the tree, which supports batch addition of nodes and multiple forms of adding child nodes.

## Step 6: Access the tree

above, we have created a complete tree, and we can access the tree in two ways.

- `FlexTreeManager`
- `FlexTree`


### 获取节点

```ts
// get all nodes
await orgManager.getNodes() 
// get nodes at level 1-3, excluding nodes at level 4 and below
await orgManager.getNodes(3) 
// get node by id
await orgManager.getNode(1) 
// get root node
await orgManager.getRoot()

// get node by name
const node = await orgManager.findNode({name:"A"})
// get node's children
await orgManager.getChildren(node)
// get node's descendants
await orgManager.getDescendants(node)
// get node's descendants, including itself
await orgManager.getDescendants(node,{includeSelf:true})
// get node's descendants, level=2 is equivalent to only get direct child nodes
await orgManager.getDescendants(node,{level:2})
// get node's descendants, level=1 is equivalent to only get direct child nodes
await orgManager.getDescendants(node,{level:1})

// get node's ancestors
await orgManager.getAncestors(node) 
// get node's parent
await orgManager.getParent(node) 
// get node's siblings
await orgManager.getSiblings(node)  
// get node's siblings, including itself
await orgManager.getSiblings(node,{includeSelf:true})  
// get node's next sibling
await orgManager.getNextSibling(node)
// get node's previous sibling
await orgManager.getPrevSibling(node)

```

### Find node

```ts
await orgManager.findNode({name:"A"})
await orgManager.findNodes({level:1})
```

### Move node

```ts
import { FirstChild, LastChild,PreviousSibling,NextSibling } from 'flextree'
const admin = await orgManager.findNode({name:"admin"})
const market = await orgManager.findNode({name:"market"})

//  move admin node to market node
await orgManager.move(admin,market)  
await orgManager.move(admin,market,LastChild)   
//  move admin node to market node, and become the first child node
await orgManager.move(admin,market,FirstChild)
// move admin node to market node, and become the last child node
await orgManager.move(admin,market,PreviousSibling)
// move admin node to market node, and become the previous sibling node
await orgManager.move(admin,market,NextSibling)

// move admin node up
await orgManager.moveUpNode(admin)  
// move admin node down
await orgManager.moveDownNode(admin)  

```

### Delete node

```ts
const admin = await orgManager.findNode({name:"admin"})
// delete admin node
await orgManager.deleteNode(admin)
// delete all nodes
await orgManager.clear()  
```

### Query node relation

```ts

const admin = await orgManager.findNode({name:"admin"})
const market = await orgManager.findNode({name:"market"})

// get the relationship between admin and market nodes
const relation = await getNodeRelation(admin,market)

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

# Recommendation

- [Internationalization Solution for React/Vue/Nodejs/Solidjs - VoerkaI18n](https://zhangfisher.github.io/voerka-i18n/)
- [React Form Development Library - speedform](https://zhangfisher.github.io/speed-form/)
- [Terminal Interface Development Enhancement Library - Logsets](https://zhangfisher.github.io/logsets/)
- [Log Output Library  - VoerkaLogger](https://zhangfisher.github.io/voerkalogger/)
- [Decorator Development - FlexDecorators](https://zhangfisher.github.io/flex-decorators/)
- [Finite State Machine Library  - FlexState](https://zhangfisher.github.io/flexstate/)
- [Universal Function Tool Library - FlexTools](https://zhangfisher.github.io/flex-tools/)
- [CSS-IN-JS Library  - Styledfc](https://zhangfisher.github.io/styledfc/)
- [VSCode Plugin for Adding Comments to JSON Files - json_comments_extension](https://github.com/zhangfisher/json_comments_extension)
- [Library for Developing Interactive Command Line Programs  - mixed-cli](https://github.com/zhangfisher/mixed-cli)
- [Powerful String Interpolation Variable Processing Tool Library - flexvars](https://github.com/zhangfisher/flexvars)
- [Frontend Link Debugging Assistant Tool - yald](https://github.com/zhangfisher/yald)
- [Asynchronous Signal - asyncsignal](https://github.com/zhangfisher/asyncsignal)
- [bundle Vue styles into JavaScript - vite-plugin-vue-style-bundler ](https://github.com/zhangfisher/vite-plugin-vue-style-bundler)
- [Tree Component- LiteTree](https://github.com/zhangfisher/lite-tree)