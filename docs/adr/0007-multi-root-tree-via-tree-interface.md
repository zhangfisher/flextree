# ADR-0007: MultiRootFlexTree 经宿主树接口直连多根管理器

- 状态：已接受
- 日期：2026-08-17
- 关联：ADR-0001（多根树经隐藏根实现）、CONTEXT.md「Multi-Root Memory Tree」

## 背景

`FlexTree` 是 `FlexTreeManager` 之上的内存查询树（Live Tree）。多根树（ADR-0001）同样需要内存查询形态：`MultiRootFlexTree`，其 API 与 `FlexTree` 基本一致，差别仅在多根。

`FlexTreeNode` 与 `FlexTree` 强耦合（`_tree` 强类型为 `FlexTree`，构造、组栈、导航、导出全部经宿主树成员）。多根内存树的节点如何复用这套逻辑，有三种实现路径。

## 决策

**抽取宿主树最小接口 + `MultiRootFlexTree` 直连 `MultiRootFlexTreeManager`。**

1. `node.ts` 定义 `FlexTreeNodeHost`：节点对宿主树的全部结构依赖（`manager`/`options.lazy`/`root`/`nodes`/`_binRangeForCount`）；`FlexTreeNode` 增加 `TTree` 泛型参数（默认 `FlexTree`，既有调用点零改动）。
2. `MultiRootFlexTree` 实现该接口，读取全部经 `MultiRootFlexTreeManager`：数据天然无隐藏根、level 已归一化，内存树中隐藏根不存在，用户根即顶层节点（`parent=undefined`）。
3. Live Tree 机制（置脏/自动重载/脏读防护/自身写免重载）在 `MultiRootFlexTree` 内同构实现，不抽公共基类。

## 备选方案

- **投影内部单根树**：包装 `manager.getTree()` 出来的隐藏根树，`.nodes` = 其 root.children。否决：Live Tree 机制免费，但泄漏严重——`node.parent` 指向隐藏根、`node.level` 是物理值，与「Hidden Root 对外不可见」直接冲突，归一化补丁会散落各导航属性。
- **全平行复制**：node + tree 复制一份多根版本。否决：600+ 行重复，违背 DRY，且与共享 `FlexTreeNode` 的用户生态割裂。

## 后果

- `FlexTreeNode` 对宿主树的依赖收窄为一个显式接口，后续第三种宿主（如只读快照树）可实现同一接口复用节点。
- `node.root` 语义改为「沿 parent 链上溯到无父者」——对单根树（根 parent=undefined→自身）与多根树（用户根）统一成立，无需按宿主类型特判。
- `node.siblings` 对无父节点经宿主 `nodes` 取其余用户根（单根树的根保持原 `undefined` 行为）。
- `MultiRootFlexTreeManager` 需补齐树层依赖的转发：`write:after` 携带 `{committed}`（回滚检测）、`node:recycled` 事件转发（回收置脏）、`recycleBinEnabled`/`_getBinRange`（countField 可见口径预取）——这三项本是管理器的既有缺陷，本 ADR 一并修复。
- 已知边界（本 ADR 不治理）：`FlexTreeManager.getTree` 会把多根树的内部单树 manager 注册进 `FlexTreeManager._instances`（表名键）。同表混用 `FlexTreeManager.getInstance` 与多根管理器会撞键——混用本身就是误用，如需治理另立 ADR。

## 语义决定（伴随本 ADR 落地）

- `.nodes` 返回用户根节点**实例**列表（与 `MultiRootFlexTreeManager.nodes` 的数据快照同名不同物）。
- `load()` 一次 `getNodes` 全量取数、树层组栈（1 次 SQL）；空树（零用户根）合法：`nodes=[]`、`status='loaded'`。
- `status` 按根聚合：`error > loading > idle > loaded`。
- `getByPath` 首段在用户根中匹配；`'/'` 与 `'../'` 在树层无锚点，返回 `undefined`。
- 单例键 = 表名 + lazy（多根树无 treeId 维度）。
