/**
 * countField 基础设施：为节点数据附加"后代节点数量"字段（Descendant Count）
 *
 * 语义（ADR-0006）：
 *  - 公式 (rightValue - leftValue - 1) / 2（嵌套集不变量：子树 n 节点 → n-1 后代，叶子 = 0）
 *  - 可见口径：默认视角（回收站过滤）下扣减 Bin 子树规模，与返回内容同口径；
 *    includeRecyclebin=true 时不扣减
 *  - count 为全量后代数：不受 level 截断影响；与 id 同地位——指定 fields 过滤时照样附加
 *  - countField 值与节点已有字段重名时抛配置错误（防止业务数据被静默顶掉）
 */
import { FlexTreeError } from "../errors";

/**
 * 计算节点的物理后代数（不含自身）
 */
export function calcDescendantCount(leftValue: number, rightValue: number): number {
  return (rightValue - leftValue - 1) / 2;
}

/**
 * 校验 countField 合法性：与节点数据已有字段重名时抛 FlexTreeError
 *
 * 在附加前对样本数据校验一次即可（同批节点字段集相同）
 */
export function assertCountField(countField: string, sample: Record<string, any>) {
  if (countField in sample) {
    throw new FlexTreeError(
      `countField "${countField}" conflicts with an existing node field`,
    );
  }
}

/**
 * 为一批节点数据附加 count 字段（原地修改）
 *
 * @param nodes 节点数据数组（须含 leftValue/rightValue，自定义字段名由 keyFields 指定）
 * @param countField 附加字段名
 * @param keyFields 关键字段名映射
 * @param binRange 可见口径扣减：Bin 区间 {left, right}；undefined 表示不扣减
 *   （未启用回收站、Bin 尚未创建、或 includeRecyclebin=true 视角）
 * @param stripKeys 计算后需要从输出剥离的字段名（SQL 链路为计算而临时追加的 l/r，调用方传入）
 */
export function attachDescendantCount(
  nodes: Record<string, any>[],
  countField: string,
  keyFields: { leftValue: string; rightValue: string },
  binRange?: { left: number; right: number },
  stripKeys: string[] = [],
) {
  if (nodes.length === 0) return;
  assertCountField(countField, nodes[0]);
  for (const node of nodes) {
    const left = node[keyFields.leftValue];
    const right = node[keyFields.rightValue];
    let count = calcDescendantCount(left, right);
    // 可见口径：Bin 子树整体落在该节点子树内时扣减其规模（Bin 只可能挂根/隐藏根下，
    // 其余节点子树不含 Bin，left > binLeft 保证不会误减）
    if (binRange && left < binRange.left && right > binRange.right) {
      count -= calcDescendantCount(binRange.left, binRange.right) + 1; // Bin 自身 + 其后代
    }
    for (const key of stripKeys) {
      delete node[key];
    }
    node[countField] = count;
  }
}
