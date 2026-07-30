/**
 * 将getNodes返回的扁平节点数组转换为树形字符串表示
 * @param nodes - 节点数组（必须按leftValue排序）
 * @param options - 配置选项
 * @returns 树形字符串
 */
export function toTree(
  nodes: Array<{ name: string; level: number; id?: number; status?: number; [key: string]: any }>,
  options: {
    showId?: boolean;
    showStatus?: boolean;
    customFields?: string[];
  } = {}
): string {
  const { showId = true, showStatus = true, customFields = [] } = options;

  if (nodes.length === 0) {
    return "(empty tree)";
  }

  const buildNodeInfo = (node: any): string => {
    let info = node.name;
    const details: string[] = [];

    if (showId && node.id !== undefined) {
      details.push(`id=${node.id}`);
    }

    if (showStatus && node.status !== undefined) {
      details.push(`status=${node.status}`);
    }

    // 自定义字段
    for (const field of customFields) {
      if (node[field] !== undefined) {
        details.push(`${field}=${node[field]}`);
      }
    }

    if (details.length > 0) {
      info += ` (${details.join(", ")})`;
    }

    return info;
  };

  // 辅助函数：判断节点是否是同级最后一个
  const isLastChild = (index: number): boolean => {
    const currentLevel = nodes[index].level;
    for (let i = index + 1; i < nodes.length; i++) {
      if (nodes[i].level === currentLevel) {
        return false; // 找到同级节点，不是最后一个
      }
      if (nodes[i].level < currentLevel) {
        break; // 遇到更低层级的节点，后面不会再有同级节点
      }
    }
    return true; // 没有找到同级节点，是最后一个
  };

  // 辅助函数：找到父节点索引
  const findParentIndex = (index: number): number => {
    const currentLevel = nodes[index].level;
    for (let i = index - 1; i >= 0; i--) {
      if (nodes[i].level === currentLevel - 1) {
        return i; // 找到父节点
      }
    }
    return -1; // 没有找到父节点
  };

  const lines: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const level = node.level;

    if (level === 0) {
      // 根节点
      lines.push(buildNodeInfo(node));
      continue;
    }

    // 构建前缀
    let prefix = "";
    let currentLevelIndex = i;

    // 从当前节点逐层向上，构建每层的前缀
    for (let currentLevel = level; currentLevel > 0; currentLevel--) {
      if (currentLevel < level) {
        // 不是第一层，添加层级前缀
        const parentIndex = findParentIndex(currentLevelIndex);
        if (parentIndex >= 0) {
          if (isLastChild(parentIndex)) {
            prefix = "    " + prefix;
          } else {
            prefix = "│   " + prefix;
          }
          currentLevelIndex = parentIndex;
        }
      } else {
        // 第一层，添加连接符
        if (isLastChild(i)) {
          prefix = "└── " + prefix;
        } else {
          prefix = "├── " + prefix;
        }
      }
    }

    lines.push(prefix + buildNodeInfo(node));
  }

  return lines.join("\n");
}
