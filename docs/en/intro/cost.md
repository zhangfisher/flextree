FlexTree is based on the Nested Set Model (left-right values). Except for `repair` and `forEach`, **the number of database accesses for every tree operation is independent of the tree's size** — whether the tree holds a hundred or a million nodes, each operation performs a constant number of round trips and SQL statements. This is the core benefit of the algorithm choice: queries are coordinate-range filters (index-friendly), and writes are **set-based UPDATEs** (one SQL statement updating a group of rows) — row-by-row reading and writing never happens.

Counting notes (table conventions):

- **Round trips**: one database interaction (execution of one SQL statement). When N statements are submitted in batch inside a `write()` transaction, the actual round trips depend on the adapter implementation (better-sqlite3 in-memory vs. PostgreSQL over the network differ) — the tables count SQL statements.
- **Read preamble**: write operations must first read the target node's coordinates (`getNodeData`, 1 SELECT); with the recycle bin enabled, write paths additionally check the bin range (the range is cached in memory — only 1 SELECT on first load or after cache invalidation).
- **Locks**: all writes inside `write()` execute in an adapter transaction; lock scope = transaction scope (the same table). Reads take no locks (relying on the database's MVCC/snapshot isolation), but they pass through a **read guard** that waits for any in-progress write transaction to commit, avoiding intermediate-state reads.

## Read Operations

| API | SQL count | Notes |
| --- | --- | --- |
| `getRoot` / `hasRoot` | 1 | Located by `leftValue=1`, index hit |
| `getNode` / `findNode` / `findNodes` | 1 | Point/condition lookup; with the recycle bin enabled, the bin range filter is appended (still a single SQL) |
| `getNodes` | 1 | Full-tree/level-limited list, one SELECT (the NOT EXISTS ancestor-integrity check with `where` is in the same statement) |
| `getDescendants` / `getDescendantCount` | 1 | SELF-JOIN range query; returned rows scale with the subtree, but the SQL count is always 1 |
| `getChildren` / `getNthChild` | 1 | Same (level-limited/LIMIT); `getNthChild` uses `LIMIT 1 OFFSET n`, never fetching all children |
| `getAncestors` / `getAncestorsCount` / `getParent` | 1 | Reverse range query; `getParent` adds `LIMIT 1` |
| `getSiblings` / `getNextSibling` / `getPreviousSibling` | 1 | Same-level range / coordinate-adjacency query |
| `getNodeRelation` | 1~2 | Coordinate comparison can be resolved in memory (0); 1 more when sibling check is needed; passing ids adds 1 resolution |
| `forEach` (DFS/BFS) | per-node queries | **One callback = one node plus all its children**: for each visited node, one `getChildren` executes (a single SQL returning all direct children of that node, recycle-bin filter passed through), and the callback signature `(node, children)` receives the children list directly; total SQL = number of visited nodes (callback invocations). `forEach` is designed for traversing large tree tables: **memory usage is O(breadth), not O(node count)** — the BFS queue holds only the current level, and DFS releases each subtree as its callback finishes, so traversing millions of nodes never loads the tree into memory. Tree-shaped traversal inherently cannot be expressed in a single SQL; fetching each node's child level is a deliberate streaming design, not a deficiency |
| `toJson` / `toList` | 2 | `load` (1 full SELECT) + in-memory assembly |
| `verify` | 7 | Five integrity checks + uniqueness + level relations, one each, all evaluated at the database (no node data pulled) |

## Write Operations (all inside the `write()` transaction)

| API | Preamble reads | Write SQL | Total | Notes |
| --- | --- | --- | --- | --- |
| `createRoot` | 1 (hasRoot) | 1 INSERT | 2 | |
| `addNodes` (n nodes) | 1 | 3: 2 space-making UPDATEs (set-based, independent of n) + 1 multi-row INSERT | 4 | Batch insert in one statement |
| `update` | 0~1 (bin gate point check) | n UPDATEs | ≤ n+1 | One id-based UPDATE per node |
| `deleteNode` | 1 | 3: 1 DELETE (the whole subtree in one SQL) + 2 shrink UPDATEs | 4 | Subtree deletion is independent of subtree size |
| `deleteNode(recycle)` | 2 (node + bin) | same as `moveNode` | ≈10 | Logical deletion = moving into the bin, reusing the move algorithm |
| `moveNode` | 2 (source + dest) | 5~8: 3 detach (1 negate + 2 shrink) + 2~5 make-space/restore (same-tree); 7~9 cross-tree (quarantine two-phase shift adds 2) | 7~11 | All set-based UPDATEs, independent of subtree size; cross-tree, the treeId rewrite shares the same UPDATE as the coordinate restore (avoiding a unique-constraint intermediate state) |
| `moveUpNode` / `moveDownNode` | 1~2 | same as `moveNode` | ≈10 | Locates the prev/next sibling, then delegates to `moveNode` |
| `copyNode` | 2 (source + dest) | 5: 4 (INSERT...SELECT staging + 2 make-space + restore) + 1 copy-root lookup | 7 | INSERT...SELECT copies the whole subtree inside the database, never row by row |
| `clear()` | 0 | 1 DELETE | 1 | |
| `repair` | 1 (full SELECT) | m (nodes whose values changed) | m+1 | **The only size-dependent operation**: reads the whole tree → recomputes in memory → updates only changed rows; when nothing is broken, m=0 (0 UPDATEs) |
| `clearRecycleBin` | 1 (bin) + 1 per round | 3 × top-level subtrees in bin | ≈4×k | Deletes top-level subtrees one by one (re-reading coordinates each round for correctness) |

## Locks and Concurrency

| Scenario | Behavior |
| --- | --- |
| Write transaction | `write()` is serialized (re-entry on the same manager instance throws); lock scope = the rows touched by the transaction (row/page locking depends on the database engine) |
| Concurrent reads | Not blocked — but `_guardRead` makes reads outside the transaction wait for the in-progress write to commit, preventing reads of negated/mid-shift intermediate states |
| Multi-tree on one table | Write transactions of different `treeId`s still lock the same table (with row-level locking, rows of different trees don't conflict; under SQLite's whole-database lock they serialize) |
| Cross-tree move | Source tree and target tree are locked in the same transaction, keeping both coordinate changes atomic |

## Cost Summary

Complexity of each API summarized by tree size (n = node count, s = subtree size involved in the operation, b = branching width):

| Dimension | Constant cost (O(1) SQL) | Linear cost (O(n) or O(s)) |
| --- | --- | --- |
| SQL count | All point/range queries; `addNodes`/`deleteNode`/`moveNode`/`copyNode` (set-based writes) | `forEach` (O(n) streaming queries), `repair` (O(s) correction UPDATEs), `update` (O(batch size)), `clearRecycleBin` (O(top-level subtrees)) |
| Data transfer (rows returned) | `getNode`/`getRoot`/navigation (≤1 row) | `getNodes`/`getDescendants`/`toJson`/`toList` (the result set itself — that's the query semantics, not implementation overhead) |
| Application memory | All writes (set SQL loads no data), `forEach` (O(b) streaming) | `toJson`/`toList`/`FlexTree.load` (whole tree in memory), `repair` (whole tree in memory for recomputation) |
| Lock hold time | Single-point writes (millisecond transactions) | Large-subtree move/delete (the transaction spans all set UPDATEs — more affected rows, longer locks); `repair` (whole-tree rebuild transaction) |

**Selection guidance:**

- **Online services (high-frequency reads/writes, potentially large trees)**: every API is safe to use — writes have constant SQL counts and bounded lock scope; large-subtree moves push affected-row cost onto the indexes
- **Huge-tree traversal/export (millions of nodes)**: use `forEach` (streaming, O(b) memory) instead of `toJson` (whole tree in memory); for exports, process the `toList` result set in a streaming fashion
- **Recovering from structural damage**: `repair` is the only whole-tree recomputation — schedule it off-peak
- **Recycle bin**: changes no API's complexity — filtering is one range condition inside the SQL; however many nodes pile up in the bin only affects the rows excluded within that range

:::tip Size independence
Rule of thumb: **except for `forEach` (traversal) and `repair` (rebuild), the SQL count of any API is a constant**. Moving a subtree of a hundred thousand nodes executes exactly the same number of statements as moving a leaf — the cost only shows up in the number of rows affected by the UPDATEs, which the database engine handles efficiently on indexes. `forEach`'s per-node querying is equally deliberate: streaming decouples memory from tree size — it is built for large tree tables.
:::
