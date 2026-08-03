/**
 * 树结构可视化工具函数
 * 用于生成树结构的直观文本表示，便于调试和测试断言
 */

import type { IFlexTreeNodeFields, DefaultTreeKeyFields } from "../../src";
import { TestFields } from "./tree-manager";

export interface TreeNode {
  title?: string;
  name?: string;
  pk?: number;
  id?: number;
  lft?: number;
  rgt?: number;
  leftValue?: number;
  rightValue?: number;
  level?: number;
  tree?: number;
  treeId?: number;
  children?: TreeNode[];
  status?: number;
  [key: string]: any;
}

export interface ToTreeOptions {
  /** 是否显示节点的左右值 */
  showValues?: boolean;
  /** 是否显示节点层级 */
  showLevel?: boolean;
  /** 是否显示节点ID */
  showId?: boolean;
  /** 是否显示状态字段 */
  showStatus?: boolean;
  /** 自定义节点显示格式 */
  formatNode?: (node: TreeNode) => string;
  /** 最大递归深度，防止无限循环 */
  maxDepth?: number;
  /** 自定义显示的字段列表 */
  customFields?: string[];
}

/**
 * 将树节点数组转换为可视化的树结构字符串（扁平数组版本）
 *
 * @param nodes - 扁平节点数组（必须按leftValue排序）
 * @param options - 配置选项
 * @returns 树结构的字符串表示
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

/**
 * 将树节点数组转换为可视化的树结构字符串（嵌套版本）
 *
 * @param nodes 树节点数组
 * @param options 配置选项
 * @returns 树结构的字符串表示
 *
 * @example
 * ```typescript
 * const tree = toNestedTree(nodes, { showValues: true });
 * console.log(tree);
 * // 输出:
 * // Root (lft:1, rgt:20)
 * // |--A (lft:2, rgt:11)
 * // |  |--A-1 (lft:3, rgt:4)
 * // |  |--A-2 (lft:5, rgt:6)
 * // |--B (lft:12, rgt:19)
 * ```
 */
export function toNestedTree(nodes: TreeNode[], options: ToTreeOptions = {}): string {
  const {
    showValues = false,
    showLevel = false,
    showId = true,
    showStatus = false,
    customFields = [],
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
    const sortedNodes = [...nodes].sort((a, b) => (a.lft || a.leftValue || 0) - (b.lft || b.leftValue || 0));
    const rootCandidate = sortedNodes[0];
    if (rootCandidate) {
      return buildTreeFromRoot(rootCandidate, nodes, {
        showValues,
        showLevel,
        showId,
        showStatus,
        customFields,
        formatNode,
        maxDepth,
        currentDepth: 0
      });
    }
    return '(no root node found)';
  }

  return buildTreeFromRoot(root, nodes, {
    showValues,
    showLevel,
    showId,
    showStatus,
    customFields,
    formatNode,
    maxDepth,
    currentDepth: 0
  });
}

interface BuildTreeOptions extends ToTreeOptions {
  currentDepth?: number;
}

function buildTreeFromRoot(
  root: TreeNode,
  allNodes: TreeNode[],
  options: BuildTreeOptions
): string {
  const { showValues, showLevel, showId, showStatus, customFields, formatNode, maxDepth, currentDepth = 0 } = options;

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

      // 添加节点信息
      let info = '';
      if (showId && node.id !== undefined) {
        info += ` id=${node.id}`;
      }
      if (showStatus && node.status !== undefined) {
        info += ` status=${node.status}`;
      }
      // 自定义字段
      for (const field of customFields) {
        if (node[field] !== undefined) {
          info += ` ${field}=${node[field]}`;
        }
      }
      if (info) {
        nodeLabel += ` (${info.trim()})`;
      }
    }

    // 添加左右值信息
    let valueInfo = '';
    if (showValues) {
      const lft = node.lft !== undefined ? node.lft : node.leftValue;
      const rgt = node.rgt !== undefined ? node.rgt : node.rightValue;
      if (lft !== undefined && rgt !== undefined) {
        valueInfo += ` (lft:${lft}, rgt:${rgt})`;
      }
    }

    if (showLevel && node.level !== undefined) {
      valueInfo += ` (level:${node.level})`;
    }

    // 当前节点行
    lines.push(`${prefix}${isLast ? '└--' : '|--'}${nodeLabel}${valueInfo}`);

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
  const nodeLeft = node.lft !== undefined ? node.lft : node.leftValue;
  const nodeRight = node.rgt !== undefined ? node.rgt : node.rightValue;

  if (nodeLeft !== undefined && nodeRight !== undefined) {
    return allNodes
      .filter(n => {
        const nLeft = n.lft !== undefined ? n.lft : n.leftValue;
        const nRight = n.rgt !== undefined ? n.rgt : n.rightValue;
        return nLeft! > nodeLeft && nRight! < nodeRight && n.level === (node.level || 0) + 1;
      })
      .sort((a, b) => {
        const aLeft = a.lft !== undefined ? a.lft : a.leftValue;
        const bLeft = b.lft !== undefined ? b.lft : b.leftValue;
        return (aLeft || 0) - (bLeft || 0);
      });
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
  if (nodes.length > 0 && (nodes[0].lft !== undefined || nodes[0].leftValue !== undefined)) {
    const sortedNodes = [...nodes].sort((a, b) => {
      const aLeft = a.lft !== undefined ? a.lft : a.leftValue || 0;
      const bLeft = b.lft !== undefined ? b.lft : b.leftValue || 0;
      return aLeft - bLeft;
    });
    roots.push(...buildTreeFromSortedNodes(sortedNodes));
  }

  return roots;
}

/**
 * 从排序的节点数组构建树结构
 */
function buildTreeFromSortedNodes(sortedNodes: TreeNode[]): TreeNode[] {
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
  return toNestedTree(nodes, {
    showValues: false,
    showLevel: false,
    showId: false,
    showStatus: false
  });
}

/**
 * 详细版本的树结构生成，包含所有调试信息
 */
export function toDetailedTree(nodes: TreeNode[]): string {
  return toNestedTree(nodes, {
    showValues: true,
    showLevel: true,
    showId: true
  });
}

/**
 * 自定义格式的树结构生成
 */
export function toCustomTree(
  nodes: TreeNode[],
  formatNode: (node: TreeNode) => string
): string {
  return toNestedTree(nodes, { formatNode });
}
