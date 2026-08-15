FlexTree 基于左右值算法（Nested Set Model），除 `repair` 与 `forEach` 外，**所有树操作的数据库访问次数均与树的规模无关**——不管树里是一百个还是一百万个节点，一次操作的往返次数与 SQL 条数都是常数。这是算法选型的核心收益：查询是坐标区间过滤（索引友好），写操作是**集合式 UPDATE**（一条 SQL 改一组行），逐行读写从不发生。

计数说明（下表口径）：

- **往返**：一次数据库交互（一条 SQL 的执行）；N 条 SQL 在 `write()` 事务内批量提交时，往返取决于适配器实现（better-sqlite3 内存库与 PostgreSQL 网络库不同），表中按 SQL 条数计。
- **读前置**：写操作需先读出目标节点坐标（`getNodeData`，1 条 SELECT）；启用回收站时写路径另有 bin 区间判定（bin 区间有内存缓存，仅首次/写后失效时 1 条 SELECT）。
- **锁**：`write()` 内所有写经适配器事务执行，锁范围 = 事务范围（同一表）；读不加锁（依赖数据库 MVCC/快照隔离），但会经**读守卫**等待进行中的写事务提交，避免读到中间态。

## 读操作

| API | SQL 条数 | 说明 |
| --- | --- | --- |
| `getRoot` / `hasRoot` | 1 | 按 `leftValue=1` 定位，索引命中 |
| `getNode` / `findNode` / `findNodes` | 1 | 点查/条件查；启用回收站默认追加 bin 区间过滤条件（仍是一条 SQL） |
| `getNodes` | 1 | 全树/限层列表，一条 SELECT（含 `where` 时的 NOT EXISTS 祖先完整性检查也在同一条内） |
| `getDescendants` / `getDescendantCount` | 1 | SELF-JOIN 区间查询；行数与子树规模相关，但 SQL 数恒为 1 |
| `getChildren` / `getNthChild` | 1 | 同上（限层/LIMIT）；`getNthChild` 用 `LIMIT 1 OFFSET n`，不拉全量孩子 |
| `getAncestors` / `getAncestorsCount` / `getParent` | 1 | 区间反向查询，`getParent` 加 `LIMIT 1` |
| `getSiblings` / `getNextSibling` / `getPreviousSibling` | 1 | 同层区间/坐标衔接查询 |
| `getNodeRelation` | 1~2 | 坐标比较可内存判定（0 条）；同层需判兄弟时 1 条；传 id 时另有 1 条解析 |
| `forEach`（DFS/BFS） | 逐节点查询 | **一次回调 = 一个节点及其全部子节点**：每个被访问节点执行 1 条 `getChildren`（一条 SQL 返回该节点的所有直接子节点，回收站过滤透传），回调签名 `(node, children)` 直接拿到子节点列表；总 SQL 数 = 访问节点数（回调次数）。`forEach` 专为遍历大型树表设计：**内存占用 O(宽度) 而非 O(节点数)**——BFS 队列只持有当前层的节点，DFS 回调处理完一个子树即释放，百万级节点遍历不需要把树装进内存。树形遍历本身无法用单条 SQL 表达，逐节点取子层是刻意的流式设计，而非缺陷 |
| `toJson` / `toList` | 2 | `load`（1 条全量 SELECT）+ 内存组装 |
| `verify` | 7 | 五项完整性检查 + 唯一性 + 层级关系，各 1 条，全部数据库端判断（不拉节点数据） |

## 写操作

:::warning 提示
所有写操作均在 `write()` 事务内进行
:::

| API | 读前置 | 写 SQL | 合计 | 说明 |
| --- | --- | --- | --- | --- |
| `createRoot` | 1（hasRoot） | 1 INSERT | 2 | |
| `addNodes`（n 个节点） | 1 | 3：2 条腾挪 UPDATE（集合式，与 n 无关）+ 1 条多值 INSERT | 4 | 批量插入一条 SQL 完成 |
| `update` | 0~1（回收站门控点查） | n 条 UPDATE | ≤ n+1 | 每节点一条按 id UPDATE |
| `deleteNode` | 1 | 3：1 DELETE（子树一条 SQL 删）+ 2 条回缩 UPDATE | 4 | 删除子树与子树规模无关 |
| `deleteNode(recycle)` | 2（节点 + bin） | 同 `moveNode` | ≈10 | 逻辑删除 = 移动进站，复用移动算法 |
| `moveNode` | 2（源 + 落点） | 5~8：3 条脱离（1 取负 + 2 回缩）+ 2~5 条腾挪/翻正（同树）；跨树为 7~9 条（隔离区两段平移多 2 条） | 7~11 | 全部集合式 UPDATE，与子树规模无关；跨树时 treeId 改写与坐标翻正在同一条 UPDATE 内完成（规避唯一约束中间态） |
| `moveUpNode` / `moveDownNode` | 1~2 | 同 `moveNode` | ≈10 | 内部定位前/后兄弟后走 `moveNode` |
| `copyNode` | 2（源 + 落点） | 5：4 条（INSERT...SELECT 暂存 + 2 腾挪 + 翻正）+ 1 条副本根反查 | 7 | INSERT...SELECT 在数据库内完成整棵子树复制，不逐行读取 |
| `clear()` | 0 | 1 DELETE | 1 | |
| `repair` | 1（全量 SELECT） | m（值变化节点数） | m+1 | **唯一随规模增长的操作**：读出全树→内存重算→只更新变化的行；正常调用时 m=0（0 条 UPDATE） |
| `clearRecycleBin` | 1（bin）+ 每轮 1 | 3×站内顶层子树数 | ≈4×k | 逐个顶层子树物理删除（每轮重读坐标保证正确性） |

## 锁与并发

| 场景 | 行为 |
| --- | --- |
| 写事务 | `write()` 串行（同一 manager 实例重入抛错）；锁范围 = 事务涉及的表行（具体行锁/页锁取决于数据库引擎） |
| 并发读 | 不阻塞——但 `_guardRead` 使事务外读等待进行中的写提交，防止读到取负/腾挪的中间态 |
| 同表多树 | 各 `treeId` 的写事务仍锁同一张表（行级锁数据库下不同树的行不互斥；SQLite 整库锁下串行） |
| 跨树移动 | 源树与目标树在同一事务内锁定，保证两侧坐标变更原子 |

## 成本总结

按树的规模（n = 节点数、s = 操作涉及的子树大小、b = 树的分支宽度）归纳各 API 的复杂度：

| 维度 | 常数成本（O(1) SQL） | 线性成本（O(n) 或 O(s)） |
| --- | --- | --- |
| SQL 条数 | 全部单点/区间查询；`addNodes`/`deleteNode`/`moveNode`/`copyNode`（集合式写） | `forEach`（O(n) 条流式查询）、`repair`（O(s) 条修正 UPDATE）、`update`（O(批量数)）、`clearRecycleBin`（O(顶层子树数)） |
| 数据传输（返回行数） | `getNode`/`getRoot`/导航类（≤1 行） | `getNodes`/`getDescendants`/`toJson`/`toList`（结果集本身有多大传多大——这是查询语义，不是实现代价） |
| 应用层内存 | 写操作全部（集合 SQL 不装载数据）、`forEach`（O(b) 流式） | `toJson`/`toList`/`FlexTree.load`（整树进内存）、`repair`（整树进内存重算） |
| 锁持有时间 | 单点写（毫秒级事务） | 大子树移动/删除（事务覆盖全部集合 UPDATE，影响行数多则持锁久）；`repair` 全树重建事务 |

**选型建议：**

- **在线服务（高频读写、树可大）**：全部 API 直接可用——写操作恒定 SQL 条数、锁范围与事务时长可控；大子树移动的影响行数由索引承担
- **超大树遍历/导出（百万级）**：用 `forEach`（流式、O(b) 内存）而非 `toJson`（整树进内存）；导出走 `toList` 流式处理结果集
- **结构异常恢复**：`repair` 是唯一整树重算的操作，安排在低峰期执行
- **回收站**：不改变任何 API 的复杂度——过滤是 SQL 里的一个区间条件，bin 内堆多少节点都只影响该区间内被排除的行

:::tip 规模无关性
记忆方法：**除 `forEach`（遍历）与 `repair`（重建）外，任何 API 的 SQL 条数都是常数**。移动一棵十万个节点的子树，与移动一个叶子节点，执行的 SQL 条数完全相同——代价只体现在 UPDATE 影响的行数上，由数据库引擎在索引上高效完成。`forEach` 的逐节点查询同为刻意设计：流式遍历让内存与树规模解耦，专为大型树表而生。
:::
