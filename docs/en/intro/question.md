# FAQ

## What scenarios is FlexTree suited for? When should I avoid it?

`FlexTree` is a **query-first** (read-optimized) storage structure, best suited for **read-heavy, write-light** tree-shaped data, such as:

- Organization and department hierarchies
- Product or content category trees
- Navigation menus
- Threaded comments
- File-system directories

Because every add, delete, or move operation requires rebalancing the left/right values of related nodes (potentially affecting `1-N` rows), it is **not ideal for high-frequency writes or frequent structural changes**—a traditional adjacency list may be a better fit there.

See [Features](./features.md).

## Why doesn't FlexTree support concurrent writes?

`FlexTree` is built on the left/right value algorithm, and the correctness of the tree structure **strictly depends on the consistency of all nodes' left/right values**. If two write operations run concurrently, each would read the other's uncommitted intermediate state, corrupting the left/right values and damaging the tree.

Therefore, a single tree allows **only one write operation at a time**; concurrent writes are rejected and throw an exception. Reads may run concurrently, but while a write is in progress, concurrent reads from outside automatically wait for it to finish, preventing them from seeing intermediate states.

This is an inherent constraint of the left/right value algorithm, not an implementation flaw.

## Can I modify the tree table directly with SQL?

**No.** Any operation that bypasses `FlexTree` and modifies the tree table directly via `SQL`—especially changes to the `leftValue`, `rightValue`, or `level` fields—can corrupt the tree structure.

Always operate on the tree through the methods provided by `FlexTreeManager` (`addNodes`, `deleteNode`, `moveNode`, etc.). These methods maintain the consistency of the left/right values internally and are wrapped in a transaction.

If you have already modified the table directly and damaged the structure, use [`verify`](../guide/verify.md) to detect issues and [`repair`](../guide/repair.md) to rebuild it.

## What are left/right values, and why are queries so fast?

`FlexTree` adopts the **Nested Set Model**, assigning each node two integer fields: `leftValue` and `rightValue`. A node's left/right values form an interval: **all descendants of a node have left/right values that fall within that node's interval**.

As a result, relationship queries such as descendants, ancestors, children, and siblings all reduce to **range queries** on the left/right values—each completes in a single `SQL` statement, **with no recursion**. The deeper the tree, the greater the advantage over the adjacency list's recursive queries.

See [How It Works](./principle.md).

## What should I do if the tree structure gets corrupted?

`FlexTreeManager` provides verification and repair capabilities:

- **[`verify`](../guide/verify.md)**: verifies tree-structure integrity via pure `SQL` (node count, value completeness, level relationships, etc.) without loading all nodes into memory—suitable for large trees.
- **[`repair`](../guide/repair.md)**: when `verify` detects corruption, this rebuilds the damaged left/right values and levels.

::: tip Recommendation
In production, if you suspect the tree table has been modified by an external program (e.g., direct SQL operations or a database fault), run `verify` periodically—or after an incident—as a health check.
:::

## How do I store multiple trees in a single table?

`FlexTree` supports **multiple trees in a single table**: add a `treeId` field to the table to distinguish different trees, and specify which tree a `FlexTreeManager` manages via the `treeId` option when creating it.

```ts
const treeA = new FlexTreeManager('org', {
    adapter,
    treeId: 1,        // numeric treeId
})

const treeB = new FlexTreeManager('org', {
    adapter,
    treeId: 'dept-x', // string treeId
})
```

`treeId` can be either a number or a string. When using a string `treeId`, the corresponding `treeId` column in the table should be a string type (e.g., `VARCHAR`).

See [Multi-Tree Table](../guide/multitree.md).

## Why is the singleton pattern recommended for creating managers?

Because the Nested Set Model strictly depends on left/right values, `FlexTree` **forbids concurrent writes and direct SQL modifications**. If you create multiple `FlexTreeManager` instances for the same tree table within an application, they cannot be aware of each other and easily trigger write conflicts.

Therefore, it is strongly recommended to keep **only one `FlexTreeManager` instance per tree table** across the entire application, obtained via the static method `FlexTreeManager.getInstance(tableName, options)`—the same table name always returns the same instance.

```ts
const a = FlexTreeManager.getInstance('filesys', { adapter })
const b = FlexTreeManager.getInstance('filesys', { adapter })
// a === b (the same instance)
```

See [Tree Manager](../guide/manager.md).

## Do left/right values have an upper limit? Can FlexTree handle very large trees?

`leftValue` and `rightValue` are integer fields, so they are theoretically bounded by the integer range. A single tree may hit this limit when its node count approaches the integer maximum.

In practice, however, this is **rarely encountered**—the vast majority of tree-shaped data (org charts, categories, menus) are far below this limit. If your scenario involves extremely large trees, consider splitting by `level` or using multiple trees in a single table (`treeId`).

See [Features](./features.md).

## Why are pid-based adjacency-list trees query-unfriendly—and impossible to optimize?

An adjacency list stores only a `pid` pointing to each node's **direct parent**—that is, just a "one-hop" parent-child relationship. But tree queries (descendants, ancestors, subtrees) need **arbitrary-depth transitive relationships**, which the adjacency list **does not store at all**. They must be rebuilt at query time by walking the `pid` chain level by level. This is the root cause of its query-unfriendliness.

**How it shows up in practice:**

- **Fetching descendants / ancestors requires recursion.** For example, "get all descendants of a node"—since the tree depth is unknown upfront, standard `SQL` cannot express it in a single statement; you're forced into application-level loops or repeated self-joins.
- **`WITH RECURSIVE` doesn't save you.** A recursive CTE can express arbitrary depth, but it's essentially level-by-level iteration—depth `N` means `N` iterations. Compatibility is also poor (older MySQL, older SQLite), and database optimizers have very limited ability to optimize it.

**Why it's "impossible to optimize"—this is dictated by the storage model, not by engineering:**

- An index on `pid` (B-tree) only speeds up a **single hop**—quickly locating the "direct children." But **an index cannot span depth**: every level deeper requires another index lookup, so fetching `N` levels of descendants means `N` index accesses that cannot be collapsed into a single range scan.
- Fundamentally, the adjacency list **encodes no global information** (no depth, no path, no interval), so querying a deep relationship forces you to **compute that information on the spot**. No amount of indexing or tuning can bypass the "walk the chain" step.

::: tip Compared with FlexTree
`FlexTree` uses `leftValue` / `rightValue` to **encode the ancestor-descendant relationship into the magnitude of two integers**: a descendant's left/right values always fall within the ancestor's interval. So fetching descendants reduces to a single **range query** that uses the index, completes in one `SQL` statement, and runs in `O(log N + result size)`—independent of tree depth.

The two models are a classic **write-vs-query tradeoff**: the adjacency list writes fast (change one `pid`) but queries slowly; FlexTree writes slowly (it must rebalance left/right values) but queries fast. FlexTree is designed precisely for **read-heavy, write-light** scenarios.
:::

See [How It Works](./principle.md) for a detailed comparison with the adjacency list.

## How do I use FlexTree with different database access frameworks? Is writing an adapter hard?

`FlexTree` fully decouples tree logic from database access through the **adapter pattern**: `FlexTreeManager` only generates `SQL`, while **all database interaction is delegated to an adapter** (`IFlexTreeAdapter`). So no matter whether you use a raw driver, an ORM, or a query builder, you just write an adapter to bridge them.

**Writing an adapter is very simple**—the interface has only a handful of methods:

```ts
interface IFlexTreeAdapter {
    connected: boolean                                              // whether the db is connected
    type?: DatabaseType                                             // database dialect type
    bind: (treeManager: FlexTreeManager) => void
    open: (config?: any) => Promise<any>                            // initialize the connection
    exec: (sqls: string | string[]) => Promise<void>                // execute writes (no transaction of its own)
    getRows: (sql: string) => Promise<any[]>                        // query multiple rows
    getScalar: <T = number>(sql: string) => Promise<T>              // query a single scalar
    transaction: (callback: () => Promise<void>) => Promise<void>   // transaction: carries write atomicity
}
```

**Why is it simple?** Because the adapter **only executes SQL—it doesn't generate it**. `FlexTree` ships with a multi-dialect `SQL` generator (supporting the differences between `SQLite`, `MySQL`, `PostgreSQL`, `Oracle`, `SQL Server`, etc.). All left/right value computation and escaping are already handled by `FlexTreeManager`; the adapter simply receives ready-to-execute `SQL`.

The one thing the adapter must implement itself is **`transaction`**—it carries write atomicity: `FlexTreeManager`'s `write(fn)` calls `transaction` to wrap `fn`'s multiple operations into a single transaction that rolls back entirely on any failure. Fortunately it's usually just a thin wrapper around `BEGIN` / `COMMIT` / `ROLLBACK` (mind nested calls—the inner one should reuse the outer transaction rather than opening a new one).

Here is a minimal example bridging a hand-written database driver:

```ts
// @noErrors
import { FlexTreeManager } from 'flextree'
import type { IFlexTreeAdapter } from 'flextree'

class MyAdapter implements IFlexTreeAdapter {
    connected = false
    db: any
    type = 'sqlite' as const              // tell FlexTree which SQL dialect to generate

    async open() {
        // Initialize your database connection, e.g.:
        // this.db = await createMyDbConnection()
        this.connected = true
    }

    bind() { /* usually left empty */ }

    async exec(sqls) {
        // Execute writes (atomicity is guaranteed by the outer transaction; exec itself carries no transaction)
        for (const sql of ([] as string[]).concat(sqls)) {
            await this.db.run(sql)
        }
    }

    async getRows(sql) {
        return this.db.all(sql)           // return multiple rows
    }

    async getScalar<T>(sql: string): Promise<T> {
        const rows = await this.db.all(sql)
        return Object.values(rows[0])[0] as T   // return first row, first column
    }

    private _inTx = false
    async transaction(callback: () => Promise<void>) {
        // Wrap the callback with BEGIN/COMMIT/ROLLBACK: atomic commit, full rollback on error
        if (this._inTx) {                 // nested call: reuse the outer transaction
            await callback()
            return
        }
        this._inTx = true
        await this.db.run('BEGIN')
        try {
            await callback()
            await this.db.run('COMMIT')
        } catch (e) {
            await this.db.run('ROLLBACK')
            throw e
        } finally {
            this._inTx = false
        }
    }
}

// Usage: exactly the same as the built-in adapters
const tree = new FlexTreeManager('my_tree', {
    adapter: new MyAdapter(),
})
```

**Built-in adapters** already cover common scenarios—you can use them directly or as references:

- `flextree-sqlite-adapter` (based on better-sqlite3)
- `flextree-prisma-adapter` (based on Prisma ORM)
- `flextree-bun-sqlite-adapter` (based on Bun's built-in sqlite)

See [Database Adapters](../guide/adapters.md).
