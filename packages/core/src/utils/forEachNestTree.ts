/**
 * 深度优先遍历嵌套树结构
 *
 * 按照 Nested Set Model 的左右值原理遍历，每个节点调用两次 callback：
 * - 第一次：进入节点时（相当于设置左值）
 * - 第二次：退出节点时（相当于设置右值）
 *
 * @param tree - 嵌套树结构，节点包含 children 数组
 * @param callback - 回调函数，每个节点会被调用两次，参数为 (node, level)
 * @param options - 配置项
 */
export interface NestTreeNode {
  children?: NestTreeNode[]
  [key: string]: any
}

export interface ForEachNestTreeOptions {
  /**
   * 自定义 children 字段名
   * @default 'children'
   */
  childrenKey?: string
}

export type ForEachNestTreeCallback<T extends NestTreeNode> = (
  node: T,
  level: number
) => void

/**
 * 深度优先遍历嵌套树
 *
 * @param tree - 要遍历的树节点
 * @param callback - 回调函数，接收节点和层级（根节点 level=1）
 * @param options - 配置选项
 *
 * @example
 * ```ts
 * forEachNestTree({
 *   id: 1,
 *   name: "root",
 *   children: [
 *     { id: 2, name: "a" },
 *     { id: 3, name: "b" }
 *   ]
 * }, (node, level) => {
 *   console.log(level, node.id)
 * })
 *
 * // 输出：
 * // 1 1 (root enter)
 * // 2 2 (a enter)
 * // 2 2 (a exit)
 * // 2 3 (b enter)
 * // 2 3 (b exit)
 * // 1 1 (root exit)
 * ```
 */
export function forEachNestTree<T extends NestTreeNode>(
  tree: T | T[],
  callback: ForEachNestTreeCallback<T>,
  options: ForEachNestTreeOptions = {}
): void {
  const { childrenKey = 'children' } = options

  function traverse(node: T, level: number): void {
    // 第一次调用（进入节点 - 相当于设置左值）
    callback(node, level)

    // 获取子节点
    const children = (node[childrenKey] as T[]) || []

    // 递归遍历所有子节点
    for (const child of children) {
      traverse(child, level + 1)
    }

    // 第二次调用（退出节点 - 相当于设置右值）
    callback(node, level)
  }

  // 处理单个节点或节点数组
  if (Array.isArray(tree)) {
    for (const node of tree) {
      traverse(node, 1) // 根节点层级为1
    }
  } else {
    traverse(tree, 1) // 根节点层级为1
  }
}
