# sql.js

`flextree-sqljs-adapter` is the [sql.js](https://sql.js.org/) adapter for `flextree` — SQLite compiled to WebAssembly, **running trees in the browser**: no backend, no server; the whole tree lives in an in-memory database that can be exported as a snapshot to localStorage/IndexedDB or downloaded at any time.

Use cases: pure front-end apps (offline tools, demos, prototypes), local trees inside Electron/Webviews, and scenarios where all tree operations complete on the client before syncing back to a server.

## Installation

`sql.js` is a peerDependency and must be installed by the caller:

```bash
npm install flextree-sqljs-adapter sql.js
// or
yarn add flextree-sqljs-adapter sql.js
// or
pnpm add flextree-sqljs-adapter sql.js
// or
bun add flextree-sqljs-adapter sql.js
```

## Usage

The adapter uses the **injected-instance pattern**: sql.js initialization is asynchronous (the wasm must load first), and the correct `locateFile` setup varies by bundler (Vite/Webpack/Next.js) — those environment details belong to the caller; the adapter only receives an already-initialized `Database` instance. The instance's lifecycle (closing, etc.) is likewise managed by the caller.

```ts
import initSqlJs, { type Database } from "sql.js";
import FlexTreeSqljsAdapter from "flextree-sqljs-adapter";
import { FlexTreeManager } from "flextree";

// 1. Initialize sql.js (async: loads the wasm)
const SQL = await initSqlJs({
    // locateFile points to the wasm file; the exact form varies by bundler — see the sql.js docs
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
});

// 2. Create the in-memory database instance and inject it into the adapter
const db = new SQL.Database();
const adapter = new FlexTreeSqljsAdapter(db);

// 3. Use FlexTreeManager as usual
const tree = new FlexTreeManager("tree", { adapter });
await adapter.exec(`
    CREATE TABLE tree (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(60),
        treeId INTEGER,
        level INTEGER,
        leftValue INTEGER,
        rightValue INTEGER
    );
`);

await tree.write(async (t) => {
    await t.createRoot({ name: "root" });
    await t.addNodes([{ name: "A" }, { name: "B" }], { name: "root" });
});
```

The adapter's dialect is `sqlite` (sql.js is wasm SQLite), so SQL generation matches `flextree-sqlite-adapter`.

## Persistence: the onPersist hook

sql.js is a **pure in-memory database** — writes are not persisted to disk automatically. The adapter provides the `onPersist` hook as the unified persistence moment — it is `await`ed **only after a transaction containing writes commits successfully**; rollbacks and read-only transactions never trigger it. When to export (`db.export()`) and where to store it are entirely up to the caller:

```ts
const adapter = new FlexTreeSqljsAdapter(db, {
    // Snapshot to localStorage after every committed write
    onPersist: (db) => {
        const data = db.export(); // Uint8Array
        localStorage.setItem("tree-snapshot", toBase64(data));
    },
});
```

Common persistence targets:

```ts
// IndexedDB (large capacity, good for big trees)
onPersist: async (db) => {
    await idbPut("flextree", "tree-snapshot", db.export());
},

// Download as a .sqlite file
onPersist: (db) => {
    download(new Blob([db.export()]), "tree.sqlite");
},
```

To restore, feed the snapshot back into a new instance (typically after initSqlJs and before creating the manager):

```ts
const db = new SQL.Database(savedUint8Array); // rebuild the in-memory db from the snapshot
```

### FlexTreeSqljsPersistError

When `onPersist` throws, **the transaction has already committed** — the in-memory state is updated; only the snapshot failed to persist. The error is wrapped in `FlexTreeSqljsPersistError` and re-thrown so callers can distinguish two failure kinds:

| Failure | Transaction state | Recovery |
| --- | --- | --- |
| `onPersist` throws (`FlexTreeSqljsPersistError`) | Committed; in-memory state intact | Retry the snapshot (`db.export()`) — no need to redo the business writes |
| `write` callback throws | Rolled back | Retry the entire `write` |

## Transaction behavior

- `transaction` wraps the callback in explicit `BEGIN`/`COMMIT`/`ROLLBACK`; atomicity matches server-side SQLite.
- Nested calls reuse the outer transaction (multiple operations inside `write` share one transaction).
- `exec` outside a transaction (e.g. table creation at startup) does not participate in the dirty check and never triggers `onPersist`.

## Notes

- **Multiple tabs**: sql.js snapshots are whole-database overwrites; each browser tab holds its own independent in-memory database, unaware of the others — sharing one tree across tabs requires your own synchronization (e.g. BroadcastChannel), or a server-side approach.
- **Snapshot size**: `db.export()` exports the entire database. For large trees with frequent writes, throttle/debounce inside onPersist, or export manually at suitable business moments (omit `onPersist` and call `db.export()` yourself when needed).
- **Wasm loading**: `initSqlJs` needs to load `sql-wasm.wasm`; the `locateFile` setup differs per bundler — see the [official sql.js documentation](https://sql.js.org/).
