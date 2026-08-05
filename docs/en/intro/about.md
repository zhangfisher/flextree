# About

`FlexTree` is a tree-structured data storage and management library based on the `Left-Right Value (Nested Set Model)` algorithm, targeting `Node.js` (and `Bun`) environments. It combines efficient tree-structure queries with a concise API, letting developers perform CRUD, traversal, move, and export operations on trees without hand-writing complex recursive `SQL`.

## Feature Overview

- **Efficient queries**: Based on the Left-Right Value algorithm, relationship queries such as descendants, ancestors, children, and siblings can all be completed in a single `SQL` statement—no recursion required.
- **Concise API**: Semantic method naming with full `TypeScript` generics support—custom fields still get precise type hints.
- **Complete operations**: Covers the full lifecycle, including add (with nested batch add), delete, move, update, find, traverse, and export.
- **Data safety**: Transactional writes guarantee atomicity, a concurrency read guard prevents dirty reads, and tree-structure verify (`verify`) and repair (`repair`) are provided.
- **Multi-database**: Decouples database access via the adapter pattern—ships with three adapters (`SQLite`, `Prisma`, `Bun SQLite`) and can be extended to any database such as `MySQL`, `PostgreSQL`, `Oracle`, or `SQL Server`.
- **Flexible customization**: Supports custom key fields, multiple trees in a single table (`treeId`), singleton management, lazy loading, node events, and more.

## Suitable Scenarios

`FlexTree` is a **query-first** storage structure, best suited for tree data that is **read-heavy and write-light**, for example:

- Organization and department hierarchies
- Product / content category catalogs
- Menus and permission trees
- Nested comments and replies
- Hierarchical data such as regions and tags

> For scenarios with frequent structural changes (high-frequency writes), consider the trade-offs in [Features, Strengths & Limitations](./features.md) before choosing.

## Next

- [Quick Start](./get-started.md): Get up and running with `FlexTree` in minutes.
- [How It Works](./principle.md): Learn about the Left-Right Value algorithm and how it compares to other tree-storage solutions.
- [Features](./features.md): A full overview of `FlexTree`'s capabilities and limitations.
- [Changelog](./history.md): View version changes.

## Project Information

- **License**: MIT
- **Source repository**: [GitHub](https://github.com/zhangfisher/flextree)
- **Runtime**: `Node.js` / `Bun`
