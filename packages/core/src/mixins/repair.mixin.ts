/**
 * RepairMixin - 树修复功能
 *
 * 聚焦树结构修复（repairTree），用于处理被破坏的 Nested Set Model 树结构。
 *
 * 节点遍历（forEachTree）与完整性检测（isCompleteTree）是独立通用工具，已提取至
 * ../utils/forEachNodes；此处通过 re-export 保持向后兼容，repairTree 内部复用它们做修复后验证。
 */
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  DefaultTreeKeyNameFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import {
  forEachTree,
  isCompleteTree,
  getFieldNames,
  getNodeValue,
  type RepairTreeOptions,
  type ForEachTreeCallback,
} from "../utils/forEachNodes";

// 向后兼容：以下符号已迁移至 utils/forEachNodes，此处继续导出以保持原有引用路径可用
export { forEachTree, isCompleteTree };
export type { RepairTreeOptions, ForEachTreeCallback };

/**
 * repairTree - 修复被破坏的树结构（基于 level 重建版）
 *
 * 修复算法：
 * 1. 按 leftValue 排序保持遍历顺序
 * 2. 基于 level 信息重建树结构（深度优先遍历）
 * 3. 重新分配连续的 leftValue/rightValue（确保 1..2N 完整）
 *
 * 纯函数：不会修改入参 nodes，返回修复并按 leftValue 排序后的新节点数组。
 *
 * @param nodes - 节点数组（不会被修改）
 * @param options - 修复选项
 * @returns 修复并按 leftValue 排序后的新节点数组
 */
export function repairTree<KeyFields extends CustomTreeKeyFields>(
  nodes: Record<string, any>[],
  options: RepairTreeOptions<KeyFields> = {},
): Record<string, any>[] {
  const keyFields = getFieldNames(options);

  if (nodes.length === 0) {
    return [];
  }

  // 创建 id 到原始节点的映射，用于对比修复前后的值并记录元数据
  const idToOriginalMap = new Map<number, Record<string, any>>();
  nodes.forEach((node) => {
    const id = getNodeValue(node, "id", keyFields) as number;
    idToOriginalMap.set(id, node);
  });

  // 基于 level 信息重建树结构（内部按 leftValue 排序，分配连续的 leftValue/rightValue）
  // rebuiltTree 中的节点为新对象，不会修改入参 nodes
  const rebuiltTree = rebuildTreeByLevel(nodes, keyFields);

  // 对比原始值，将变化记录为元数据（下划线前缀标记为修复过程的临时数据）
  for (const newNode of rebuiltTree) {
    const id = getNodeValue(newNode, "id", keyFields) as number;
    const original = idToOriginalMap.get(id);
    if (!original) continue;

    const oldLevel = getNodeValue(original, "level", keyFields);
    const oldLeftValue = getNodeValue(original, "leftValue", keyFields);
    const oldRightValue = getNodeValue(original, "rightValue", keyFields);

    const newLevel = newNode[keyFields.level];
    const newLeftValue = newNode[keyFields.leftValue];
    const newRightValue = newNode[keyFields.rightValue];

    if (oldLevel !== newLevel) {
      newNode._level = oldLevel;
    }
    if (oldLeftValue !== newLeftValue) {
      newNode._leftValue = oldLeftValue;
    }
    if (oldRightValue !== newRightValue) {
      newNode._rightValue = oldRightValue;
    }
  }

  // 修复后验证：调用 isCompleteTree 检查根子树是否包含全部节点（整树完整的充分条件）；
  // 多根场景下根子树不含全部节点，回退到 forEachTree 整树遍历确认连续性。
  // 验证失败说明修复算法存在缺陷，快速失败而非返回错误数据
  if (isCompleteTree(rebuiltTree, 0, options).length !== rebuiltTree.length) {
    const brokenAt = forEachTree(
      rebuiltTree,
      ({ error }) => {
        if (error) {
          throw new Error(`repairTree: 修复后验证失败（${error}）`);
        }
      },
      options,
    );
    if (brokenAt !== -1) {
      throw new Error(`repairTree: 修复后验证失败，结果在索引 ${brokenAt} 处不完整`);
    }
  }

  // 多树表：将 treeId 注入修复后的节点（treeId 为空代表单树表，不处理 treeId 字段）
  if (options.treeId !== undefined && options.treeId !== null) {
    const treeIdField = keyFields.treeId;
    for (const node of rebuiltTree) {
      node[treeIdField] = options.treeId;
    }
  }

  return rebuiltTree;
}

/**
 * 基于 level 信息重建树结构（数学完整版）
 *
 * 核心算法（基于 level 和 leftValue 的相对顺序）：
 * 1. 按 leftValue 排序
 * 2. 使用栈跟踪当前路径，基于 level 判断父子关系：
 *    - level 增加：当前节点是栈顶的子节点
 *    - level 相同：当前节点是栈顶的兄弟（关闭栈顶）
 *    - level 减少：回溯到合适的祖先（关闭多个栈顶）
 * 3. 重新分配连续的 leftValue/rightValue（确保 1..2N 完整）
 *
 * level 会被"规范化"：根节点 level=0，每层递增1，无跳级
 */
function rebuildTreeByLevel(
  nodes: Record<string, any>[],
  keyFields: DefaultTreeKeyNameFields,
): Record<string, any>[] {
  if (nodes.length === 0) return [];

  // 按 leftValue 排序
  const sorted = [...nodes].sort((a, b) => {
    const leftA = getNodeValue(a, "leftValue", keyFields) as number;
    const leftB = getNodeValue(b, "leftValue", keyFields) as number;
    return leftA - leftB;
  });

  // 栈：存储节点索引
  const stack: number[] = [];
  const nodeData: Array<{
    original: Record<string, any>;
    newLeft: number;
    newLevel: number;
    newRight: number;
  }> = [];

  let counter = 1;

  for (let i = 0; i < sorted.length; i++) {
    const originalNode = sorted[i];
    const originalLevel = getNodeValue(originalNode, "level", keyFields) as number;

    if (i === 0) {
      // 第一个节点是根节点
      nodeData.push({
        original: originalNode,
        newLeft: counter++,
        newLevel: 0,
        newRight: 0,
      });
      stack.push(i);
    } else {
      // 基于 level 判断父子关系
      // 找到合适的父节点：栈中 level < originalLevel 的最深节点
      // 或者：level <= originalLevel - 1 的节点

      // 关闭栈顶节点，直到找到合适的父节点
      while (stack.length > 0) {
        const topIdx = stack[stack.length - 1];
        const topLevel = getNodeValue(sorted[topIdx], "level", keyFields) as number;

        if (topLevel >= originalLevel) {
          // 栈顶的 level >= 当前 level，需要关闭栈顶
          nodeData[topIdx].newRight = counter++;
          stack.pop();
        } else {
          // 栈顶的 level < 当前 level，是潜在的父节点
          break;
        }
      }

      // 确定新 level（规范化）：基于实际嵌套深度
      // 子节点 level = 父节点 level + 1，从而修复 level 跳级（如 0→3→7 规范化为 0→1→2）
      let newLevel: number;
      if (stack.length > 0) {
        const parentIdx = stack[stack.length - 1];
        newLevel = nodeData[parentIdx].newLevel + 1;
      } else {
        // 栈为空，说明当前节点的 level <= 所有已关闭的节点
        // 作为根节点的子节点或兄弟
        newLevel = originalLevel <= 0 ? 0 : 1;
        if (originalLevel === 0) {
          // 极端情况：多个根节点
          newLevel = 0;
        }
      }

      nodeData.push({
        original: originalNode,
        newLeft: counter++,
        newLevel,
        newRight: 0,
      });
      stack.push(i);
    }
  }

  // 关闭栈中剩余的所有节点
  while (stack.length > 0) {
    const topIdx = stack.pop()!;
    nodeData[topIdx].newRight = counter++;
  }

  // 构建结果
  return nodeData.map((data) => ({
    ...data.original,
    [keyFields.leftValue]: data.newLeft,
    [keyFields.rightValue]: data.newRight,
    [keyFields.level]: data.newLevel,
  }));
}

export class RepairMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 修复当前树的破坏结构（数据库修复流程）
   *
   * 由于树可能已被破坏，无法依赖正常的 getNodes 读取，因此直接用 SQL 读取节点后交给 repairTree 修复，
   * 再将发生变化的节点写回数据库。
   *
   * 流程：
   * 1. 直接用 SQL 读取所有节点的 id/level/leftValue/rightValue（按 leftValue 排序，仅取修复所需字段）
   * 2. 调用 repairTree 修复 leftValue/rightValue/level（通过展开原节点保留其他字段，适配单表多树）
   * 3. 过滤出值发生变化的节点（带 _level/_leftValue/_rightValue 元数据）
   * 4. 在事务中更新这些节点的 level/leftValue/rightValue
   *
   * treeId 处理：单表多树时，读取与更新均通过 {__TREE_ID__} 限定当前树，不会跨树影响；
   * repairTree 本身不感知 treeId，但通过展开原节点保留 treeId 等所有字段。
   */
  async repair(this: any): Promise<void> {
    // repair 是独立的修复操作（允许在 write 外调用），内部走 write 复用完整的写机制：
    // 事务（跨方法原子）+ _writeCtx（内部读放行）+ _txPromise（外部读隔离）+ _isWriting（写串行）。
    await this.write(async () => {
      // 预计算转义后的字段名
      const idField = this.escaper.escapeId(this.keyFields.id);
      const levelField = this.escaper.escapeId(this.keyFields.level);
      const leftField = this.escaper.escapeId(this.keyFields.leftValue);
      const rightField = this.escaper.escapeId(this.keyFields.rightValue);

      // 1. 直接用 SQL 获取所有节点（树可能被破坏，不能用 getNodes）
      const selectSql = this._sql(`
        SELECT ${idField}, ${levelField}, ${leftField}, ${rightField}
        FROM ${this.tableName}
        WHERE {__TREE_ID__} 1=1
        ORDER BY ${leftField}
      `);
      const nodes: Record<string, any>[] = await this.getRows(selectSql);

      if (nodes.length === 0) {
        return;
      }

      // 2. 修复树结构（传入 treeId：单树表为空，多树表 repairTree 会将其注入结果节点）
      const repairedNodes = repairTree(nodes, {
        keyFields: this.keyFields,
        tableName: this.tableName,
        treeId: this.treeId,
      });

      // 3. 过滤出值发生变化的节点（repairTree 在值变化时写入 _level/_leftValue/_rightValue 元数据）
      const changedNodes = repairedNodes.filter(
        (node: Record<string, any>) =>
          "_level" in node || "_leftValue" in node || "_rightValue" in node,
      );

      if (changedNodes.length === 0) {
        return;
      }

      // 4. 更新变化节点的 level/leftValue/rightValue（复用本方法的事务）
      const updateSqls = changedNodes.map((node: Record<string, any>) =>
        this._sql(`
          UPDATE ${this.tableName}
          SET ${levelField} = ${this.escaper.escape(node[this.keyFields.level])},
              ${leftField} = ${this.escaper.escape(node[this.keyFields.leftValue])},
              ${rightField} = ${this.escaper.escape(node[this.keyFields.rightValue])}
          WHERE {__TREE_ID__} ${idField} = ${this.escaper.escape(node[this.keyFields.id])}
        `),
      );

      await this.onExecuteSql(updateSqls);
    });
  }
}
