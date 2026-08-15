# 多根树采用隐藏根（Hidden Root）模式实现

多根树场景下，`MultiRootFlexTreeManager` 内部持有一个单树 FlexTreeManager：表里就是一棵普通的单根树，由管理器自动创建并维护一个**隐藏根**（level=0、leftValue=1），用户眼中的"多根"即该根的子节点，读接口过滤隐藏根、写接口直接委托。这样单树管理器的全部能力（跨"根"移动、兄弟导航、verify/repair、copy、forEach）原样保留，管理器不重复实现任何树逻辑。

命名说明：类名定为 `MultiRootFlexTreeManager` 而非最初的 MultipleFlexTreeManager——"Multiple" 会被读作"管理多棵树"（已否决的聚合池模型），且与代码库既有的 `isMultiTree`（treeId 单表多树特性）术语撞车。

## Considered Options

- **聚合池模式**（已否决）：扫描 treeId 列表，为每棵物理树建一个 FlexTreeManager 实例池，管理器做路由聚合。否决原因：跨树移动需要组合或重写 SQL、根节点间兄弟导航需虚拟模拟、写锁需全林改造、treeId 分配策略（含字符串 id）待定——成本高，且每引入一个新 mixin 都要评估聚合层的适配，部分特性可能丢失。
- **隐藏根模式**（采纳）：物理上仍是单根树，跨"根"操作退化为普通同树操作。

## Consequences

- **表布局**：多根表无 treeId 列需求，但始终存在一行隐藏根数据（默认 name=`__root__`），裸 SQL 可见。
- **level 惯例偏移**：用户根物理 level=1，对外归一化暴露为 0。读写链路的 level 映射必须与隐藏根过滤成对出现，是复杂度的真正所在；漏一处即数据错乱。
- **自愈**：隐藏根被外部删除后，下次 load() 自动重建（load 时若无根则创建）。
- **删除边界**：deleteNode 命中隐藏根抛 InvalidOperation；clear() 全删后重建隐藏根。
- **API 差异**：相对 FlexTreeManager 仅三处——无 getRoot/hasRoot/createRoot、新增 .nodes（用户根列表，同步属性，写后刷新）、toJson 返回多根嵌套数组。
