# 回收站采用「Bin 节点 + moveNode 实现 + 全 API 逻辑不存在」

启用回收站后，库在根节点下维护一个**Bin 节点**（普通节点，配置指定 id/name，多树下 id 支持按 treeId 的函数形式、每树各自建站）。`deleteNode(node, {recycle: true})` 复用 `moveNode` 将子树整体移入 Bin 下（结构保持、level 重编）。

核心原则是 **Logical Invisibility（逻辑不存在）**：`includeRecyclebin=false`（默认）时，Bin 及其后代在**所有**公共 API——find/get/delete/update/forEach/copy/move/toJson/toList——中与不存在的节点表现完全一致（读查不到、写抛 NotFound、遍历不进入、导出不含）。`includeRecyclebin=true` 时 Bin 及其后代恢复为彻头彻尾的普通节点，一切操作照常。开发者需要向最终用户展示回收站（如文件管理器的回收站视图）时，显式传 `includeRecyclebin=true` 即可。

事件语义遵循**状态跃迁规则**：`node:deleted`（载荷带 `recycled: true` 标识）仅在节点发生「站外→站内」跃迁时发出——`deleteNode(recycle)`（另发 `node:recycled`）与直接 moveNode 进 Bin 均属此类。站内重排、恢复移出、向站内 add/copy 新节点均**不发** deleted（节点未发生逻辑存在性的变化，只发各自原生事件）。Bin 首次随 `write()` 懒创建（首写时确保存在；已存在同 id 行须在根孩子层，否则抛配置错误）。

## Considered Options

- **独立软删除标记列**（如 `deletedAt`）：需要 schema 变更与全接口改写，且与嵌套集坐标纠缠（被标记子树仍占左右值区间，祖先 rightValue 语义漂移）——否决。
- **移入独立的回收站树**（单表多树下专用 treeId）：跨树移动是单向的（当前树→目标树），恢复需反向移动不可达；且单树表无 treeId 列——否决。
- **Bin 节点模式**（采纳）：零 schema 变更、复用 moveNode 全部正确性保证、过滤条件只需 Bin 的左右值区间。
- **Bin 可见性三档演进**：① Bin 自身也隐藏 + 子孙隐藏（第一稿，闭区间过滤）→ ② Bin 可见叶子 + 子孙隐藏（第二稿，开区间过滤，OS 图标隐喻）→ ③ **Bin 与子孙统一逻辑不存在**（定稿）。③ 由用户澄清确立：被回收节点在逻辑上已删除，"部分可见"（② 的叶子形态）反而传达错误信号——默认视角不存在中间态；需要展示回收站是**应用层的显式选择**，由 `includeRecyclebin=true` 整体开启，而非库默认暴露入口。
- **Bin 位置：根孩子层（定稿）vs 树中任意位置**：任意位置引入三重负担——自包含悖论（删除 Bin 的祖先时须把子树移入它自己的后代，canMoveTo 天然拒绝，须另定特判语义）、回收内容随宿主子树的物理删除连带丢失、level 语义随宿主漂移。约束为根孩子后，Bin 的唯一祖先是根，`recycle(root)` 经 canMoveTo 自然报错，特判归零。代价仅两条校验：moveNode 以 Bin 为源时只允许留在根孩子层（含跨树禁止），初始化发现同 id 行不在根孩子层抛配置错误。

## Consequences

- **读写双侧统一过滤**：过滤不只是读接口的 WHERE 追加——delete/update/move/copy 等写操作的前置节点读取（getNodeData/getNode）同样过滤，Bin 内节点默认抛 NotFound。过滤条件为闭区间 `NOT (left >= binLeft AND right <= binRight)`（排除 Bin 自身及全部后代）。
- **「bin 内删除一律物理删除」随之失效**：默认视角下 Bin 内节点根本删不到（NotFound）。「物理删除被回收节点」必须先 `includeRecyclebin=true` 进入回收站视角，再 deleteNode（此时 recycle 参数无意义——已在站内，直接物理删除）。
- **回收站视角内的递归回收无意义**：`includeRecyclebin=true` 下对 Bin 内节点 deleteNode(recycle=true) 不产生二次移动——已逻辑删除的东西再"删除"即物理删除。
- **过滤一律数据库端完成（铁律）**：排除回收站的语义只以 leftValue/rightValue WHERE 条件进入 SQL，禁止拉取到应用层再过滤——返回行数即最终行数，内存消耗与回收内容规模无关。导航跳过 Bin 同样是 SQL 条件改写（如 getNextSibling 改为"同层且 leftValue 越过 Bin 区间的第一个逻辑存在节点"）。写操作对单个目标的存在性门控（按 id 点查判断是否落在 Bin 区间）是允许的例外——与既有的"先读节点再生成 SQL"模式同构。
- **过滤依赖 Bin 区间缓存**：读路径先取 Bin 区间（内存缓存、写事务提交后失效），未启用时零开销。repair 全量重建会改变 Bin 区间，但读时按当前区间过滤，自动适应。
- **导航接口的一致性问题**：getNextSibling/getPreviousSibling/getSiblings/getParent 等导航型接口若不过滤，相邻用户节点的 nextSibling 会返回"不存在"的 Bin——**导航接口同样受 includeRecyclebin 控制**（默认视角下 Bin 的物理前兄弟的 nextSibling 为其后第一个**逻辑存在**的节点，即跳过整个 Bin 子树区间）。这是 Logical Invisibility 原则的自然推论。
- **getRoot 物理值保留**：root.rightValue 含 Bin 区间（嵌套集不变量不许破坏）；verify/repair 把 Bin 子树当普通成员参与校验/重建（内部机制，不受 includeRecyclebin 影响）。
- **deleteNode(bin) ≡ clearRecycleBin()**：删 Bin 下所有子孙、Bin 自身保留；未启用时 `clearRecycleBin()` 静默返回、不发事件。两者均不受 includeRecyclebin 门控（管理动作而非对"被回收节点"的操作）。
- **MultiRoot 支持**：`MultiRootFlexTreeManager` 同样支持 recyclebin 配置，Bin 是隐藏根的子节点，读链路的隐藏根过滤与 Bin 过滤叠加，level 归一化照常覆盖 Bin 子树。
- **跨树入站不限**：跨树 move/copy 的 toNode 落在目标树 Bin 下是普通合法移动，不额外限制（落点是普通节点位置；**Bin 自身作为跨树移动源被禁止**——见位置不变量）。
- **Bin 位置不变量**：Bin 恒为根的子节点，顺序不限（可在根孩子层重排），不允许移往树中其他层级或跨树迁出。updateNode 改名照常，moveNode 以 Bin 为源时校验落点保持在根孩子层。
