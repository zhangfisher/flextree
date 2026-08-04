/**
 * ForEachMixin - 树遍历功能
 *
 * 提供 DFS 和 BFS 两种遍历模式，支持中断和层级限制
 */
import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexTreeError } from "../errors";

export interface ForEachOptions {
  /**
   * 遍历模式
   * @default "dfs"
   */
  mode?: "dfs" | "bfs";

  /**
   * 起始节点
   * 可以是节点ID或节点对象，默认为根节点
   */
  startFrom?: number | string | IFlexTreeNodeFields<any, any>;

  /**
   * 最大遍历层级
   * @default Infinity - 无限制
   */
  maxLevel?: number;

  /**
   * 是否包含起始节点
   * @default true
   */
  includeStartNode?: boolean;
}

export class ForEachMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 遍历树节点
   *
   * @param callback - 遍历回调函数，接收节点和子节点数组，返回 false 表示中断遍历
   * @param options - 遍历选项
   *
   * @example
   * ```typescript
   * // DFS 遍历
   * await manager.forEach((node, children) => {
   *   console.log(`节点 ${node.name} 有 ${children.length} 个子节点`);
   *   return true;
   * }, { mode: "dfs" });
   *
   * // BFS 遍历
   * await manager.forEach((node, children) => {
   *   console.log(node.name);
   *   return true;
   * }, { mode: "bfs" });
   *
   * // 中断遍历
   * let foundNode = null;
   * await manager.forEach((node, children) => {
   *   if (node.name === "target") {
   *     foundNode = node;
   *     return false; // 找到后中断
   *   }
   *   return true;
   * });
   *
   * // 限制层级
   * await manager.forEach((node, children) => {
   *   console.log(`层级 ${node.level}: ${node.name}`);
   *   return true;
   * }, { maxLevel: 2 });
   *
   * // 从指定节点开始
   * const nodeA = await manager.getNode("A");
   * await manager.forEach((node, children) => {
   *   console.log(node.name);
   *   return true;
   * }, { startFrom: nodeA });
   * ```
   */
  async forEach(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    callback: (node: TreeNode, children: TreeNode[]) => boolean,
    options: ForEachOptions = {},
  ): Promise<void> {
    const { mode = "dfs", startFrom, maxLevel = Infinity, includeStartNode = true } = options;

    // 确定起始节点
    let startNode: TreeNode;
    if (startFrom) {
      if (typeof startFrom === "object" && startFrom !== null) {
        startNode = startFrom as TreeNode;
      } else {
        const node = await this.getNode(startFrom as NodeId);
        if (!node) {
          throw new FlexTreeError(`指定的起始节点不存在: ${startFrom}`);
        }
        startNode = node;
      }
    } else {
      const root = await this.getRoot();
      if (!root) {
        throw new FlexTreeError("树中没有根节点，无法开始遍历");
      }
      startNode = root;
    }

    if (mode === "dfs") {
      await this._forEachDFS(callback, startNode, true, startNode[this.keyFields.level] as number, {
        maxLevel,
        includeStartNode,
      });
    } else {
      await this._forEachBFS(callback, startNode, { maxLevel, includeStartNode });
    }
  }

  /**
   * 深度优先遍历 (DFS) - 递归实现
   */
  private async _forEachDFS(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    callback: (node: TreeNode, children: TreeNode[]) => boolean,
    currentNode: TreeNode,
    isStartNode: boolean,
    currentLevel: number,
    options: { maxLevel: number; includeStartNode: boolean },
  ): Promise<boolean> {
    const { maxLevel, includeStartNode } = options;

    // 检查层级限制
    if (currentLevel > maxLevel) {
      return true; // 超过最大层级，停止深入
    }

    // 决定是否处理当前节点
    const shouldIncludeNode = !isStartNode || includeStartNode;

    if (shouldIncludeNode) {
      // 获取子节点
      const children = (await this.getChildren(currentNode)) as TreeNode[];

      // 调用 callback
      const shouldContinue = callback(currentNode, children);
      if (!shouldContinue) {
        return false; // 中断遍历
      }

      // 递归遍历子节点
      for (const child of children) {
        const childLevel = child[this.keyFields.level] as number;
        const shouldContinue = await this._forEachDFS(
          callback,
          child as TreeNode,
          false,
          childLevel,
          options,
        );
        if (!shouldContinue) {
          return false; // 中断遍历
        }
      }
    } else {
      // 如果不包含起始节点，直接遍历子节点
      const children = (await this.getChildren(currentNode)) as TreeNode[];
      for (const child of children) {
        const childLevel = child[this.keyFields.level] as number;
        const shouldContinue = await this._forEachDFS(
          callback,
          child as TreeNode,
          false,
          childLevel,
          options,
        );
        if (!shouldContinue) {
          return false; // 中断遍历
        }
      }
    }

    return true; // 继续遍历
  }

  /**
   * 广度优先遍历 (BFS) - 迭代实现
   */
  private async _forEachBFS(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    callback: (node: TreeNode, children: TreeNode[]) => boolean,
    startNode: TreeNode,
    options: { maxLevel: number; includeStartNode: boolean },
  ): Promise<void> {
    const { maxLevel, includeStartNode } = options;

    type QueueItem = { node: TreeNode; level: number };
    const queue: QueueItem[] = [];

    // 决定是否将起始节点加入队列
    if (includeStartNode) {
      queue.push({ node: startNode, level: startNode[this.keyFields.level] as number });
    } else {
      // 如果不包含起始节点，将其子节点加入队列
      const children = (await this.getChildren(startNode)) as TreeNode[];
      for (const child of children) {
        queue.push({ node: child as TreeNode, level: child[this.keyFields.level] as number });
      }
    }

    // 广度优先遍历
    while (queue.length > 0) {
      const { node, level } = queue.shift()!;

      // 检查层级限制
      if (level > maxLevel) {
        continue; // 超过最大层级，跳过
      }

      // 获取子节点
      const children = (await this.getChildren(node)) as TreeNode[];

      // 调用 callback
      const shouldContinue = await callback(node, children);
      if (!shouldContinue) {
        return; // 中断遍历
      }

      // 将子节点加入队列
      for (const child of children) {
        const childLevel = child[this.keyFields.level] as number;
        queue.push({ node: child as TreeNode, level: childLevel });
      }
    }
  }
}
