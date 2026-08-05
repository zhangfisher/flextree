# 更新历史

## 3.0

3.0 是一次围绕**数据安全、数据库兼容性与开发体验**的重大升级。

### 新特性

- **事务化写入与并发脏读修复**：`write` 内部的所有操作现由数据库事务包裹，任一失败整体回滚；并通过写事务上下文隔离与读守卫，避免写操作过程中并发读取到中间态（脏读）。
- **单例模式**：`FlexTreeManager.getInstance` 基于表名返回同一个实例，避免重复创建。
- **节点事件**：新增 `node:added`、`node:deleted`、`node:cleared`、`node:updated`、`node:moved` 等节点级事件。
- **树遍历 `forEach`**：支持 DFS / BFS 两种模式，可中断、可限制层级、可指定起点。
- **树修复 `repair`**：基于 `level` 重建被破坏的左右值结构，并自动校验完整性。
- **嵌套批量添加**：`addNodes` 支持通过 `children` 字段一次性添加整棵子树。
- **`FlexTree` 懒加载**：新增 `lazy` 选项，节点可按需加载。
- **树导出**：`FlexTreeManager` 新增 `getTree` / `toJson` / `toList` 便捷方法。
- **细粒度校验**：`verify` 基于纯 SQL 校验，覆盖节点总数、值完整性、基本关系、唯一性、层级关系。
- **新增 Bun SQLite 适配器**（`flextree-bun-sqlite-adapter`）。
- **类型增强**：`treeId` 支持 `string`；新增 `FlexTreeNodeInput` 嵌套输入类型。

### 改进

- 工具链从 pnpm 迁移至 **Bun**，测试迁移至 **Bun Test**。
- 升级 TypeScript 至 6、oxlint 至 1.76。
- 测试用例内联至各包 `__tests__/`，并新增一整套共享测试工具。

### 破坏性变更

- 适配器接口：`ready` → `connected`，新增必需方法 `transaction` 与可选字段 `type`。
- `FlexTreeManager`：`ready()` → `connected()`，`assertDriverReady()` → `assertConnected()`。
- 移除 `sqlstring` 依赖，改用内置 SQL 转义器。
- 要求 TypeScript 6 及以上。

## 2.x 及更早版本

详见 [GitHub Releases](https://github.com/zhangfisher/flextree/releases)。
