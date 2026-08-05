# 变更日志（CHANGELOG）

本文件记录 FlexTree 自 `2.0.4`（Commit `4b32550`）以来的全部变更，对应 **3.0** 大版本升级。

---

## [3.0.0] - 2026-08

3.0 是一次围绕**数据安全、数据库兼容性与开发体验**的重大升级。核心改动包括：自研多数据库 SQL 转义器、事务化写入与并发脏读修复、单例模式、树遍历与树修复能力、新增 Bun SQLite 适配器，以及工具链从 pnpm 全面迁移至 Bun。

### ✨ 新增特性（Features）

#### 核心

- **自研多数据库 SQL 转义器（Escaper）**
  新增 `packages/core/src/escaper/` 模块，**移除对第三方库 `sqlstring` 的依赖**。该模块支持 `mysql` / `postgresql` / `sqlite` / `oracle` / `sqlserver` 五种数据库的差异化 SQL 生成，覆盖标识符转义（`escapeId`）、值转义（`escape`）、SQL 模板格式化（`format`）、对象键值对（`objectToValues`）、数组/集合（`arrayToList`）、日期（`dateToString`）、Buffer（`bufferToString`）、Temporal 对象等场景。管理器在构造时依据 `adapter.type` 自动选择转义器（默认 `postgresql`），并导出 `createEscaper`、`raw` 与 `Escaper` 接口供外部使用。

- **事务化写入 + 并发脏读修复（重点）**
  - 适配器接口新增 `transaction(callback)` 方法；所有写操作由 `write()` 内的 `adapter.transaction` 统一包裹，**多条 SQL 共享同一事务，任一失败整体回滚**，实现跨方法原子性。
  - 引入 `AsyncLocalStorage` 实现**写事务上下文隔离**：写调用链内部的读操作（内部读）直接放行以查看事务内状态；外部并发读通过新增的 `_guardRead()` 守卫**等待写事务完成后再读取**，彻底消除写过程中的脏读问题。

- **单例模式**
  `FlexTreeManager` 新增基于 `tableName` 的单例支持。通过 `FlexTreeManager.getInstance()` / `clearInstance()` 静态方法管理实例生命周期，相同表名返回同一实例；新增 `singleton` 选项（默认启用）。详见 `packages/core/SINGLETON.md`。

- **树遍历 `ForEachMixin`**
  新增 `forEach(callback, options)` 方法，提供 **DFS（深度优先）与 BFS（广度优先）** 两种遍历模式，支持遍历中断（回调返回 `false`）、最大层级限制（`maxLevel`）、指定起始节点（`startFrom`）、是否包含起始节点（`includeStartNode`）。

- **树修复 `RepairMixin` + `repairTree`**
  新增 `manager.repair()` 方法及纯函数 `repairTree()`，用于修复被破坏的 Nested Set Model 树结构。算法基于 `level` 信息重建树（重新分配连续的 `leftValue`/`rightValue`，规范化跳级的 `level`），适配单表多树场景，修复后自动做完整性校验，仅将发生变化的节点写回数据库。

- **节点事件系统**
  在原有的 `beforeWrite` / `afterWrite` 基础上，新增 5 个节点级事件：`node:added`、`node:deleted`、`node:cleared`、`node:updated`、`node:moved`，便于业务侧感知树变更。

- **嵌套节点批量添加**
  `addNodes()` 支持以嵌套结构（`FlexTreeNodeInput`）一次性添加整棵子树，通过 `children` 字段（字段名可经 `childrenField` 自定义）递归插入，内部区分扁平（`addNodesFlat`）与嵌套（`addNodesNested`）两种执行路径。

- **FlexTree 懒加载**
  `FlexTree` 新增 `lazy` 选项。节点引入状态机（`idle` / `loading` / `loaded` / `error`），懒加载模式下仅加载一级子节点，可通过 `node.load()` 按需展开，降低大规模树的初始化开销。

- **树导出方法**
  `FlexTreeManager` 新增 `getTree()` / `toJson()` / `toList()` 方法，可将树导出为嵌套 JSON（`children` 结构）或扁平列表（`pid` 结构）。导出选项支持自定义 `children` 字段名、限定导出层级、字段过滤等。

- **细粒度树校验**
  `VerifyTreeMixin` 在原有 `verify()` 基础上，新增 7 个独立检查方法：`checkBasicRelation`、`checkLevelRelation`、`checkNodeCount`、`checkParentChildLevel`、`checkRootLevel`、`checkUniqueness`、`checkValueIntegrity`，便于定位具体结构问题。

- **新增工具函数**
  - `forEachNestTree()`：深度优先遍历嵌套树（`children` 结构），每个节点进入与退出各回调一次（对应左右值语义）。
  - `forEachTree()` / `isCompleteTree()`：基于左右值遍历扁平节点数组，并检测子树完整性（可用于校验、修复前置检测）。
  - `checkSqlSafety()`：对用户传入的 SQL 表达式（如 WHERE 条件）做注入模式检测。

#### 适配器

- **新增 Bun SQLite 适配器（`flextree-bun-sqlite-adapter`）**
  基于 Bun 内置的 `bun:sqlite`，支持内存数据库与文件数据库、外部 `Database` 实例传入，并实现显式 `BEGIN`/`COMMIT`/`ROLLBACK` 事务（嵌套调用时复用外层事务，不重复开启）。

#### 类型系统

- **`treeId` 支持字符串**：`DefaultTreeKeyFields.treeId` 类型由 `number` 放宽为 `number | string`，支持字符串树 ID。
- **新增 `FlexTreeNodeInput` 类型**：递归嵌套节点输入类型，用于 `addNodes` 的嵌套结构描述。
- **导出选项泛型化**：`FlexTreeExportJsonOptions` / `FlexTreeExportJsonFormat` 新增 `Children` 泛型参数，支持自定义 `children` 字段名的端到端类型推导。

---

### 🚀 改进（Improvements）

- **包管理器迁移**：从 pnpm（`9.1.2`）全面迁移至 **Bun（`1.3.14`）**，移除 `pnpm-lock.yaml`、`pnpm-workspace.yaml`，新增 `bun.lock`。
- **测试框架迁移**：测试由 vitest 迁移至 **Bun Test API**（`bun test` / `bun test --coverage`），移除根目录 `vitest.config.ts`。
- **依赖与工具链升级**：TypeScript `5.8` → **`6`**、oxlint `0.6` → `1.76`、turbo `2.0.9` → `2.10.7`。
- **测试基础设施重构**：测试由独立的 `packages/tests` 包迁移并内联至 `packages/core/__tests__/`，新增一整套共享测试工具（`helpers/`）：`mock-adapter`、`tree-builder`、`tree-exporter`、`tree-manager`、`tree-verifier`、`tree-visualizer`。
- **表名统一转义**：`tableName` 在管理器构造时经 `escaper.escapeId` 转义后存储，统一标识符处理，避免各处拼接 SQL 时重复处理。
- **`withTreeId` 不再重复转义**：原值直接写入记录，转义交由 escaper 统一完成，杜绝双重转义。
- **CI 升级**：GitHub Actions 发布与文档工作流改用 Bun（`oven-sh/setup-bun@v2`），Node `22` → `24`，`actions/setup-node` `v4` → `v6`，发布命令切换为 `bun run publish-packages` / `only-publish-packages`。
- **发布脚本增强**：新增 `scripts/update-workspace-deps.js`（workspace 依赖同步）与 `scripts/verify-types.ts`（类型校验），发布流程集成 workspace 依赖更新。
- **移除冗余依赖**：移除 `@rsbuild/core` 及 `packages/core/rsbuild.config.ts`。
- **代码风格统一**：全量统一为双引号、2 空格缩进、末尾分号（Biome/Prettier 风格）。

---

### 🐛 修复（Fixes）

- **并发脏读问题（重大）**：原版本在写树过程中若存在并发读取（如 `getAncestors`、`getChildren`），可能读取到错误的中间态值。3.0 通过「事务 + AsyncLocalStorage 上下文隔离 + 读守卫」保证：写操作进行时，外部读等待写完成后再执行，显著提升并发安全性。
- **跨方法原子性缺失**：此前各写方法（add/move/delete/repair 等）的 SQL 分散执行，任一步骤失败可能残留半成品树结构；现统一由事务包裹，失败时整体回滚。
- 移除已废弃的 `escapeSqlString` 工具（其职责由全新的 escaper 模块接管）。

---

### 💥 破坏性变更（Breaking Changes）

- **适配器接口（`IFlexTreeAdapter`）调整**：
  - `ready` 字段重命名为 **`connected`**。
  - 新增**必需方法** `transaction(callback)`，自定义适配器需实现该方法。
  - 新增**可选字段** `type`（`DatabaseType`，未指定时默认 `postgresql`）。
  - 不再强制要求适配器暴露 `db` 字段。
- **Manager API 重命名**：`ready()` → **`connected()`**，`assertDriverReady()` → **`assertConnected()`**。
- **移除 `sqlstring` 依赖**：依赖该库行为的自定义适配器/业务代码需改用 `manager.escaper`。
- **TypeScript 版本要求提升**：需 TypeScript **6** 及以上。
- **测试包结构调整**：`packages/tests` 已删除，测试用例迁移至各包的 `__tests__/` 目录。

---

### 📚 文档

- 新增 `CLAUDE.md`（项目开发指引）与 `packages/core/SINGLETON.md`（单例模式说明）。
- 更新 `docs/guide/manager.md`、`docs/guide/export.md`、`docs/guide/delete.md`，同步 3.0 的 API 与用法。
- 新增 `packages/core/examples/`（含节点移动示例与运行脚本）。

---

## [2.0.4] 及更早版本

详见各包内的 `CHANGELOG.md`（如 `packages/core/CHANGELOG.md`）。
