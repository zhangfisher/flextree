# sqlite

`flextree-sqlite-adapter`是`flextree`的`sqlite`数据库适配器，用于将`flextree`的操作转换为`sqlite`数据库操作。

## 安装

`better-sqlite3` 作为 peerDependency，需由调用方自行安装：

```bash

npm install flextree-sqlite-adapter better-sqlite3
// or
yarn add flextree-sqlite-adapter better-sqlite3
// or
pnpm add flextree-sqlite-adapter better-sqlite3
// or
bun add flextree-sqlite-adapter better-sqlite3
```

> 适配器自身不再捆绑 `better-sqlite3`，因此安装 `flextree-sqlite-adapter` 时不会触发原生模块的编译；`better-sqlite3` 由使用方按需安装即可。

## 使用

适配器不再自行创建数据库连接，构造时需传入已创建的 `better-sqlite3` Database 实例，连接的生命周期（打开/关闭）由调用方管理。

```ts

import Database from 'better-sqlite3'
import SqliteAdapter from 'flextree-sqlite-adapter'

// 由调用方创建并管理数据库实例
const db = new Database('tree.db')
const sqliteDriver = new SqliteAdapter(db)

const tree = new FlexTreeManager('tree', {
    adapter: sqliteDriver,
})

```
