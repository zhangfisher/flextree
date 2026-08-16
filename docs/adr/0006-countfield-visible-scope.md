# 读取与导出的 countField：可见口径后代数，统一附加到全部读取 API

为 toJson/toList 及全部读取 API 提供 `countField?: string` 选项：指定后在每条返回的节点数据上附加一个字段，值为该节点的**后代节点数量**。核心公式 `(rightValue - leftValue - 1) / 2`（嵌套集不变量：子树 n 节点 → n-1 后代，叶子为 0）。

四个关键决策：

- **命名 `countField` 而非 `withCountField`**：与既有 `pidField`/`childrenField` 的「<含义>Field」惯例一致——选项值回答"count 写入哪个字段"，而非"是否附带"（不传即不附带，无需 with 前缀）。
- **可见口径（Visible Scope）**：默认视角（回收站过滤生效）下 count 扣减 Bin 子树规模，与导出内容同口径——"看到的数字 = 看到的树"。`includeRecyclebin=true` 时不扣减。扣减利用既有 Bin 区间缓存（`_getBinRange`），O(1) 成本。Bin 子树只可能挂在根（单树）或隐藏根（MultiRoot）之下，**用户可见节点的子树永不含 Bin**，故只有根/隐藏根自身的 count 受影响；隐藏根本身不导出，实际只有单树 `FlexTree.toJson/toList` 的根节点数字需要扣减。
- **count 恒为全量后代数**：不受 `level` 截断影响（toJson/toList 的 level 限定、getDescendants 的 level 参数均不改变 count）——语义是"折叠节点上的子树规模徽标"，且公式天然如此。与 `getDescendantCount(node, {level:0})` 在默认视角下结果相等，互为一致性锚点。
- **SQL 读取链路在数据库端计算（实现修正）**：第一版在 JS 端遍历结果集计算，经评审修正——count 以 SELECT 表达式下推数据库：`(right-left-1)/2 AS countField`，Bin 扣减同样以 `CASE WHEN` 表达式完成（与"数据库端过滤铁律"同构）。五方言整数除法安全（差值恒偶数，无截断歧义），且免去应用层遍历成本。`toJson/toList` 是内存树递归导出，数据已在内存，保留 JS 就地计算（非结果集再遍历）。

## Considered Options

- **`withCountField` 命名**：提案原名。与库内命名惯例冲突（无先例），否决。
- **物理口径（公式原样，不扣减 Bin）**：count 恒等于物理后代数，实现少一步，但启用回收站后根节点数字与可见树不符，与 Logical Invisibility 的"默认视角下与不存在表现一致"原则矛盾，否决。
- **count 跟随 level 参数**：`getDescendants(node, {level:2})` 时只算 2 层内。与导出口径不一致、破坏 O(1) 公式（需额外 COUNT 查询），否决。
- **仅 toJson/toList（最小范围）**：提案字面范围。用户明确选择扩展到全部读取 API——用户心模统一为「读到节点数据就有 countField」，避免"这个接口有那个接口没有"的记忆负担。
- **静默覆盖重名字段**：不做校验、count 最后写入优先生效。误配（表已有业务列 count，或误填 level）会悄悄顶掉业务数据，违背 fail-fast，否决。
- **JS 端遍历结果集计算（第一版实现，已修正）**：读取后遍历行数据在应用层算 count。能工作但多一次遍历、且与"数据库端过滤铁律"的精神相悖——经评审修正为 SELECT 表达式下推（见上）。

## Consequences

- **附加字段与 id 同地位**：指定 `fields` 过滤时 count 照样附加（如 id 一样不受 fields/includeKeyFields 排除逻辑影响）；`FlexTreeExportJsonFormat`/`FlexTreeExportListFormat` 类型相应扩展。
- **重名即抛错**：`countField` 值与节点已有字段（含自定义字段名映射后的键字段）重名时抛配置错误（FlexTreeError），防止业务数据被静默顶掉。校验在 JS 端完成——SQL 端列重名只会静默覆盖，无法把关；以一行全量样本（`SELECT * ... LIMIT 1`）判定，O(1) 成本。
- **SQL 计算由 `_countExpr` 统一生成**：`FlexTreeManager._countExpr(countField, includeRecyclebin, alias?)` 是唯一的表达式出口（含可选 Bin 扣减的 CASE WHEN），各查询点拼入 SELECT 子句；`_assertCountField` 是唯一的重名校验出口。
- **单节点读取 API 同样支持**：getNode/getParent/getRoot/getNthChild/getNextSibling/getPreviousSibling 照常附加，覆盖面与集合类 API 一致。
- **MultiRootFlexTreeManager 免特殊处理**：countField 经由底层 FlexTree 导出链路自动生效，隐藏根不导出、Bin 恒在隐藏根之下，无额外口径问题。
- **`getDescendantCount` 不受影响**：既有 API 保持原样；两者（level=0、默认视角）结果相等是文档化的不变量，测试应覆盖。
