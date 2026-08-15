# 回收站功能实施计划

> 依据 `docs/adr/0002-recycle-bin-via-bin-node.md` 与 CONTEXT.md「回收站」术语节。
> 产出会话：grilling 定案（2026-08-15）。实现会话按此清单执行。

## 设计要点速览

- **Bin 节点**：**恒为根节点的子节点**（位置不变量：顺序不限、可在根孩子层重排；不允许移往树中其他位置或跨树），`options.recyclebin = { id, name }` 启用；多树下 `id` 可为 `(treeId) => NodeId` 函数，每树各自建站。
- **Logical Invisibility（核心原则）**：`includeRecyclebin=false`（默认）时，Bin 及其后代在**所有**公共 API（find/get/delete/update/forEach/copy/move/toJson/toList）中表现为不存在——读查不到、写抛 NotFound、遍历不进入、导出不含。`=true` 时恢复为普通节点，一切照常。
- **逻辑删除**：`deleteNode(node, { recycle: true })` → 复用 `moveNode(node, binNode, LastChild)`。
- **过滤**：数据库端追加闭区间 `NOT (left >= binLeft AND right <= binRight)`（排除 Bin 自身及全部后代）；读写两侧同规则；Bin 区间内存缓存、写事务提交后失效。
- **事件**：`node:deleted` 载荷增加可选 `recycled?: boolean`；新增 `node:recycled`；`clearRecycleBin()` 不发事件。

---

## 1. 类型与配置（`manager.ts`、`types.ts`）

```ts
// manager.ts
export interface FlexTreeRecyclebinOptions<NodeId = any, TreeId = any> {
  id: NodeId | ((treeId: TreeId) => NodeId);
  name: string;
}

export interface FlexTreeManagerOptions<TreeIdType = any> {
  // ...现有字段
  recyclebin?: FlexTreeRecyclebinOptions;
}
```

- `types.ts`：`FlexTreeEvents` 增补：
  - `"node:deleted": { tree; node; recycled?: boolean }`
  - `"node:recycled": { tree; node }`
- Manager 新增内部状态：
  - `_recycleBin?: { id; name }`（构造时从 options 解析；函数式 id 在 treeId 确定后求值一次并缓存结果）
  - `_binRange?: { left; right } | null`（区间缓存，null=未加载，undefined=无 bin）
  - `get recycleBinEnabled(): boolean`
  - `protected _getBinId(): NodeId | undefined`（处理函数式 id）
  - `protected async _ensureBinNode(): Promise<TreeNode>`（首写时确保存在；已存在同 id 行但**不在根孩子层（level≠1）→ 抛配置错误**；不存在则创建到根的 LastChild）
  - `protected async _getBinRange(): Promise<{left;right} | undefined>`（读缓存/查库；写后失效）
  - `protected _invalidateBinRange()`（在 write() finally 中调用）

## 2. 过滤基础设施（建议新 mixin：`mixins/recycle.mixin.ts`）

核心：构造 SQL 片段，供**所有**读路径拼接（含写操作的前置读取）。

```ts
protected async _buildBinFilter(includeRecyclebin: boolean, alias = ""): Promise<string> {
  // 未启用或 includeRecyclebin=true → ""
  // 否则 → `AND NOT (${alias}left >= ${binLeft} AND ${alias}right <= ${binRight})`
}
```

- 过滤条件形态：`NOT (Node.leftValue >= binLeft AND Node.rightValue <= binRight)`——**闭区间**，同时排除 Bin 自身与全部后代（Logical Invisibility：无中间态、无"叶子形态"）。
- `_sql()` 的 `{__TREE_ID__}` 占位符机制保持不动；bin 过滤作为独立片段拼接，避免与多树条件耦合。
- `write()` 的 finally：`this._binRange = null`（下次读重新加载）。

### 铁律：数据库端过滤，禁止拉取后本地过滤

所有"排除回收站"的语义**必须**以 leftValue/rightValue 的 WHERE 条件形态进入 SQL，由数据库在返回行之前完成排除。**不允许**先 SELECT 全量（或超集）再在应用层 filter/skip。逐接口含义：

- **枚举/查找/计数**：`_buildBinFilter` 片段直接拼进各 SELECT/COUNT 的 WHERE——行数在 DB 端就已正确。
- **导航（getNextSibling/getPreviousSibling/getNthChild）**：是**改写 SQL 条件**，不是取回后跳过。如 getNextSibling 现行条件 `leftValue = RelNode.rightValue + 1` 需改为"同层且 leftValue 大于当前子树右值的第一个**逻辑存在**节点"（WHERE 中排除 Bin 区间 + ORDER BY + LIMIT 1），跳过 Bin 子树的动作发生在数据库里。
- **forEach / toJson / toList / FlexTree 内存树**：过滤发生在 load 时的 getDescendants SQL（DB 端），内存中只存在已过滤的节点——遍历器本身零过滤逻辑。
- **Bin 区间本身的获取**：binLeft/binRight 来自 Bin 节点单行读取（缓存），这是构建 SQL 条件的必要输入，属于点查而非批量过滤。
- **允许的例外（点查，非批量过滤）**：写操作对单个目标节点的存在性门控（delete/update/move 的 getNodeData/isInRecycleBin 前置校验）——按 id 读一行判断是否落在 Bin 区间。这与 deleteNode/moveNode 既有的"先读节点再生成 SQL"模式同构，不是"拉取列表再过滤"。

## 3. 各 mixin 改动清单

> **总原则**：下述每个接口的 `includeRecyclebin` 默认 false；false 时涉及 Bin 及其后代的读/写均按"节点不存在"处理。

### delete.mixin.ts

- `deleteNode(nodeId, options)` 新增 `options.recycle?: boolean` 与 `options.includeRecyclebin?: boolean`：
  1. 未启用回收站 → 忽略两个参数，走原路径。
  2. 启用：
     - node 是 Bin 自身 → 等效 clearRecycleBin（不受 includeRecyclebin 门控——管理动作）。
     - `includeRecyclebin=false`（默认）且 node 在 Bin 子树内（含 Bin 后代）→ 抛 `FlexTreeNodeNotFoundError`（逻辑不存在）。
     - `includeRecyclebin=true`：Bin 内节点可删，**直接物理删除**（已在站内，recycle 参数无意义——逻辑删除的东西再删即物理删除）。
     - `recycle=true` 且 node 在站外 → `moveNode(node, binNode, LastChild)`；事件：`node:deleted`（recycled: true）+ `node:recycled`。
- 新增 `clearRecycleBin()`：
  - 未启用 → 静默 return。
  - `_assertWriteable`；物理删除 Bin 下所有子孙（复用 `_buildDetachSqls` 或循环 deleteNode 子节点，取实现更简洁者），Bin 自身保留。
  - 不发事件；不受 includeRecyclebin 门控。

### get.mixin.ts

- `getNodes(options)` → `includeRecyclebin`：两处 SQL（简单/带 where）均追加过滤片段。where 分支的 NOT EXISTS 祖先检查不需处理 bin——外层闭区间已排除 Bin 及后代。
- `getNode(nodeId, options?)` → `includeRecyclebin`：SQL 追加过滤；**Bin 与其后代默认均 NotFound**。
- `getNodeData(param)`：**注意**——它是写操作的内部前置读取，需要读取"逻辑不存在"的节点（如 deleteNode 进入回收站视角、moveNode 恢复流程）。方案：getNodeData 增加可选 opt（从调用方透传 includeRecyclebin），各写 mixin 的 getNodeData 调用处把用户传入的 includeRecyclebin 透传下去；未透传的内部路径（如 moveNode 内部重读）不过滤。**实现时逐调用点排查**，确保「写 API 默认 NotFound」与「内部机制可用」两条都成立。
- `getDescendants(nodeId?, options)` → `includeRecyclebin`：
  - nodeId 为空时透传给 getNodes（自动获得）。
  - 指定节点时两处 SQL（level=0/level>0）追加过滤片段。
  - `FlexTree.load()`（node.ts:330）调用 `getDescendants(this.id, {includeSelf: true})`——根节点视角自动过滤，toJson/toList 天然支持（includeSelf 的根自身不受影响）。
- `getChildren` → 透传 options。
- `getDescendantCount` → 加 includeRecyclebin（COUNT SQL 同样追加）。
- `getSiblings` → 加 includeRecyclebin。
- **导航型也要过滤**（Logical Invisibility 的推论）：`getNextSibling` / `getPreviousSibling` 加 includeRecyclebin——默认视角下，Bin 的物理前兄弟的 nextSibling 为跳过整个 Bin 区间后的第一个逻辑存在节点；**`getNthChild` 加 includeRecyclebin**（枚举型语义——"取第 N 个孩子"与 getChildren 同族，默认视角下 Bin 内的孩子不计入）。
- **getParent / getAncestors / getAncestorsCount 不加过滤——这是正确性要求而非省事**（最终审查确认的理由）：
  - 场景 B（显示回收站）中 `getParent(binChild)` **必须**返回 Bin 本身——若套用过滤条件，Bin 自身被闭区间排除，返回 NotFound，回收站视图的父链断裂。
  - 场景 A（隐藏回收站）中该路径天然不可达：id 路径经 getNode 门控抛 NotFound，对象路径拿不到站内节点引用。
  - 即：过滤发生在"进入回收站的入口"（getNode/getNodeData 门控与枚举 SQL），不在"向上的祖先链"。
- **对象即凭证原则**（见 move 节）：传节点对象不重查库，id 路径才门控。

### find.mixin.ts

- `findNode(node, options?)` / `findNodes(condition, options?)` → `includeRecyclebin`（默认 false），SQL 追加过滤片段。

### forEach.mixin.ts

- `ForEachOptions` 增 `includeRecyclebin?: boolean`（默认 false）。
- 实现：遍历依赖 `getChildren`——选项透传给 getChildren 即可（DFS/BFS 的 `this.getChildren(...)` 调用处传入）。默认视角下遍历**不访问 Bin 节点、不进入其子树**（getChildren(root) 不返回 Bin）。
- **startFrom 语义（最终审查修正）**：startFrom 本身**不改变**过滤 flag——默认视角下显式传 Bin 或站内节点为起点，行为是"访问该起始节点、children 为空（getChildren 过滤）、不下降"。要遍历回收站内容必须 `includeRecyclebin=true`（单一开关原则，与 Logical Invisibility 一致；"指定起点=进入回收站视角"会造成隐式双开关）。

### update.mixin.ts / move.mixin.ts / copy.mixin.ts / add.mixin.ts

- **update**（注意：方法名是 `update` 不是 updateNode）：增 `includeRecyclebin`。**现状有门控缝隙**——`update` 不读库、直接按 id 拼 UPDATE（update.mixin.ts:38-53），`deleteNode(bin内id)` 抛 NotFound 而 `update({id: bin内id,...})` 会成功。修复：待更新节点先经 `getNodeData`（透传 includeRecyclebin）或前置 `isInRecycleBin` 校验，默认对 Bin 及其后代抛 NotFound；`=true` 时照常。
- **move**：
  - `moveNode(node, toNode, opts)` 增 `includeRecyclebin`：默认 node 或 toNode 任一在 Bin 子树内（含 Bin 自身）→ NotFound/不允许。`=true` 时照常（恢复 = includeRecyclebin=true + moveNode 移出）。
  - **对象即凭证**：node/toNode 传**节点对象**（非 id）时不再重查库校验——默认视角下所有读接口不返回 Bin 内节点对象，能拿到对象引用必然已 `includeRecyclebin=true` 读取过；手工伪造对象属调用方自担行为。id 路径才走门控（getNodeData 抛 NotFound）。此原则适用于**所有**接收 `NodeId | TreeNode` 联合参数的 API。
  - `canMoveTo` 同步透传 includeRecyclebin（其内部 getNodeData 读取需与 moveNode 视角一致，否则预检与执行结果矛盾）。
  - **Bin 位置不变量校验**：node 是 Bin 自身时，仅允许落点保持在根孩子层（根的 First/LastChild，或根孩子的 sibling 位）；否则抛错。**Bin 作为跨树移动源 → 抛错**（Bin 是本树基础设施，禁止迁出）。
  - 事件补充（**状态跃迁规则**，最终审查修正）：`node:deleted`（`recycled: true`）仅在移动发生**站外→站内跃迁**时追加发出（判定：移动前源节点在 bin 区间外 AND 落点 toNode 在区间内，均用移动前坐标比较）。以下**不发** deleted：
    - 站内重排（源与落点均在站内）——节点早已逻辑删除，重排只发 `node:moved`
    - 恢复移出（站内→站外）——只发 `node:moved`（与恢复即 moveNode 的定案一致；如需专门的 `node:restored` 事件属未来需求，YAGNI 不加）
    - copyNode/addNodes 落进站内——新节点从未在逻辑树存在，只发 `node:added`，无"出生即删除"
  - 跨树移动进目标树 Bin（toNode 落在目标树 Bin 下）：不加限制（目标树 bin 语义由目标树侧 manager 决定，当前 manager 不感知）。
- **copy**：`copyNode` 增 `includeRecyclebin`；默认源或落点在 Bin 子树内 → NotFound。（早期"copy 不限制"的定案被统一原则取代。）
- **add**：`addNodes` 落点在 Bin 子树内默认抛 NotFound（includeRecyclebin=true 时允许——往回收站里手动放节点）。

### is.mixin.ts（新增判断，供内部使用）

- `isRecycleBin(node): boolean`（id 匹配 `_getBinId()`）
- `async isInRecycleBin(node): Promise<boolean>`（闭区间 `left >= binLeft AND right <= binRight`，Bin 自身与后代均 true；与过滤条件形态一致）

### verify.mixin.ts / repair.mixin.ts / relation.mixin.ts

- 不改：verify/repair 是内部机制，Bin 子树当普通成员参与校验/重建；relation 是节点间关系计算，输入节点本身已过读门控。

### multi_root_manager.ts

- 支持 `recyclebin` 透传给内部单树 manager；Bin 是隐藏根的子节点。
- 读链路：隐藏根过滤 + level 归一化 + bin 闭区间过滤三者在同一链路叠加（`.nodes`、toJson 多根嵌套数组默认均不含 Bin 及其子孙）。
- 需要核对：MultiRoot 的读路径中所有经手节点列表的位置（load 委托内部 manager，bin 过滤在内部 manager 的读接口完成，MultiRoot 层只需确保不绕过——即不直接裸 SQL 拉全量）。

## 4. 测试要点（packages/tests/ 新增 recyclebin.test.ts）

串行执行（项目约束）。用例树：root → A(B, C), Bin 下初始为空。

**配置与生命周期**
1. 未配置 recyclebin：deleteNode(recycle=true) 等同物理删除；clearRecycleBin() 静默返回；所有接口不过滤任何节点。
2. 首次 write() 时 Bin 自动创建（根的子节点、name/id 按配置）。
3. 表中已存在同 id 行：在根孩子层（level=1）→ 直接当 Bin 用；不在根孩子层 → **抛配置错误**（位置不变量校验）。

**deleteNode(recycle)**
4. recycle=true：节点（含后代、结构保持）移入 Bin；此后 getNodes/findNode/getNode 默认均查不到（含 Bin 自身）；getNodes({includeRecyclebin:true}) 查到全集。
5. recycle=true 的事件序列：node:deleted(recycled:true) + node:recycled。
6. 默认视角 deleteNode(Bin 内节点) → NotFound；includeRecyclebin=true 时物理删除（recycle 参数无效）。
7. deleteNode(bin) → 清空回收站（Bin 保留、子孙删除）；verify() 仍通过。
8. 未启用时 recycle=true → 直接物理删除。

**clearRecycleBin**
9. 启用后清空：Bin 保留、子树删除、不发事件、verify 通过。
10. 未启用：静默。

**读接口过滤（Logical Invisibility 全覆盖 + 数据库端过滤铁律）**
11. getNodes / getDescendants(root) / getChildren(root) / getSiblings / findNodes / forEach / getDescendantCount / getNode：默认不含 Bin 及其子孙；includeRecyclebin=true 返回全集。
11a. **DB 端过滤验证**：对大子树回收后（如 Bin 外 100 节点、Bin 内 1000 节点），getNodes/forEach 默认视角返回行数 = 100（SQL 已排除，非本地过滤）；必要时用 adapter 层钩子/日志断言生成的 SQL 含 bin 区间条件、返回行数即最终行数。
12. 导航：Bin 物理前兄弟的 getNextSibling 默认跳过 Bin 子树返回下一个逻辑存在节点（**SQL 条件改写实现**）；includeRecyclebin=true 时返回 Bin。
13. where 组合：getNodes({where: "name LIKE..."}) 默认仍排除 Bin 及子孙（AND 叠加）。
14. toJson / toList：默认导出不含 Bin 及其子孙；includeRecyclebin=true 完整导出。
15. 根.rightValue 为物理值（含 Bin 区间），verify 通过。

**写接口过滤**
16. 默认视角：update/moveNode/copyNode/addNodes 操作 Bin 内节点（或落点在 Bin 内，id 路径）→ NotFound；includeRecyclebin=true 照常执行。**update 门控必须显式实现**（现状不读库直接 UPDATE，是最大缝隙）。
17. 手动 moveNode(x, binNode, {includeRecyclebin:true}, LastChild)：进站成功 + node:deleted(recycled:true) + node:moved（跃迁进站）。
17a. 站内重排（场景 B）：moveNode(item1, item2, {includeRecyclebin:true}, NextSibling) → 仅 node:moved，**无** deleted。
17b. 恢复移出（场景 B）：moveNode(binItem, x, {includeRecyclebin:true}) → 仅 node:moved，无 deleted；移出后默认视角重新可见。
17c. copyNode/addNodes 落进 Bin（场景 B）：仅 node:added，无 deleted（新节点从未逻辑存在）。
18. 恢复流程：getNode(id, {includeRecyclebin:true}) → moveNode(node, 目标, {includeRecyclebin:true}) → 默认视角重新可见。
18a. 对象即凭证：默认视角下传 Bin 内节点**对象**（先前 includeRecyclebin=true 读到的）给 update/moveNode → 照常执行不拦截；同 id 的字符串路径 → NotFound。
18b. getNthChild(root, 2)：默认视角下 Bin 及其孩子不计入序号；includeRecyclebin=true 按物理序。
18c. canMoveTo 与 moveNode 视角一致性：canMoveTo(x, bin内id) 默认 false/NotFound，=true 时与 moveNode 结论一致。
18d. forEach(startFrom=bin)：默认视角下访问起始节点、children 空、不下降；{includeRecyclebin:true} 时完整遍历站内。
18e. getParent(binChild)（includeRecyclebin=true）返回 bin 本身（祖先链不过滤是场景 B 正确性要求）。

**Bin 位置不变量**
22. moveNode(bin, 根孩子的 sibling 位 / 根的 First/LastChild)：允许（根孩子层内重排）。
23. moveNode(bin, 深层节点)：抛错。
24. 跨树 moveNode(bin, ...)：抛错。
25. deleteNode(bin 的祖先) 不存在特判问题：Bin 唯一祖先是根，recycle(root) 经 canMoveTo 自然报错（回归验证）。

**多树**
19. recyclebin.id 为函数：两棵树各自建站、互不影响；A 树回收不影响 B 树读接口。
20. 跨树 moveNode 到目标树 Bin 下：正常执行。

**MultiRoot**
21. MultiRootFlexTreeManager + recyclebin：.nodes 不含 Bin；toJson 多根数组不含 Bin 及其子孙；回收后节点从默认视角消失。

## 5. 文档同步（项目约束 #4）

- `docs/guide/` 新增或扩展回收站页（中文 + `/en/` 镜像），覆盖：配置、deleteNode(recycle)、Logical Invisibility 原则（全 API 默认视回收站不存在）、includeRecyclebin、clearRecycleBin、恢复流程、事件、多树函数式 id、MultiRoot 支持。
- CHANGELOG / changeset：`bun run changeset`（minor：flextree）。

## 6. 实施顺序建议

1. 类型 + manager 状态 + recycle.mixin（_buildBinFilter/_getBinRange/_ensureBinNode）+ write() 失效钩子
2. delete.mixin（recycle 分支 + clearRecycleBin + NotFound 门控）+ is.mixin 判定
3. get/find/forEach 读接口过滤（含 getNode、导航型、getNthChild）
4. update/move/copy/add 写接口门控（**update 缝隙优先**）与事件补充、canMoveTo 透传
5. multi_root_manager 适配
6. 测试（按上面用例组 1–25，含 18a/18b/18c）
7. 文档 + changeset

## 9. 实现笔记（实施过程中的决策与踩坑，供维护者参考）

1. **_ensureBinNode 放在 write 的 fn 之后**（而非之前）：fn 可能本身在建根（createRoot/首次 addNodes(null)），之后 ensure 才能看到根并把 bin 挂上。且必须包在 `_writeCtx.run` 内——ensure 内部的读经 _guardRead 放行看事务内状态，放外层会等待 _txPromise 造成死锁（实测挂起）。
2. **getNodeData 定为不过滤的内部路径**（id 路径绕过 bin 过滤直读）：写操作的前置读取（recycle 分支、clearRecycleBin、恢复移动）需要读到"逻辑不存在"的节点。公共查询一律走 getNode（默认过滤）。测试曾因 findNode 辅助函数意外踩到此差异。
3. **clearRecycleBin 逐个删除前必须重新读取子节点**：预读的坐标在前一次删除（回缩左右值）后失效，DELETE 区间会错位。实现为"循环取第一个子节点删除直到清空"。
4. **getTree() 需透传 recyclebin 配置**：toJson/toList 走独立的内部 FlexTreeManager（new 出来的），不透传则加载链路（getDescendants）不过滤 bin——曾导致 toJson 输出含回收站。includeRecyclebin=true 通过内部 manager 的 `recycleBinDisableFilter` 实例开关实现（FlexTree 读路径无参数透传通道）。
5. **canMoveTo 内部 getNodeRelation 传已解析的 srcNode**（对象路径）：传原始 id 参数会在 getNodeRelation 内部经 getNode 重查——启用回收站时站内节点被默认过滤而误判/抛错。
6. **isInRecycleBin 对 Partial 对象按 id 点查**：update 的入参是 Partial（无坐标），直接用对象判定会漏判（曾导致 update 门控失效——update 缺口修复后此处是第二道坎）。
7. **ensure-after-fn 使"bin 预置异常行"测试必须全程用 plain manager 建树**：启用回收站的 manager 任何 write 都会在 fn 后创建 bin，先写会先建出正常的 bin。
8. **addNodes 旧参数风格的既有歧义**：第二个参数传节点对象会被误判为 options 对象（`optionsOrAt.at` 取 undefined → 挂到根）。测试辅助函数改传 id。此为既有行为，与回收站无关，未改动（避免破坏兼容）。
9. **forEach startFrom=bin 默认视角的行为修正**：计划原文"访问起始节点但 children 空"不可实现（getNode 过滤直接 NotFound）——统一为 Logical Invisibility 的自然推论：默认视角下 startFrom=bin 抛 NotFound，下降必须 includeRecyclebin=true。

## 7. 本轮定案变更记录（供实现者对照，避免沿用旧稿）

- ~~Bin 自身默认可见（叶子形态、开区间过滤）~~ → **Bin 与子孙统一逻辑不存在（闭区间过滤）**。
- ~~bin 内删除一律物理删除（不受门控）~~ → **默认视角 Bin 内删不到（NotFound）；includeRecyclebin=true 进入回收站视角后删除即物理删除**。
- ~~add/copy 不限制~~ → **统一受 includeRecyclebin 门控**。
- ~~导航接口不过滤~~ → **导航接口同样过滤**（Bin 前兄弟的 nextSibling 跳过 Bin 子树）。
- ~~getNode 只过滤后代~~ → **getNode 连 Bin 自身也过滤**。
- ~~Bin 是普通节点、moveNode 想挪哪挪哪~~ → **Bin 位置不变量：恒为根孩子层，层内可重排，禁止移往深层或跨树迁出**。
- ~~已存在同 id 行不校验位置~~ → **校验：不在根孩子层抛配置错误**。
- ~~moveNode 落点在 Bin 内一律追加 node:deleted(recycled)~~ → **状态跃迁规则：仅站外→站内跃迁发**；站内重排/恢复移出/站内新增只发原生事件。
- ~~forEach startFrom 显式指定 Bin 时照常遍历~~ → **startFrom 不改变视角**：默认下 startFrom=bin 抛 NotFound（Logical Invisibility）；须 includeRecyclebin=true 才能以下降方式遍历站内（见 §9.9）。

## 8. 统一性审计结论（最终状态）

### 8.1 双场景语义（最终审查确立）

应用存在两种使用形态，所有 API 行为按此二分自洽：

- **场景 A（隐藏回收站）**：全程默认视角。Bin 及其后代 = 不存在。所有读 NotFound、写 NotFound、导航跳过、导出不含。删除永远走 `recycle: true`（唯一入口）或对站外节点物理删除；`clearRecycleBin()` 照常可用（管理动作）。
- **场景 B（显示回收站）**：回收站视图的读写全程 `includeRecyclebin=true`。Bin 及其后代 = 普通节点：可列出（getChildren(bin)）、可重排（moveNode 站内）、可改名（update）、可物理删除（deleteNode，recycle 参数无效）、可移出（恢复 = moveNode 站内→站外）、可继续向站内 add/copy。事件遵循**状态跃迁规则**（见 move 节）：仅站外→站内跃迁发 deleted(recycled)，站内重排/移出/新增只发原生事件。
- **两个场景共用同一逻辑状态**：A 与 B 不是两份数据，是同一物理状态的两个视角。切换无成本，无迁移语义。

### 8.2 语义与直觉合规表

| 检查项 | 结论 |
|---|---|
| "删除的东西去了一个可找到的地方"（deleteNode recycle / findNode 默认查不到 / includeRecyclebin=true 找得到） | ✅ 自洽 |
| "回收站里的东西删了就是真删"（站内 deleteNode 物理删除） | ✅ 直觉一致 |
| "清空回收站不删回收站本身"（clearRecycleBin 保留 Bin） | ✅ OS 直觉一致 |
| 事件 = 状态跃迁（deleted(recycled) 仅站外→站内；重排/恢复/站内新增发原生事件，无重复删除信号） | ✅ 本轮修正 |
| 单一开关（startFrom 等参数不隐式改变视角；只有 includeRecyclebin 一个开关） | ✅ 本轮修正 |
| 祖先链不过滤（场景 B 父链完整：getParent(binChild)=bin） | ✅ 本轮确认理由 |
| Bin 位置不变量（恒根孩子层：无自包含悖论、回收内容不随业务子树消失） | ✅ 前轮定案 |
| DB 端过滤铁律（返回行数即最终行数，内存与回收规模无关） | ✅ 前轮定案 |

### 8.3 API 覆盖矩阵

| API 族 | 门控方式 | 豁免/说明 |
|---|---|---|
| 枚举/查找（getNodes/find*/getDescendants/getChildren/getSiblings/getDescendantCount/getNthChild） | SQL 闭区间过滤 | — |
| 精确查找 getNode | NotFound | — |
| 导航 getNextSibling/getPreviousSibling | 跳过 Bin 区间 | getParent/getAncestors/getAncestorsCount 不加过滤是场景 B 正确性要求（父链必须含 Bin），场景 A 不可达 |
| 写 API（delete/move/copy/add/**update**） | id 路径经 getNodeData/isInRecycleBin 抛 NotFound | **update 是唯一现状缝隙，必须显式实现门控** |
| 接收节点对象的 API | 不重查库（对象即凭证） | 对象引用只能来自 includeRecyclebin=true 的读取；伪造对象自担 |
| forEach/toJson/toList/FlexTree 内存树 | 加载链路自动过滤（getDescendants 的 SQL 已含条件，内存树只含逻辑存在节点） | — |
| verify/repair/clear | 不门控（内部机制/整树操作） | 明示豁免，文档写明 |
| canMoveTo | 与 moveNode 同视角透传 | 预检与执行一致 |
