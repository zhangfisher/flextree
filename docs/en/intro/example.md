---
outline: false
---

# Demo: A Complete Tree App in the Browser

Below is a **fully interactive** FlexTree example running directly in your browser — no backend, no server; the whole tree is an in-memory sql.js (WebAssembly SQLite) database, automatically snapshotted to localStorage after each committed write transaction. Refresh the page and your data is still there.

<script setup>
// demo component styles (namespaced; see .vitepress/demos/styles.css)
import '../../.vitepress/demos/styles.css'
</script>

:::tip Things to try

- **Drag** nodes to reorganize the structure (drop onto the recycle bin = logical delete; drag out = restore)
- Use the toolbar to **add/rename/delete** departments/employees and **move up/down** to reorder
- Switch between the **tree view / table view** — the table shows the physical rows of the tree table, so you can watch how the Nested Set `leftValue/rightValue` change with every operation
- The **event stream** below shows API events in real time; click the 🗄 icon to inspect **all SQL statements** executed by that transaction
- The **verify** button runs an integrity check on the tree (left/right values, levels, uniqueness)
  :::

<demo
  react="../../.vitepress/demos/App.tsx"
  title="Organization Manager"
  description="FlexTree × sql.js: single/multi-root switching · recycle bin · drag & drop · event stream · SQL inspector"
  github="https://github.com/zhangfisher/flextree/tree/main/examples/sqljs"
/>

## What This Demo Does

| Capability                                    | FlexTree APIs used                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| Org chart (department/employee semantics)     | `createRoot` / `addNodes` (nested input builds the tree in one shot)       |
| Add department/employee                       | `addNodes`                                                                 |
| Rename                                        | `update`                                                                   |
| Logical delete (to recycle bin) / hard delete | `deleteNode(node, { recycle })`                                            |
| Empty the recycle bin                         | `clearRecycleBin`                                                          |
| Restore from the bin (button/drag out)        | `getChildren(bin, { includeRecyclebin: true })` + `moveNode`               |
| Drag to move/reorder                          | `moveNode` (with `includeRecyclebin` for cross-bin drags)                  |
| Move up/down                                  | `moveUpNode` / `moveDownNode`                                              |
| Single-tree ⇄ multi-root switching            | `FlexTreeManager` / `MultiRootFlexTreeManager`                             |
| Table view (left/right value visualization)   | `getNodes({ includeRecyclebin: true })`                                    |
| Structure verification                        | `verify`                                                                   |
| Event stream panel                            | `on("node:added"                                                           | "node:moved" | ...)` |
| localStorage persistence                      | sql.js adapter `onPersist` hook (auto-snapshot after each committed write) |

## Source Code

The full source lives in the repository at [examples/sqljs](https://github.com/zhangfisher/flextree/tree/main/examples/sqljs) and runs standalone:

```bash
git clone https://github.com/zhangfisher/flextree.git
cd flextree/examples/sqljs
bun install
bun run dev
```

The core bridging logic (FlexTree async SQL tree → headless-tree sync view) is in `tree-source.ts`: after any write, `getNodes` pulls the flat list and rebuilds the `{ id → item, id → children[] }` view — with an in-memory browser database the scale is small, so a full rebuild is the simplest and most reliable approach.
