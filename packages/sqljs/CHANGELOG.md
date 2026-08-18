# flextree-sqljs-adapter

## 3.2.1

## 3.2.0

### Patch Changes

-   Updated dependencies
    -   flextree@3.2.0

## 3.1.1

### Patch Changes

-   b622ecb: [fix] 修复发布到 npm 的包入口指向 src/index.ts 源码的问题：发布流程现在会在 publish 前将 publishConfig 中的入口字段（main/module/types/exports）提升到 package.json 顶层，同时通过 files 字段收窄发布产物至 dist 目录

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
