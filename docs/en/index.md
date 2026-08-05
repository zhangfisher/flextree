---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "FlexTree"
  text: "Efficient Tree-Structured Data Storage Library"
  tagline: Left-Right Value algorithm / query-first / no recursion
  actions:
    - theme: brand
      text: Quick Start
      link: /en/intro/get-started
    - theme: alt
      text: GitHub
      link: https://github.com/zhangfisher/flextree

features:
  - icon: ⚡
    title: Efficient Queries
    details: Based on the Left-Right Value algorithm, relationship queries such as descendants, ancestors, children, and siblings can all be completed in a single SQL statement—no recursion required. The deeper the tree, the greater the advantage.
    link: /en/intro/principle
  - icon: ✨
    title: Concise API
    details: Semantic method names cover the full lifecycle—CRUD, traversal, move, and export—so you never have to hand-write complex SQL.
    link: /en/intro/features
  - icon: 🛡️
    title: Full Type Safety
    details: Built with TypeScript and full generics support—custom field names and types still get precise type hints.
    link: /en/guide/custom
  - icon: 🔒
    title: Transaction & Concurrency Safety
    details: All operations inside a write share the same database transaction—any failure rolls back the whole batch; a concurrency read guard prevents reading intermediate left/right values.
    link: /en/guide/write
  - icon: 🗄️
    title: Multi-Database Support
    details: The adapter pattern decouples database access—ships with SQLite, Prisma, and Bun SQLite adapters, supports multi-dialect SQL generation, and can be extended to any database.
    link: /en/guide/adapters
  - icon: 🔧
    title: Verify & Repair
    details: verify checks tree-structure integrity via pure SQL; repair rebuilds corrupted left/right values and levels.
    link: /en/guide/verify
  - icon: ⚙️
    title: Flexible Customization
    details: Supports custom key-field names and types, multiple trees in a single table (treeId supports both numbers and strings), singleton management, and lazy loading.
    link: /en/guide/custom
  - icon: 🔄
    title: Traversal & Export
    details: forEach supports DFS/BFS traversal and can be interrupted at any time; toJson/toList export the tree as nested JSON or a flat list.
    link: /en/guide/query
---

> 🌐 **Translation Notice:** This English documentation may lag behind the [Chinese original](/). When in doubt, the Chinese version is the source of truth.
