# 快速使用

开发`Nodejs`应用时，当需要在数据库中存储树时，推荐使用`FlexTree`。

`FlexTree`是一款基于`左右值`算法的树存储管理组件，提供了高效的树结构存储和访问，支持多种树操作，如增删改查、遍历、移动、查询等。

在本教程中，我们以开发下组织架构的管理为例，演示如何使用`FlexTree`。

一个简单的组织架构树如下：

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

> 以上树的显示采用开源库[LiteTree](https://zhangfisher.github.io/lite-tree/)实现。


## 第1步：安装核心库

首先安装`flextree`核心库。

```ts
npm install flextree
// or
yarn add flextree
// or
pnpm add flextree
```

## 第2步：配置数据库适配器

接下来，安装数据库安装`flextree-sqlite-adapter`，`flextree`支持任意数据库存储，这里我们以`sqlite3`为例。

需要安装`flextree-sqlite-adapter`驱动

```ts
npm install flextree-sqlite-adapter
// or
yarn add flextree-sqlite-adapter
// or
pnpm add flextree-sqlite-adapter
```

`flextree-sqlite-driver`是`flextree`的`sqlite3`数据库驱动，基于`sqlite3`数据库存储。

:::warning 提示
如果你使用的是`MySQL`、`PostgreSQL`等数据库，可以安装对应的驱动，如`flextree-prima-driver`，或者基于`flextree`提供的`IDatabaseDriver`自定义驱动。
:::


## 第3步：创建树表

接下来，我们需要在数据库中创建**组织架构树表`org`**。

如果你使用的是`sqlite`数据库，可以使用以下`sql`语句创建表：

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

以上，我们他创建了一个`org`表，包含以下字段：

| 字段名 | 类型 | 说明 |
| --- | --- | --- |
| `id` | INTEGER | 主键,自增 |
| `name` | VARCHAR(60) | 名称 |
| `level` | INTEGER | 层级 |
| `leftValue` | INTEGER | 左值 |
| `rightValue` | INTEGER | 右值 |

一般情况下，以上字段是必须的，你可以根据实际情况添加其他字段。

:::warning  提示
一般情况下，创建表是由应用程序自行完成的,`flextree`不负责创建表。本节仅演示需要创建的树表结构。
:::

## 第4步：创建树管理器

接下来，我们创建一个组织架构树管理器`OrgManager`，用于管理组织架构树。

```ts {7-9}
import { FlexTreeManager } from 'flextree';
import SqliteAdapter from 'flextree-sqlite-adapter';

const sqliteAdapter = new SqliteAdapter("org.db")
await sqliteAdapter.open()

const orgManager = new FlexTreeManager("org",{
    adapter: sqliteAdapter     
})
```

## 第5步：添加树节点

然后我们就可以开始向组织架构树中添加节点了。 

```ts
// 创建一个根节点
await orgManager.createRoot({
    name: "A公司"
})
// 添加组织架构的一级部门子节点
await orgManager.addNodes([
    { name: "行政中心" },
    { name: "市场中心" },
    { name: "研发中心"} 
])
 
// 添加行政中心的部门子节点.
const node = await orgManager.findNode({name:"行政中心"})
await orgManager.addNodes( [
        { name: "总裁办" },
        { name: "人力资源部" },
        { name: "财务部" },
        { name: "行政部" },
        { name: "法务部" },
        { name: "审计部" }
    ],node)   // 添加为node的子节点

```
 
我们可以使用`addNodes`方法向树中添加节点，`addNodes`方法支持批量添加节点，支持多种形式的添加子节点。
 
## 第6步：访问树

以上我们已经创建了一棵完整的树，接下来我们可以通过两种形式来访问树。

- 通过`FlexTreeManager`访问树
- 通过`FlexTree`对象访问树

### 获取节点

```ts
// 获取所有节点
await orgManager.getNodes() 
// 限定层级获取节点，仅获取第1-3层节点，不包含第4层及以下节点
await orgManager.getNodes(3) 
// 根据id获取节点
await orgManager.getNode(1) 
// 获取树根节点
await orgManager.getRoot()

// 获取name=行政中心的节点
const node = await orgManager.findNode({name:"行政中心"})
// 获取节点<行政中心>的子节点集
await orgManager.getChildren(node)
// 获取节点<行政中心>的所有后代节点集
await orgManager.getDescendants(node)
// 获取节点<行政中心>的所有后代节点集，包括自身
await orgManager.getDescendants(node,{includeSelf:true})
// 获取节点<行政中心>的所有后代节点集，包括限定层级
await orgManager.getDescendants(node,{level:2})
// 获取节点<行政中心>的子节点集,level=1相当于只获取直接子节点
await orgManager.getDescendants(node,{level:1})

// 获取节点<行政中心>的所有祖先节点集
await orgManager.getAncestors(node) 
// 获取节点<行政中心>的父节点
await orgManager.getParent(node) 
// 获取节点<行政中心>的所有兄弟节点集
await orgManager.getSiblings(node)  
// 获取节点<行政中心>的所有兄弟节点集，包括自身
await orgManager.getSiblings(node,{includeSelf:true})  
// 获取节点<行政中心>的前一个兄弟节点
await orgManager.getNextSibling(node)
// 获取节点<行政中心>的后一个兄弟节点
await orgManager.getPrevSibling(node)

```

### 查找节点

```ts
// 查找name=行政中心的节点,只返回第一个满足条件的节点
await orgManager.findNode({name:"行政中心"})
// 查找所有level=1的节点集
await orgManager.findNodes({level:1})

```

:::warning 提示
`FlexTree`只提借供简单的查询功能，如果需要更复杂的查询，可以使用数据库的查询功能。
:::


### 移动节点

```ts
import { FirstChild, LastChild,PreviousSibling,NextSibling } from 'flextree'
const admin = await orgManager.findNode({name:"行政中心"})
const market = await orgManager.findNode({name:"市场中心"})

// 将行政中心移动到市场中心下，成为其最后一个子节点
await orgManager.move(admin,market)  
await orgManager.move(admin,market,LastChild)  // 与上面等价
// 将行政中心移动到市场中心下，成为其第一个子节点
await orgManager.move(admin,market,FirstChild)
// 将行政中心移动到市场中心前，成为其前一个兄弟节点
await orgManager.move(admin,market,PreviousSibling)
// 将行政中心移动到市场中心后，成为其后一个兄弟节点
await orgManager.move(admin,market,NextSibling)

// 将行政中心上移
await orgManager.moveUpNode(admin)  
// 将行政中心下移
await orgManager.moveDownNode(admin)  

```

### 删除节点

```ts
const admin = await orgManager.findNode({name:"行政中心"})
// 删除行政中心节点以及其所有后代节点
await orgManager.deleteNode(admin)
// 清空树
await orgManager.clear()  
```


### 查询节点关系

```ts

const admin = await orgManager.findNode({name:"行政中心"})
const market = await orgManager.findNode({name:"市场中心"})

// 返回admin节点与market节点的关系
const relation = await getNodeRelation(admin,market)

// relation取值范围
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
 