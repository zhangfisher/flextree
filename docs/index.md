---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "FlexTree"
  text: "高效的树形数据存储库"
  tagline: 左右值算法/查询优先/无递归
  actions:
    - theme: brand
      text: 快速开始
      link: /intro/get-started
    - theme: alt
      text: GitHub
      link: https://github.com/zhangfisher/flextree

features:
  - icon: ⚡
    title: 高效查询
    details: 基于左右值算法，后代、祖先、子节点、兄弟等关系查询均可由单条 SQL 完成，无需递归，树的层级越深优势越明显。
    link: /intro/principle
  - icon: ✨
    title: 简洁 API
    details: 语义化方法命名，覆盖增删改查、遍历、移动、导出等全生命周期操作，无需手写复杂 SQL。
    link: /intro/features
  - icon: 🛡️
    title: 完整类型安全
    details: 基于 TypeScript 开发，提供完整泛型支持，自定义字段名与类型同样能获得精准的类型提示。
    link: /guide/custom
  - icon: 🔒
    title: 事务与并发安全
    details: write 内所有操作共享同一数据库事务、任一失败整体回滚；并发读守卫避免读到左右值的中间态。
    link: /guide/write
  - icon: 🗄️
    title: 多数据库适配
    details: 适配器模式解耦数据库访问，内置 SQLite、Prisma、Bun SQLite 适配器，并支持多方言 SQL 生成，可扩展至任意数据库。
    link: /guide/adapters
  - icon: 🔧
    title: 校验与修复
    details: verify 基于纯 SQL 校验树结构完整性，repair 可重建被破坏的左右值与层级。
    link: /guide/verify
  - icon: ⚙️
    title: 灵活定制
    details: 支持自定义关键字段名与类型、单表多树（treeId 支持数字与字符串）、单例管理、懒加载。
    link: /guide/custom
  - icon: 🔄
    title: 遍历与导出
    details: forEach 支持深度/广度优先遍历并可随时中断，toJson/toList 可导出为嵌套 JSON 或扁平列表。
    link: /guide/query
---
