# FlexTree

基于 Nested Set Model（左右值算法）的树结构存储与管理库。本文件是领域术语表，只定义语言，不记录实现细节。

## Language

### 节点操作

**Source Node（源节点）**:
被 `copy` 复制的原始节点，通过 `nodeId` 指定。
_Avoid_: 原节点、被复制节点

**Destination（落点参照）**:
副本插入位置的参照节点（`copy` 的 `to` 参数），副本以 `pos` 描述的相对关系落在其旁。缺省时等于源节点自身。
_Avoid_: 目标节点、target

**Copy Root（副本根）**:
复制操作产生的新子树的根节点，是 `copyNode` 的返回值。其字段与源节点完全相同，仅 id 不同。
_Avoid_: 新节点、副本节点

**Position Attributes（位置属性）**:
由落点决定、不属于被复制业务数据的字段：treeId、level、leftValue、rightValue。复制时按 Destination 重新计算，不照抄源节点。
_Avoid_: 结构字段
