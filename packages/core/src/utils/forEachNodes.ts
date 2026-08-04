/**
 * 节点遍历工具
 *
 * 提供基于左右值（Nested Set Model）的扁平节点数组遍历与子树完整性检测能力。
 * 与 utils/forEachNestTree 不同，本工具面向已展平为 { leftValue, rightValue, level } 的节点数组，
 * 不依赖 children 嵌套结构，可独立用于树校验、修复前置检测等场景。
 */
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  DefaultTreeKeyNameFields,
} from "../types";

/**
 * 遍历/修复选项
 */
export interface RepairTreeOptions<
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> {
  /**
   * 关键字段映射
   */
  keyFields?: KeyFields;

  /**
   * 表名（可选，仅用于调试信息）
   */
  tableName?: string;

  /**
   * 树 ID。
   * - 为空（undefined/null）：代表单树表，repairTree 不处理 treeId 字段
   * - 有值：代表多树表，repairTree 修复后会将该 treeId 注入到每个结果节点
   */
  treeId?: any;
}

/**
 * forEachTree 回调函数类型
 */
export type ForEachTreeCallback = (context: {
  index: number;
  node: Record<string, any>;
  isEnter: boolean; // true: 进入节点, false: 退出节点
  error?: string; // 错误信息
}) => void;

/**
 * 获取默认字段映射
 */
function getDefaultKeyFields(): DefaultTreeKeyNameFields {
  return {
    id: "id",
    name: "name",
    level: "level",
    leftValue: "leftValue",
    rightValue: "rightValue",
    treeId: "treeId",
  };
}

/**
 * 获取实际的字段名
 */
export function getFieldNames<KeyFields extends CustomTreeKeyFields>(
  options: RepairTreeOptions<KeyFields>,
): DefaultTreeKeyNameFields {
  return {
    ...getDefaultKeyFields(),
    ...(options.keyFields as any),
  };
}

/**
 * 获取节点字段值
 */
export function getNodeValue(
  node: Record<string, any>,
  field: string,
  keyFields: DefaultTreeKeyNameFields,
): any {
  return node[keyFields[field as keyof DefaultTreeKeyNameFields] as string] || node[field];
}

/**
 * forEachTree - 按照左右值算法遍历节点
 *
 * 算法原理：
 * 1. 按 leftValue 排序节点
 * 2. 使用计数器模拟树的遍历，从最小 leftValue 开始递增
 * 3. 每个节点应该被访问两次（进入和退出）
 * 4. 计数器值应该与节点的 leftValue 和 rightValue 匹配
 *
 * @param nodes - 节点数组
 * @param callback - 遍历回调，每个节点调用两次（进入和退出）
 * @param options - 遍历选项
 * @returns 破坏点的索引，如果树完整则返回 -1
 */
export function forEachTree<KeyFields extends CustomTreeKeyFields>(
  nodes: Record<string, any>[],
  callback: ForEachTreeCallback,
  options: RepairTreeOptions<KeyFields> = {},
): number {
  if (nodes.length === 0) {
    return -1;
  }

  const keyFields = getFieldNames(options);

  // 复制并按 leftValue 排序
  const sortedNodes = [...nodes].sort((a, b) => {
    const leftA = getNodeValue(a, "leftValue", keyFields);
    const leftB = getNodeValue(b, "leftValue", keyFields);
    return (leftA as number) - (leftB as number);
  });

  // 获取最小和最大值
  const minLeftValue = getNodeValue(sortedNodes[0], "leftValue", keyFields) as number;
  const maxRightValue = Math.max(
    ...sortedNodes.map((n) => getNodeValue(n, "rightValue", keyFields) as number),
  );

  // 遍历计数器，从最小 leftValue 到最大 rightValue
  let counter = minLeftValue;
  let maxCompleteIndex = -1; // 记录完整遍历到的最大索引

  // 创建 leftValue 到节点索引的映射，用于快速查找
  const leftToIndex = new Map<number, number>();
  sortedNodes.forEach((node, idx) => {
    const leftValue = getNodeValue(node, "leftValue", keyFields) as number;
    leftToIndex.set(leftValue, idx);
  });

  // 创建 rightValue 到节点索引的映射
  const rightToIndex = new Map<number, number>();
  sortedNodes.forEach((node, idx) => {
    const rightValue = getNodeValue(node, "rightValue", keyFields) as number;
    rightToIndex.set(rightValue, idx);
  });

  // 使用栈来跟踪未退出的节点
  const stack: number[] = [];

  while (counter <= maxRightValue) {
    // 检查当前 counter 对应的是进入还是退出
    const enterIndex = leftToIndex.get(counter);
    const exitIndex = rightToIndex.get(counter);

    if (enterIndex !== undefined && exitIndex !== undefined) {
      // 同时有进入和退出（说明是叶子节点）
      const node = sortedNodes[enterIndex];
      callback({ index: enterIndex, node, isEnter: true });
      callback({ index: enterIndex, node, isEnter: false });
      maxCompleteIndex = Math.max(maxCompleteIndex, enterIndex);
      counter++;
    } else if (enterIndex !== undefined) {
      // 只有进入
      const node = sortedNodes[enterIndex];
      callback({ index: enterIndex, node, isEnter: true });
      stack.push(enterIndex);
      maxCompleteIndex = Math.max(maxCompleteIndex, enterIndex);
      counter++;
    } else if (exitIndex !== undefined) {
      // 只有退出
      const node = sortedNodes[exitIndex];
      const expectedLevel = getNodeValue(node, "level", keyFields) as number;

      // 验证：应该退出的是栈顶的节点
      if (stack.length === 0) {
        // 栈为空但需要退出，说明树被破坏
        callback({
          index: exitIndex,
          node,
          isEnter: false,
          error: `栈为空但需要退出节点 ${getNodeValue(node, "id", keyFields)}`,
        });
        return maxCompleteIndex;
      }

      const topIndex = stack[stack.length - 1];
      const topNode = sortedNodes[topIndex];
      const topLevel = getNodeValue(topNode, "level", keyFields) as number;

      // 检查 level 是否正确（退出节点的 level 应该 >= 栈顶节点的 level）
      if (expectedLevel < topLevel) {
        callback({
          index: exitIndex,
          node,
          isEnter: false,
          error: `退出节点的 level(${expectedLevel}) 小于栈顶节点的 level(${topLevel})`,
        });
        return maxCompleteIndex;
      }

      // 退出节点
      callback({ index: exitIndex, node, isEnter: false });
      maxCompleteIndex = Math.max(maxCompleteIndex, exitIndex);

      // 从栈中移除该节点
      const stackIndex = stack.indexOf(exitIndex);
      if (stackIndex !== -1) {
        stack.splice(stackIndex, 1);
      }

      counter++;
    } else {
      // 既没有进入也没有退出，说明缺失了某个值
      callback({
        index: maxCompleteIndex + 1 < sortedNodes.length ? maxCompleteIndex + 1 : maxCompleteIndex,
        node: sortedNodes[Math.min(maxCompleteIndex + 1, sortedNodes.length - 1)],
        isEnter: true,
        error: `缺失值 ${counter}，没有对应的 leftValue 或 rightValue`,
      });
      return maxCompleteIndex;
    }
  }

  // 检查栈是否为空（所有节点都退出了）
  if (stack.length > 0) {
    const remainingNode = sortedNodes[stack[0]];
    callback({
      index: stack[0],
      node: remainingNode,
      isEnter: false,
      error: `节点 ${getNodeValue(remainingNode, "id", keyFields)} 未退出`,
    });
    return maxCompleteIndex;
  }

  return -1; // 树完整
}

/**
 * isCompleteTree - 判断从指定位置开始是否是完整的子树
 *
 * 从 startIndex 开始的节点作为子树的根，检查其 rightValue 范围内的所有节点是否构成完整的树。
 *
 * @param nodes - 节点数组
 * @param startIndex - 开始位置
 * @param options - 判断选项
 * @returns 如果是完整子树，返回包含的节点索引数组（在原数组中的索引）；否则返回空数组
 */
export function isCompleteTree<KeyFields extends CustomTreeKeyFields>(
  nodes: Record<string, any>[],
  startIndex: number,
  options: RepairTreeOptions<KeyFields> = {},
): number[] {
  if (startIndex < 0 || startIndex >= nodes.length) {
    return [];
  }

  const keyFields = getFieldNames(options);
  const startNode = nodes[startIndex];
  const startLeftValue = getNodeValue(startNode, "leftValue", keyFields) as number;
  const startRightValue = getNodeValue(startNode, "rightValue", keyFields) as number;

  // 提取所有在 startNode 范围内的节点（不包括 startNode 本身）
  const candidateNodes: Array<{ node: Record<string, any>; originalIndex: number }> = [];

  for (let i = 0; i < nodes.length; i++) {
    if (i === startIndex) continue; // 跳过 startNode 本身

    const node = nodes[i];
    const leftValue = getNodeValue(node, "leftValue", keyFields) as number;
    const rightValue = getNodeValue(node, "rightValue", keyFields) as number;

    // 只包含在 startNode 的 rightValue 范围内的节点（严格内部）
    if (leftValue > startLeftValue && rightValue < startRightValue) {
      candidateNodes.push({ node, originalIndex: i });
    }
  }

  // 将 startNode 本身加入（作为根）
  candidateNodes.unshift({ node: startNode, originalIndex: startIndex });

  if (candidateNodes.length === 0) {
    return [];
  }

  // 尝试遍历这个子树
  const nodesToCheck = candidateNodes.map((item) => item.node);
  let hasError = false;
  const result = forEachTree(nodesToCheck, ({ error }) => {
    if (error) {
      hasError = true;
    }
  }, options);

  // 如果 forEachTree 返回 -1 且没有错误，说明是完整的子树
  if (result === -1 && !hasError) {
    // 返回原始数组中的索引（去重并排序）
    return [...new Set(candidateNodes.map((item) => item.originalIndex))].sort((a, b) => a - b);
  }

  return [];
}
