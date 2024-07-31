# sqlite

`flextree-sqlite-adapter`是`flextree`的`sqlite`数据库适配器，用于将`flextree`的操作转换为`sqlite`数据库操作。

## 安装

```bash

npm install flextree-sqlite-adapter
// or
yarn add flextree-sqlite-adapter
// or
pnpm add flextree-sqlite-adapter
```

## 使用

```ts

import SqliteAdapter from 'flextree-sqlite-adapter'
const sqliteDriver = new SqliteAdapter()
await sqliteDriver.open()

const tree = new FlexTree('tree', {
    adapter: sqliteDriver,
})

const tree = new FlexTreeManager('tree', {
    adapter: sqliteDriver,
})

```