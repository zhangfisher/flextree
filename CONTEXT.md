# FlexTree

基于 Nested Set Model（左右值算法）的树结构存储与管理库。本文件是领域术语表，只定义语言，不记录实现细节。

## Language

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
