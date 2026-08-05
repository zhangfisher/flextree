---
"flextree": major
"flextree-sqlite-adapter": major
"flextree-prisma-adapter": major
"flextree-bun-sqlite-adapter": major
---

3.0 重大升级：围绕数据安全、数据库兼容性与开发体验。

主要变更：
- 自研多数据库 SQL 转义器（移除 sqlstring 依赖，支持 mysql/postgresql/sqlite/oracle/sqlserver）
- 事务化写入 + 并发脏读修复（适配器新增 transaction()，AsyncLocalStorage 上下文隔离 + 读守卫 _guardRead）
- 单例模式（getInstance/clearInstance，singleton 选项默认开启）
- 树遍历 forEach（DFS/BFS）、树修复 repair/repairTree
- 节点事件系统（node:added/deleted/cleared/updated/moved）
- 嵌套节点批量添加、FlexTree 懒加载、树导出（getTree/toJson/toList）、细粒度校验
- 新增 Bun SQLite 适配器（flextree-bun-sqlite-adapter）
- 工具链迁移至 Bun 1.3.14、TypeScript 6、Bun Test API

破坏性变更：
- IFlexTreeAdapter: ready → connected，新增必需方法 transaction(callback)，新增可选 type 字段
- Manager: ready() → connected()，assertDriverReady() → assertConnected()
- 移除 sqlstring 依赖，TypeScript 版本要求提升至 6

完整说明见根 CHANGELOG.md。
