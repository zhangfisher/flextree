---
"flextree": patch
---

回收站增强：`createRoot()` 创建根节点后自动创建回收站（bin）节点，根节点的 rightValue 从创建起即包含 bin 区间；存量树（根已存在但 bin 缺失）由首次 `write()` 兜底补建。同时修复 `addNodes` 内部未 `await` 导致 SQL 错误被吞、事务带伤提交的静默损坏问题；`write()` 回滚时重置 bin 懒创建标记。新增配置校验：数字类型的 `recyclebin.id` 必须大于 1（负数会与移动算法的取负语义冲突，0/1 与根节点自增 id 冲突），违反时构造即抛错。
