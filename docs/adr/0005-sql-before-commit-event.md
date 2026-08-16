# SQL 提交前事件：write:commit（COMMIT 前聚合、只读通知）

用户需要感知即将落库的 SQL。候选拦截点有两个：exec 批次前（每批 SQL 执行前逐批触发，可改写）与事务 COMMIT 前（SQL 已执行未提交，聚合整个 write 的 SQL，只可审查）。决定采用后者：`write(fn)` 事务回调完成后、`adapter.transaction` 发出 COMMIT 前，聚合本次事务收集到的全部 SQL 触发一次 `write:commit`，载荷 `{ tree, sqls: string[] }`。

> 事件命名统一：后续决定将全部写生命周期事件归入 `write:*` 命名空间——`beforeWrite`→`write:before`、`afterWrite`→`write:after`、本事件的暂定名 `sql:beforeCommit`→`write:commit`（破坏性重命名，未发布兼容层）。

三个关键边界：

- **只读通知**：监听器抛出的异常被捕获吞掉，事务照常提交——事件不介入执行结果（与 write:before/write:after 的事件定位一致，不是守门钩子）。
- **空批不触发**：write 内未执行任何 SQL 时（sqls.length === 0）不触发。对齐 sqljs 适配器 Persist Hook 的既有先例「仅在有写操作的事务成功 COMMIT 后触发」。
- **无 operate 字段**：聚合视角下「这批 SQL 属于哪个操作」在多操作混合（moveNode 内部 detach + move、回收站懒建 bin）时无法明确定义，与其报模糊值不如不报；调用方意图已由 `node:*` 事件族表达。

## Considered Options

- **exec 批次前触发（sql:beforeExecute）**：粒度细、可逐批改写 SQL，但需要 13 个调用点显式传 operate、载荷须传引用、监听器异常语义复杂（中途抛错留下半执行事务）。需求是"看到 SQL"而非"改写 SQL"，能力过剩。
- **operate 字段（API 方法名/语义动词）**：一经发布即公共 API 契约，中间态 SQL（懒建 bin、detach）归属只能折中，承诺越多反悔成本越高。

## Consequences

- SQL 收集点在 `onExecuteSql`（core 内唯一写 SQL 汇入点），事件触发点在 `write` 的事务回调之后、COMMIT 之前——收集与触发分离但都在 manager 层，不侵入 adapter 契约。
- repair 等经 write 复用写机制的路径天然覆盖；绕过 write 直接调 onExecuteSql 的路径（若存在）不在事件覆盖范围。
- `MultiRootFlexTreeManager` 不转发此事件（与 write:before/write:after 同档：由各管理器的 write 自行承载）；其内部单树 manager 会照常触发，mm 的订阅者不可见。
