/**
 * 树结构可视化工具函数
 * 用于生成树结构的直观文本表示，便于调试和测试断言
 */

export interface TreeNode {
  title: string;
  name?: string;
  pk?: number;
  id?: number;
  lft?: number;
  rgt?: number;
  level?: number;
  tree?: number;
  children?: TreeNode[];
}

export interface ToTreeOptions {
  /** 是否显示节点的左右值 */
  showValues?: boolean;
  /** 是否显示节点层级 */
  showLevel?: boolean;
  /** 自定义节点显示格式 */
  formatNode?: (node: TreeNode) => string;
  /** 最大递归深度，防止无限循环 */
  maxDepth?: number;
}

/**
 * 将树节点数组转换为可视化的树结构字符串
 *
 * @param nodes 树节点数组
 * @param options 配置选项
 * @returns 树结构的字符串表示
 *
 * @example
 * ```typescript
 * const tree = toTree(nodes, { showValues: true });
 * console.log(tree);
 * // 输出:
 * // Root (lft:1, rgt:20)
 * // |--A (lft:2, rgt:11)
 * // |  |--A-1 (lft:3, rgt:4)
 * // |  |--A-2 (lft:5, rgt:6)
 * // |--B (lft:12, rgt:19)
 * ```
 */
export function toTree(nodes: TreeNode[], options: ToTreeOptions = {}): string {
  const {
    showValues = false,
    showLevel = false,
    formatNode,
    maxDepth = 100
  } = options;

  if (!nodes || nodes.length === 0) {
    return '(empty tree)';
  }

  // 找到根节点（假设根节点是 level 0 或没有 parent）
  const root = nodes.find(n => n.level === 0 || (!n.tree && !n.parentId));

  if (!root) {
    // 如果没有明确的根节点，取第一个节点作为根
    const sortedNodes = [...nodes].sort((a, b) => (a.lft || 0) - (b.lft || 0));
    const rootCandidate = sortedNodes[0];
    if (rootCandidate) {
      return buildTreeFromRoot(rootCandidate, nodes, { showValues, showLevel, formatNode, maxDepth, currentDepth: 0 });
    }
    return '(no root node found)';
  }

  return buildTreeFromRoot(root, nodes, { showValues, showLevel, formatNode, maxDepth, currentDepth: 0 });
}

interface BuildTreeOptions extends ToTreeOptions {
  currentDepth?: number;
}

function buildTreeFromRoot(
  root: TreeNode,
  allNodes: TreeNode[],
  options: BuildTreeOptions
): string {
  const { showValues, showLevel, formatNode, maxDepth, currentDepth = 0 } = options;

  if (currentDepth >= (maxDepth || 100)) {
    return '... (max depth reached)';
  }

  // 递归构建子树
  function buildNode(node: TreeNode, prefix: string, isLast: boolean): string[] {
    const lines: string[] = [];

    // 格式化当前节点
    let nodeLabel: string;
    if (formatNode) {
      nodeLabel = formatNode(node);
    } else {
      const name = node.title || node.name || `Node-${node.pk || node.id}`;
      nodeLabel = name;
    }

    // 添加节点信息
    let info = '';
    if (showValues && node.lft !== undefined) {
      info += ` (lft:${node.lft}, rgt:${node.rgt})`;
    }
    if (showLevel && node.level !== undefined) {
      info += ` (level:${node.level})`;
    }

    // 当前节点行
    lines.push(`${prefix}${isLast ? '└--' : '|--'}${nodeLabel}${info}`);

    // 找到子节点
    const children = findChildren(node, allNodes);

    if (children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '|   ');

      children.forEach((child, index) => {
        const isLastChild = index === children.length - 1;
        const childLines = buildNode(child, childPrefix, isLastChild);
        lines.push(...childLines);
      });
    }

    return lines;
  }

  const rootLines = buildNode(root, '', true);
  return rootLines.join('\n');
}

/**
 * 查找节点的直接子节点
 */
function findChildren(node: TreeNode, allNodes: TreeNode[]): TreeNode[] {
  if (node.children && node.children.length > 0) {
    return node.children;
  }

  // 基于左右值算法查找子节点
  if (node.lft !== undefined && node.rgt !== undefined) {
    return allNodes
      .filter(n =>
        n.lft! > node.lft! &&
        n.rgt! < node.rgt! &&
        n.level === (node.level || 0) + 1
      )
      .sort((a, b) => (a.lft || 0) - (b.lft || 0));
  }

  // 如果树结构中包含 parent 引用
  // 这里可以根据实际情况实现
  return [];
}

/**
 * 从节点数组构建树结构（添加 children 引用）
 */
export function buildTreeStructure(nodes: TreeNode[]): TreeNode[] {
  const nodeMap = new Map<string | number, TreeNode>();

  // 第一遍历：创建所有节点的映射
  nodes.forEach(node => {
    const key = node.pk || node.id || node.title;
    nodeMap.set(key, { ...node, children: [] });
  });

  // 如果有 parent 引用信息，构建树结构
  const roots: TreeNode[] = [];

  // 基于左右值算法构建树
  if (nodes.length > 0 && nodes[0].lft !== undefined) {
    const sortedNodes = [...nodes].sort((a, b) => (a.lft || 0) - (b.lft || 0));
    roots.push(...buildTreeFromNodes(sortedNodes));
  }

  return roots;
}

/**
 * 从排序的节点数组构建树结构
 */
function buildTreeFromNodes(sortedNodes: TreeNode[]): TreeNode[] {
  if (sortedNodes.length === 0) return [];

  const roots: TreeNode[] = [];
  const stack: Array<{ node: TreeNode; depth: number }> = [];

  sortedNodes.forEach(node => {
    const currentNode = { ...node, children: [] };

    // 弹出栈中深度大于等于当前节点深度的节点
    while (stack.length > 0 && stack[stack.length - 1].depth >= (node.level || 0)) {
      stack.pop();
    }

    // 如果栈为空，这是根节点
    if (stack.length === 0) {
      roots.push(currentNode);
    } else {
      // 否则，添加到父节点的子节点列表
      const parent = stack[stack.length - 1].node;
      parent.children.push(currentNode);
    }

    stack.push({ node: currentNode, depth: node.level || 0 });
  });

  return roots;
}

/**
 * 简化版本的树结构生成，用于测试断言
 */
export function toSimpleTree(nodes: TreeNode[]): string {
  return toTree(nodes, {
    showValues: false,
    showLevel: false
  });
}

/**
 * 详细版本的树结构生成，包含所有调试信息
 */
export function toDetailedTree(nodes: TreeNode[]): string {
  return toTree(nodes, {
    showValues: true,
    showLevel: true
  });
}

/**
 * 自定义格式的树结构生成
 */
export function toCustomTree(
  nodes: TreeNode[],
  formatNode: (node: TreeNode) => string
): string {
  return toTree(nodes, { formatNode });
}
