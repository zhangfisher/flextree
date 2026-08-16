# flextree

## 3.1.0

### Minor Changes

-   3.1：回收站（逻辑删除）、节点复制、跨树操作与多根树。

    主要变更：

    -   **回收站（逻辑删除）**：通过 `recyclebin` 配置启用；`deleteNode(node, { recycle: true })` 将子树连同内部结构移入回收站（复用移动算法，事务原子），`clearRecycleBin()` 清空；所有读取/写方法支持 `includeRecyclebin` 视角参数——默认视角下站内节点逻辑不存在，`true` 时可作为普通节点操作（恢复 = 站内视角读出 + `moveNode` 移出）
    -   **节点复制 `copyNode`**：整个操作在事务内以固定条数的集合 SQL 完成，数据库访问次数与后代数量无关；支持仅复制自身（`includeDescendants: false`）、字段过滤（`fields`）与跨树复制（`options.treeId`）
    -   **跨树移动**：`moveNode` 支持 `options.treeId` 跨树移动子树；`toNode` 缺省时迁出为该 treeId 新树的根；`canMoveTo` 同步支持跨树判定
    -   **多根树**：新增 `MultiRootFlexTreeManager`，以隐藏根实现用户视角的多顶层节点树，level 自动归一化，单树操作原样可用
    -   **`countField` 后代数量**：所有查询方法（`getNodes`/`getNode`/`getDescendants`/`getChildren`/`getAncestors`/`getSiblings`/`findNodes` 等）与导出方法（`toJson`/`toList`）支持 `countField` 参数，由数据库端按 `(rightValue - leftValue - 1) / 2` 直接计算，不受 `level` 截断影响；回收站场景下为可见口径
    -   **新增 sql.js 适配器**（`flextree-sqljs-adapter`）：基于 sql.js，在浏览器（wasm）中运行完整树结构
    -   文档：新增复制、移动、回收站、多根树指南与 ADR 0001-0006

## 3.0.0

### Major Changes

-   0b71346: 3.0 重大升级：围绕数据安全、数据库兼容性与开发体验。

    主要变更：

    -   自研多数据库 SQL 转义器（移除 sqlstring 依赖，支持 mysql/postgresql/sqlite/oracle/sqlserver）
    -   事务化写入 + 并发脏读修复（适配器新增 transaction()，AsyncLocalStorage 上下文隔离 + 读守卫 \_guardRead）
    -   单例模式（getInstance/clearInstance，singleton 选项默认开启）
    -   树遍历 forEach（DFS/BFS）、树修复 repair/repairTree
    -   节点事件系统（node:added/deleted/cleared/updated/moved）
    -   嵌套节点批量添加、FlexTree 懒加载、树导出（getTree/toJson/toList）、细粒度校验
    -   新增 Bun SQLite 适配器（flextree-bun-sqlite-adapter）
    -   工具链迁移至 Bun 1.3.14、TypeScript 6、Bun Test API

    破坏性变更：

    -   IFlexTreeAdapter: ready → connected，新增必需方法 transaction(callback)，新增可选 type 字段
    -   Manager: ready() → connected()，assertDriverReady() → assertConnected()
    -   移除 sqlstring 依赖，TypeScript 版本要求提升至 6

    完整说明见根 CHANGELOG.md。

## 2.0.4

### Patch Changes

-   3c5317c: 修复 isValidNode 的判定条件错误

## 2.0.3

### Patch Changes

-   a1b13b0: 修复 getNodeData 中对无效节点数据的判断逻辑错误

## 2.0.2

### Patch Changes

-   7e63e70: 当`node.get`输入条件函数时，包括当前节点

## 1.1.1

### Patch Changes

-   827f089: fix tree.get

## 1.1.0

### Minor Changes

-   f01b923: 新增加 foreach 方法用于遍历树

## 1.0.3

### Patch Changes

-   b63c6b0: 修复 node typescript 类型

## 1.0.2

### Patch Changes

-   1cd6626: - [fix] 优化类型
    -   [feat] 将`node.data`更名为`node.fields`

## 1.0.1

### Patch Changes

-   6e5ead5: initial release
