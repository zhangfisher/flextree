# FlexTree

基于 Nested Set Model（左右值算法）的树结构存储与管理库。本文件是领域术语表，只定义语言，不记录实现细节。

## Language

### 树形态

**Multi-Root Tree（多根树）**:
用户视角下拥有多个顶层节点的树。以"隐藏根 + 过滤"实现：物理上仍是单根嵌套集树，顶层节点实为隐藏根的子节点，此细节对外不可见。公共入口为 `MultiRootFlexTreeManager`。
_Avoid_: 森林、Forest、多树、树的集合；类名 MultipleFlexTreeManager、MultiTreeManager（指向多物理树模型）

**Hidden Root（隐藏根）**:
多根树内部自动创建并维护的真实根节点（level=0、leftValue=1），对外不可见。承担"用户根的父节点"角色，使所有单树操作原样可用。
_Avoid_: 虚拟根、超级根

**User Root（用户根）**:
用户可见的顶层节点。物理 level=1，对外暴露为 level=0；用户根之间是真实的兄弟关系（同一隐藏根之子），无需模拟。
_Avoid_: 根节点（与 Hidden Root 歧义时）、一级节点

**Level Normalization（level 归一化）**:
读写链路上对 level 做 -1/+1 映射：读出的用户根显示 level=0，写入的层级语义按用户视角换算。与隐藏根过滤必须同链路成对出现。
_Avoid_: 层级偏移

### 节点操作

**Source Node（源节点）**:
被 `copy` 复制的原始节点，通过 `nodeId` 指定。
_Avoid_: 原节点、被复制节点

**Destination（落点参照）**:
落点参照节点（`copyNode` 的 `to` / `moveNode` 的 `toNode` 参数），副本或移动子树以 `pos` 描述的相对关系落在其旁。copyNode 缺省时等于源节点自身。
_Avoid_: 目标节点、target

**Target Tree（目标树）**:
跨树 copy/move 的 `options.treeId` 所指的树，操作完成后子树归属该树。等于当前树时视为同树操作。
_Avoid_: 新树、目的树

**Copy Root（副本根）**:
复制操作产生的新子树的根节点，是 `copyNode` 的返回值。其字段与源节点完全相同，仅 id 不同。
_Avoid_: 新节点、副本节点

**Position Attributes（位置属性）**:
由落点决定、不属于被复制业务数据的字段：treeId、level、leftValue、rightValue。复制时按 Destination 重新计算，不照抄源节点。
_Avoid_: 结构字段

### 读取与导出

**Descendant Count（后代数）**:
节点在**当前读取视角**下的后代节点总数（不含自身）。恒为全量：不受 `level` 截断影响；默认视角下与导出内容同口径——被回收的节点不计入，`includeRecyclebin=true` 时照常计入。
_Avoid_: 子节点数（childrenCount，另有所指——直接孩子的数量）、物理后代数（指未扣减回收站的口径）

### 回收站

**Recycle Bin（回收站）**:
由 `recyclebin` 配置启用、悬于根节点之下的逻辑删除区。物理上是一个普通节点（Bin Node），其子树承载被逻辑删除的节点。未配置即不存在，功能整体关闭。
_Avoid_: Trash、垃圾箱、软删除区

**Bin Node（回收站节点）**:
回收站的物理载体：恒为根节点的子节点（位置不变量：始终在根的孩子层，顺序不限、可在其中重排；不允许移往树中其他位置或跨树）。配置时指定 id 与 name。默认视角下与其后代一并不可见（Logical Invisibility）；`includeRecyclebin=true` 时是彻头彻尾的普通节点——可见、可增删改。`clearRecycleBin()` 删除其全部子孙、保留自身。
_Avoid_: 回收站根、特殊节点、系统节点

**Recycled Node（被回收节点）**:
位于 Bin Node 子树内的节点（不含 Bin 自身），处于逻辑删除状态。level 为进站时重新编号后的实际值，不保留原位层级。
_Avoid_: 已删除节点、软删除节点

**Logical Deletion（逻辑删除）**:
`deleteNode(node, {recycle: true})` 的语义：子树经 moveNode 进入回收站，结构保持、数据保留，但从逻辑树上消失。逻辑删除的解除（恢复）由开发者自行以 `includeRecyclebin=true` 读取后 moveNode 移出完成。事件遵循**状态跃迁规则**：`node:deleted`（带 `recycled: true`）仅在「站外→站内」跃迁时发出；站内重排、恢复移出、向站内新增节点只发各自原生事件。
_Avoid_: 软删除、假删除（假删除另有所指——moveNode 的 detach 中间态）

**Logical Invisibility（逻辑不存在）**:
`includeRecyclebin=false`（默认）时 Bin 及其后代的统一表现：在**所有** API（find/get/delete/update/forEach/copy/move/toJson/toList）中与一个不存在的节点表现完全一致——读查不到、写抛 NotFound、遍历不进入、导出不含。应用需要展示回收站时由开发者显式传 `includeRecyclebin=true`。
_Avoid_: 隐藏（Hidden Root 的隐藏是对外不可见但始终存在于管理器内部，两者机制不同）

**includeRecyclebin**:
所有公共 API 的统一开关。`false`（默认）：Bin 及其后代逻辑不存在；`true`：Bin 及其后当普通节点参与一切操作。
_Avoid_: withTrash、includeDeleted

### 事件

**SQL Commit（SQL 提交）**:
一次 `write` 事务内执行的全部 SQL，在事务 COMMIT 前的聚合呈现时刻。事件 `write:commit` 携带 `{ tree, sqls }` 在此时触发：只读通知（监听器异常不回滚事务）、空批不触发（未执行 SQL 的 write 不通知）、无操作归属字段（混合操作下无法明确定义，调用方意图由 node:* 事件族表达）。
_Avoid_: beforeExecute（那是逐批执行前的语义，粒度与能力均不同）、SQL 审计钩子（暗示可改写/可中止）

**Committed Write（已提交写）**:
确认事务提交成功后的 `write:after` 时刻，payload 为 `{ committed: true }`；回滚则为 `{ committed: false }`。是内存树可以安全据此失效的唯一信号——COMMIT 前的任何事件（node:*、write:commit）都可能随回滚化为乌有。
_Avoid_: 提交事件（与 write:commit 字面撞名）、成功事件

**Structural Event（结构事件）**:
改变树形状的节点事件族：`node:added`、`node:deleted`、`node:recycled`、`node:moved`、`node:cleared`。左右值算法下任何结构写都会大范围重编号既有节点（事件 payload 不含其新值），因此结构事件对内存树的含义恒为**整树失效**，不存在"只补一个节点"的增量语义。与 **Data Event（数据事件）**（仅 `node:updated`，只改节点自身字段）相对。
_Avoid_: 增量事件、局部事件

### 内存树

**Live Tree（活树）**:
`FlexTree` 与其 manager 共享同一 `FlexTreeManager` 实例（单例，键为表名+treeId）时的形态：已提交写触发的 `node:*` 事件被树捕获，内存树置脏并**自动启动全量重载**——"活"指自动感知本实例上的写并自我修复。重载期间的读操作抛 `FlexTreeDirtyError`（脏读防护）。自身发起的写（`FlexTree.update`）不触发重载：写路径已同步刷新内存。不改变一个边界：进程外/其他实例的写仍不可见，兜底手段是 `sync()`。
_Avoid_: 实时树（暗示跨进程可见）、响应式树、双向绑定树

**Dirty Flag（脏标记）**:
`FlexTree.dirty`：整树级，已提交写确认树已变化且重载未完成（或已失败）时为 true——内存树不可信。树清空（clear）是合法终态：重载发现无树时清脏收场。不存在节点级脏（实现成本过高，已明确否决）。
_Avoid_: 过期标记、缓存失效（实现语汇，非领域语汇）

**Shared Manager Config（共享管理器配置）**:
单例 manager 承载的是**连接与存储配置**（adapter、字段映射、treeId、回收站）；`lazy` 是 `FlexTree` 实例自己的读取行为，不进共享配置——同表同树可同时存在懒/非懒两棵树。
_Avoid_: 树配置（与 FlexTreeOptions 混淆）

**Multi-Root Memory Tree（多根内存树）**:
`MultiRootFlexTree`：多根树的内存查询形态，与 `FlexTree` 同构（Live Tree、lazy、脏读防护全套继承）。`.nodes` 返回用户根的节点实例列表——与 `MultiRootFlexTreeManager.nodes`（纯数据快照）同名不同物。用户根节点 `parent=undefined`、`root=自身`、`siblings=其余用户根`；隐藏根在内存树中不存在。
_Avoid_: 多根 FlexTree（口语可，正式命名避免）、MultiTree（指向多物理树模型）

### 适配器

**Adapter（适配器）**:
实现 `IFlexTreeAdapter` 契约的数据库驱动封装，负责 exec/getRows/getScalar/transaction 的方言落地。核心库只面向契约编程，不感知具体驱动。
_Avoid_: driver、connector、binding（另有所指——框架集成层）

### HTTP API

**API Provider（API 提供者）**:
将 FlexTreeManager 的能力映射为 HTTP RESTful 资源的核心服务对象：持有树注册表、定义资源路径与操作语义、完成参数校验与错误映射。本身不监听端口、不感知任何 web 搆架，通过 Binding 挂载到宿主框架。
_Avoid_: HTTP 服务、API 服务器（暗示自带监听）、HTTP adapter（与数据库 Adapter 冲突）

**Binding（框架绑定层）**:
把宿主 web 框架（express/hono/elysiajs 等）的请求/响应转写为标准 Fetch API（WinterCG `Request => Response`）的薄集成层，每框架一个 routes 工厂函数（如 `createExpressRoutes`、`createHonoRoutes`）。只做转写与挂载，不含业务逻辑。
_Avoid_: adapter（保留给数据库适配器）、integration、bridge

**Tree Registry（树注册表）**:
API Provider 持有的 `名称 → FlexTreeManager` 映射。用户显式注册（`register(treeName, manager)`），请求经 `/:treeName` 段路由到对应 manager。treeName 是 HTTP 层命名，与表内 treeId 字段解耦。
_Avoid_: 树池、manager 集合

**Standard Handler（标准处理器）**:
基于 WinterCG Fetch API 的纯函数路由处理器 `(Request) => Promise<Response>`，配套声明式路由表。是 API Provider 的唯一业务出口，各框架 Binding 绁一委托给它。
_Avoid_: controller、框架 handler

**API Service（API 服务）**:
API Provider 的实现主体（`FlexTreeApiService`）：持有 Tree Registry 与 per-manager 写队列，接收 Standard Handler 解析出的普通对象参数，调用 FlexTreeManager/MultiRootFlexTreeManager 完成操作。Binding 与 Standard Handler 均不含业务逻辑，业务只存在于此层。
_Avoid_: controller 层、FlexTreeApiProvider（类名）

**Binding Product（绑定产物）**:
Routes 工厂返回的框架原生路由形态：hono 子应用、express Router、elysia 插件、nextjs handler 映射。**不是**可监听的服务实例——挂载路径、挂载方式、生命周期全由宿主决定。
_Avoid_: 服务器实例、app（暗示库创建框架 app）

**Write Queue（写队列）**:
per-manager 的 promise 链：每个 HTTP 写请求包成一个 `manager.write()`（一请求一原子事务），同树写请求串行执行，对客户端透明。跨树原子写在 v1 不支持。
_Avoid_: 写锁（是排队不是锁）、事务池

**Where Filter（等值过滤）**:
读端点的平铺等值 query 参数（`?name=xx&level=1`），key 必须命中树注册时声明的字段白名单，否则 400。只支持 AND 等值，不支持运算符——LIKE/IN/比较留给后续版本。
_Avoid_: where 透传（暗示任意对象直传 DB）、查询语言

**Offset Pagination（偏移分页）**:
仅 `GET /{tree}/nodes` 支持的 `?limit/&offset` 分页。执行层为内存切片（getNodes 全量查询后切窗）——省传输不省查询，total 即结果集长度。带任一分页参数时响应变为 envelope `{items,total,limit,offset}`；不带则保持裸数组（向后兼容）。
_Avoid_: cursor 分页、页码分页（page/pageSize）

**OpenAPI Document（OpenAPI 文档）**:
由声明式路由表 + 参数 spec 生成的 OpenAPI 3.1 文档。默认经内置 `GET /openapi.json` 路由直接可下载（binding 挂载点之下；`openapi.enabled:false` 可关）；`generateOpenApiDocument(service, opts)` 纯函数另供写文件/CI 校验等进阶用法。servers 缺省按 binding basePath 推导，宿主可显式覆盖。
_Avoid_: Swagger（是生态工具名，非文档标准名）、swagger.json（旧版 2.0 文件名）

**Node Schema（节点模式）**:
注册时可选的 `nodeSchema`（JSON Schema），注入 OpenAPI 文档精确描述业务字段；未提供时文档使用宽 schema（additionalProperties: true + 按 keyFields 列出关键字段）。
_Avoid_: 字段白名单（另有所指——Where Filter 的 fields）

**Injected Instance（注入实例）**:
适配器构造契约：调用方自行完成驱动的初始化（含异步部分）后传入现成实例，适配器不负责创建与生命周期。sqlite、sqljs 适配器均属此类。
_Avoid_: 托管模式、自建实例

**Persist Hook（持久化钩子）**:
`onPersist(db)` 回调，sqljs 适配器专属：仅在有写操作的事务成功 COMMIT 后被 await 触发，参数是 db 实例（导出与否、导出到哪由调用方决定）。抛错以 FlexTreeSqljsPersistError 包装上抛——此时内存已提交、快照未落地。
_Avoid_: 自动保存、autosave（暗示适配器决定存储位置，实际相反）
