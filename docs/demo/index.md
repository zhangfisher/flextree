---
outline: false
---

# 示例：浏览器中的完整树应用

下面是一个**完整可交互**的 FlexTree 示例，直接在你的浏览器中运行——没有后端、没有服务，整棵树就是一个 sql.js（WebAssembly SQLite）内存数据库，写事务提交后自动快照到 localStorage，刷新页面数据不丢。

<script setup>
// demo 组件样式（命名空间隔离，见 .vitepress/demos/styles.css）
import '../.vitepress/demos/styles.css'
</script>

:::tip 试试这些操作
- **拖拽**节点调整组织架构（拖到回收站 = 逻辑删除，拖出 = 恢复）
- 工具栏**增删改**部门/员工、**上移/下移**重排
- 切换**树视图 / 表格视图**——表格直接展示树表的物理行，亲眼看到 Nested Set 的 `leftValue/rightValue` 如何随操作变化
- 下方**事件流**实时显示触发的 API 事件，点击 🗄 图标可查看该事务执行的**全部 SQL**
- **校验**按钮对树做完整性检查（左右值/层级/唯一性）
:::

<demo
  react="../.vitepress/demos/App.tsx"
  title="组织架构管理器"
  description="FlexTree × sql.js：单树/多根树切换 · 回收站 · 拖拽 · 事件流 · SQL 检视"
  github="https://github.com/zhangfisher/flextree/tree/main/examples/sqljs"
/>

## 这个示例做了什么

| 能力 | 使用的 FlexTree API |
| --- | --- |
| 组织架构树（部门/员工两级语义） | `createRoot` / `addNodes`（嵌套输入一次建树） |
| 增加部门/员工 | `addNodes` |
| 重命名 | `update` |
| 逻辑删除（进回收站）/ 彻底删除 | `deleteNode(node, { recycle })` |
| 清空回收站 | `clearRecycleBin` |
| 从回收站恢复（按钮/拖出） | `getChildren(bin, { includeRecyclebin: true })` + `moveNode` |
| 拖拽移动/排序 | `moveNode`（含 `includeRecyclebin` 站内外互拖） |
| 上移/下移 | `moveUpNode` / `moveDownNode` |
| 单树 ⇄ 多根树切换 | `FlexTreeManager` / `MultiRootFlexTreeManager` |
| 表格视图（左右值可视化） | `getNodes({ includeRecyclebin: true })` |
| 结构校验 | `verify` |
| 事件流面板 | `on("node:added" | "node:moved" | ...)` |
| localStorage 持久化 | sql.js 适配器 `onPersist` 钩子（写事务 COMMIT 后自动快照） |

## 源码

完整源码在仓库 [examples/sqljs](https://github.com/zhangfisher/flextree/tree/main/examples/sqljs)，可独立运行：

```bash
git clone https://github.com/zhangfisher/flextree.git
cd flextree/examples/sqljs
bun install
bun run dev
```

核心桥接逻辑（FlexTree 异步 SQL 树 → headless-tree 同步视图）在 `tree-source.ts`：任何写操作后 `getNodes` 拉平重建 `{ id → item, id → children[] }` 视图——浏览器内存库规模小，全量重建最简单可靠。
