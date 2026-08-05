# sqlite

`flextree-sqlite-adapter` is the `sqlite` database adapter for `flextree`, used to translate `flextree` operations into `sqlite` database operations.

## Install

`better-sqlite3` is a peerDependency and must be installed by the consumer:

```bash

npm install flextree-sqlite-adapter better-sqlite3
// or
yarn add flextree-sqlite-adapter better-sqlite3
// or
pnpm add flextree-sqlite-adapter better-sqlite3
// or
bun add flextree-sqlite-adapter better-sqlite3
```

> The adapter no longer bundles `better-sqlite3`, so installing `flextree-sqlite-adapter` does not trigger native module compilation; `better-sqlite3` is installed on demand by the consumer.

## Usage

The adapter no longer creates the database connection itself. Pass an already-created `better-sqlite3` Database instance to the constructor; the connection lifecycle (open/close) is managed by the caller.

```ts

import Database from 'better-sqlite3'
import SqliteAdapter from 'flextree-sqlite-adapter'

// The caller creates and owns the database instance
const db = new Database('tree.db')
const sqliteDriver = new SqliteAdapter(db)

const tree = new FlexTreeManager('tree', {
    adapter: sqliteDriver,
})

```
