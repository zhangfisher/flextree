# 跨树移动采用"脱离取负 + 目标树腾挪 + 翻正同语句改写归属"的 SQL 策略

单表多树下跨树移动 moveNode 时，源子树脱离（取负）复用既有 detach 机制，但腾挪/翻正 SQL 必须显式限定目标树（不能用 `{__TREE_ID__}` 注入源树条件），且节点的 treeId 改写与坐标翻正在**同一条 UPDATE** 中完成——中间态 `(源treeId, 目标树坐标)` 在 UNIQUE(treeId, leftValue) 约束下会撞源树剩余节点的坐标，无约束时则静默产生重复坐标。跨树时源树脱离不影响目标树坐标，故 `_moveTo*` 中"目标在源右侧则扣减 movedLength"的 `adjustedToNode*` 计算必须跳过。

翻正分两条语句（leftValue 在前、rightValue 在后），leftValue 翻正语句已把移动行改写为目标树归属，故 rightValue 翻正语句的 WHERE 必须按**目标树**过滤（按源树过滤恒不命中，rightValue 残留负值）。目标树腾挪的 leftValue 平移采用高隔离区两段平移（与 copyNode 的 quarantineOffset 同源），规避 UNIQUE 约束下单条 UPDATE 逐行检查撞车。目标树祖先链无需额外补偿——各落点的腾挪 rightValue 条件天然覆盖全部祖先。

## Considered Options

- 翻正后单独 UPDATE 改写 treeId：存在中间态，UNIQUE 约束下直接失败——否决。
- 腾挪后追加祖先链补偿 UPDATE：实测与腾挪条件重复计算导致祖先 rightValue 双倍加成——否决（腾挪条件本身覆盖祖先）。
- 应用层读出/重插（类似 repair 的全量重建）：与"数据库访问次数与子树规模无关"的既有性能承诺冲突——否决。

## Consequences

- 4 个 `_moveTo*` 需感知跨树标志，SQL 生成分支增多；换来跨树移动与同树移动同样保持集合 SQL 原子完成。
- **方向单向**：跨树移动只能"当前树 → 其他树"（源经 `{__TREE_ID__}` 过滤天然限定），反向由目标树侧 manager 执行。
- 跨树移动触发两个事件：先 `node:deleted`（源树视角，节点被移离），后 `node:moved`（`toTree` 指向目标树）。
- 跨树移动根节点是允许的：整棵源树并入目标树，**等效删除原树**。操作成功后原 manager 失效（读空、写抛错），如需复用该 treeId 须重新 createRoot——此语义已写入用户文档。
- 跨树且 toNode 缺省 = **迁出为新树**：脱离后直接翻正到空树的 [1..span] 区间（level 归零到根、treeId 同语句改写），无腾挪；目标 treeId 已有树则前置校验抛错（否则翻正与既有根撞 UNIQUE）。
- 目标为目标树根节点时禁 sibling 位（根无兄弟，同树/跨树同规则）。
- 多树表的节点 id 是表主键、全表唯一——设计时无需考虑跨树同 id 消歧（曾按"可能同 id"设计过，用户澄清后移除）。
