# Bun SQLite

`flextree-bun-sqlite-adapter` is a `FlexTree` adapter based on Bun's built-in [`bun:sqlite`](https://bun.sh/docs/api/sqlite), designed for the Bun runtime with no need to install native dependencies.

## Install

```bash
bun add flextree-bun-sqlite-adapter
// or
npm install flextree-bun-sqlite-adapter
// or
yarn add flextree-bun-sqlite-adapter
// or
pnpm add flextree-bun-sqlite-adapter
```

## Usage

When constructing a `BunSqliteAdapter`, you can pass in a database file path, an existing `Database` instance, or no argument at all (an in-memory database is used by default).

```ts
import { FlexTreeManager } from 'flextree'
import BunSqliteAdapter from 'flextree-bun-sqlite-adapter'

// 1. In-memory database (default)
const adapter = new BunSqliteAdapter()
await adapter.open()

// 2. File database
const fileAdapter = new BunSqliteAdapter('tree.db')
await fileAdapter.open()

// 3. Pass in an existing Database instance (no need to call open)
import { Database } from 'bun:sqlite'
const externalAdapter = new BunSqliteAdapter(new Database('tree.db'))

const tree = new FlexTreeManager('tree', { adapter })
```

:::tip Note
- When no argument or a file path is provided, you must call `await adapter.open()` to open the database; when passing in an existing `Database` instance, you do not need to open it again.
- The adapter manages transactions internally using explicit `BEGIN`/`COMMIT`/`ROLLBACK`, and reuses the outer transaction on nested calls to guarantee the atomicity of write operations.
:::
