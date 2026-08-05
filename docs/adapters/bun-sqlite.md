# Bun SQLite

`flextree-bun-sqlite-adapter`是基于 Bun 内置的[`bun:sqlite`](https://bun.sh/docs/api/sqlite)的`FlexTree`适配器，适用于 Bun 运行时，无需额外安装原生依赖。

## 安装

```bash
bun add flextree-bun-sqlite-adapter
// or
npm install flextree-bun-sqlite-adapter
// or
yarn add flextree-bun-sqlite-adapter
// or
pnpm add flextree-bun-sqlite-adapter
```

## 使用

构造`BunSqliteAdapter`时，可以传入一个数据库文件路径、一个已有的`Database`实例，或不传参（默认使用内存数据库）。

```ts
import { FlexTreeManager } from 'flextree'
import BunSqliteAdapter from 'flextree-bun-sqlite-adapter'

// 1. 内存数据库（默认）
const adapter = new BunSqliteAdapter()
await adapter.open()

// 2. 文件数据库
const fileAdapter = new BunSqliteAdapter('tree.db')
await fileAdapter.open()

// 3. 外部传入已有的 Database 实例（无需再调用 open）
import { Database } from 'bun:sqlite'
const externalAdapter = new BunSqliteAdapter(new Database('tree.db'))

const tree = new FlexTreeManager('tree', { adapter })
```

:::tip 提示
- 不传参或传入文件路径时，需要调用`await adapter.open()`打开数据库；传入已有的`Database`实例时则无需再次打开。
- 适配器内部使用显式`BEGIN`/`COMMIT`/`ROLLBACK`管理事务，并在嵌套调用时复用外层事务，保障写操作的原子性。
:::
