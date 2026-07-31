import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexNodeRelPosition, FlexTreeNodeRelation } from "../types";
import { FlexTreeError, FlexTreeNodeInvalidOperationError, FlexTreeNodeNotFoundError } from "../errors";

export class MoveNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   *
   * 返回node是否允许移动到atNode的指定的位置
   *
   *
   * 当满足以下条件时不允许移动
   *
   *  - 两个节点是一样的
   *  - toNode是node的后代
   *
   * @example
   *
   *   canMoveNode(node1,node2)       node1能否移动到node2的后面，即下一个兄弟节点
   *
   * @param node
   * @param toNode
   * @returns  {boolean} true 允许移动，false 不允许移动
   */
  async canMoveTo(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: NodeId | TreeNode,
    toNode?: NodeId | TreeNode,
  ) {
    const srcNode = (await this.getNodeData(node)) as unknown as TreeNode;
    const targetNode = (await this.getNodeData(toNode)) as unknown as TreeNode;

    let isAllow: boolean = true;
    //
    if (
      !this.isMultiTree ||
      (this.isMultiTree && targetNode[this.keyFields.treeId] === srcNode[this.keyFields.treeId])
    ) {
      if (targetNode[this.keyFields.id] === srcNode[this.keyFields.id]) {
        isAllow = false;
      } else {
        const r = await this.getNodeRelation(targetNode, node);
        if (r === FlexTreeNodeRelation.Descendants) {
          isAllow = false;
        }
      }
    }
    return isAllow;
  }

  /**
   * 移动到下一个节点
   */
  private _moveToNextSibling(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    toNode: TreeNode,
  ) {
    const movedLength =
      fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1;

    const leftValue = fromNode[this.keyFields.leftValue];
    const rightValue = fromNode[this.keyFields.rightValue];

    // 保存目标节点的原始位置
    const toNodeRightValue = toNode[this.keyFields.rightValue];

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    // 计算目标节点在deleteNode调整后的rightValue
    // 如果目标节点在源节点右边，它的rightValue会被减少movedLength
    const adjustedToNodeRightValue = toNodeRightValue > rightValue
      ? toNodeRightValue - movedLength
      : toNodeRightValue;

    const sqls: string[] = [
      // 第1步：为目标位置腾出空间（在调整后的目标节点之后）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength}
                WHERE {__TREE_ID__}
                    ${leftValueField} > ${adjustedToNodeRightValue}
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE {__TREE_ID__}
                    ${rightValueField} > ${adjustedToNodeRightValue}
            `),

      // 第2步：将已逻辑删除的节点移动到新位置并恢复为正数
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${adjustedToNodeRightValue + 1} + (-${leftValueField} - ${leftValue}),
                    ${levelField} = ${toNode[this.keyFields.level]} + ${levelField} - ${fromNode[this.keyFields.level]}
                WHERE {__TREE_ID__}
                    ${leftValueField} < 0
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${adjustedToNodeRightValue + 1} + (-${rightValueField} - ${leftValue})
                WHERE {__TREE_ID__}
                    ${rightValueField} < 0
            `),
    ];

    return sqls;
  }

  private _moveToPreviousSibling(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    toNode: TreeNode,
  ) {
    const movedLength =
      fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1;

    const leftValue = fromNode[this.keyFields.leftValue];
    const rightValue = fromNode[this.keyFields.rightValue];

    // 保存目标节点的原始位置
    const toNodeLeftValue = toNode[this.keyFields.leftValue];

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    // 计算目标节点在deleteNode调整后的leftValue
    // 如果目标节点在源节点右边，它的leftValue会被减少movedLength
    const adjustedToNodeLeftValue = toNodeLeftValue > rightValue
      ? toNodeLeftValue - movedLength
      : toNodeLeftValue;

    const sqls: string[] = [
      // 第1步：为目标位置腾出空间（在调整后的目标节点之前）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength}
                WHERE
                    {__TREE_ID__}
                    ${leftValueField} >= ${adjustedToNodeLeftValue}
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE
                    {__TREE_ID__}
                    ${rightValueField} >= ${adjustedToNodeLeftValue}
            `),

      // 第2步：将已逻辑删除的节点移动到新位置并恢复为正数
      // 源节点应该插入到adjustedToNodeLeftValue之前
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${adjustedToNodeLeftValue} + (-${leftValueField} - ${leftValue}),
                    ${levelField} = ${toNode[this.keyFields.level]} + ${levelField} - ${fromNode[this.keyFields.level]}
                WHERE
                    {__TREE_ID__} ${leftValueField} < 0
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${adjustedToNodeLeftValue} + (-${rightValueField} - ${leftValue})
                WHERE
                    {__TREE_ID__} ${rightValueField} < 0
            `),
    ];
    return sqls;
  }

  private _moveToLastChild(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    toNode: TreeNode,
  ) {
    const movedLength =
      fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1;

    const leftValue = fromNode[this.keyFields.leftValue];
    const rightValue = fromNode[this.keyFields.rightValue];

    // 保存目标节点的原始位置
    const toNodeRightValue = toNode[this.keyFields.rightValue];

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);
    const idField = this.escaper.escapeId(this.keyFields.id);

    // 计算目标节点在deleteNode调整后的rightValue
    // 如果目标节点在源节点右边，它的rightValue会被减少movedLength
    const adjustedToNodeRightValue = toNodeRightValue > rightValue
      ? toNodeRightValue - movedLength
      : toNodeRightValue;

    const sqls: string[] = [
      // 第1步：为目标位置腾出空间（在调整后的目标节点右值之前，作为最后一个子节点）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength}
                WHERE
                    {__TREE_ID__}
                    ${leftValueField} > ${adjustedToNodeRightValue}
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE
                    {__TREE_ID__}
                    ${rightValueField} > ${adjustedToNodeRightValue}
            `),

      // 第2步：将已逻辑删除的节点移动到新位置并恢复为正数
      // 源节点应该插入到adjustedToNodeRightValue之前（作为目标节点的最后一个子节点）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${adjustedToNodeRightValue} + (-${leftValueField} - ${leftValue}),
                    ${levelField} = ${toNode[this.keyFields.level]} + ${levelField} - ${fromNode[this.keyFields.level]} + 1
                WHERE
                    {__TREE_ID__} ${leftValueField} < 0
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${adjustedToNodeRightValue} + (-${rightValueField} - ${leftValue})
                WHERE
                    {__TREE_ID__} ${rightValueField} < 0
            `),

      // 第3步：更新目标节点本身的rightValue（因为它现在包含了新的子树）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE
                    {__TREE_ID__} ${idField} = ${toNode[this.keyFields.id]}
            `),
    ];
    return sqls;
  }

  private _moveToFirstChild(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    toNode: TreeNode,
  ) {
    const movedLength =
      fromNode[this.keyFields.rightValue] - fromNode[this.keyFields.leftValue] + 1;

    const leftValue = fromNode[this.keyFields.leftValue];
    const rightValue = fromNode[this.keyFields.rightValue];

    // 保存目标节点的原始位置
    const toNodeLeftValue = toNode[this.keyFields.leftValue];
    const toNodeRightValue = toNode[this.keyFields.rightValue];

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);
    const idField = this.escaper.escapeId(this.keyFields.id);

    // 计算目标节点在deleteNode调整后的位置
    // 如果目标节点在源节点右边，它的leftValue和rightValue会被减少movedLength
    const adjustedToNodeLeftValue = toNodeLeftValue > rightValue
      ? toNodeLeftValue - movedLength
      : toNodeLeftValue;
    const adjustedToNodeRightValue = toNodeRightValue > rightValue
      ? toNodeRightValue - movedLength
      : toNodeRightValue;

    const sqls: string[] = [
      // 第1步：为目标位置腾出空间（在调整后的目标节点左值之后，作为第一个子节点）
      // 更新所有leftValue大于目标节点leftValue的节点，包括目标节点的子节点和后续兄弟节点
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength}
                WHERE
                    {__TREE_ID__}
                    ${leftValueField} > ${adjustedToNodeLeftValue}
            `),

      // rightValue更新：只更新目标节点及其后续兄弟节点
      // 排除祖先节点：ancestors.leftValue < toNode.leftValue
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE
                    {__TREE_ID__}
                    ${rightValueField} > ${adjustedToNodeLeftValue} AND
                    ${leftValueField} >= ${adjustedToNodeLeftValue}
            `),

      // 第2步：将已逻辑删除的节点移动到新位置并恢复为正数
      // 源节点应该插入到adjustedToNodeLeftValue之后（作为目标节点的第一个子节点）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${adjustedToNodeLeftValue} + (-${leftValueField} - ${leftValue}) + 1,
                    ${levelField} = ${toNode[this.keyFields.level]} + ${levelField} - ${fromNode[this.keyFields.level]} + 1
                WHERE
                    {__TREE_ID__} ${leftValueField} < 0
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${adjustedToNodeLeftValue} + (-${rightValueField} - ${leftValue}) + 1
                WHERE
                    {__TREE_ID__} ${rightValueField} < 0
            `),

      // 第3步：更新目标节点的所有祖先节点的rightValue
      // 使用更精确的条件，只包含真正的祖先节点，避免更新后续兄弟节点
      // 祖先节点的特征是：leftValue < adjustedToNodeLeftValue 且 rightValue > adjustedToNodeRightValue
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE
                    {__TREE_ID__}
                    ${leftValueField} < ${adjustedToNodeLeftValue} AND
                    ${rightValueField} > ${adjustedToNodeRightValue}
            `),
    ];

    return sqls;
  }

  /**
   * 移动节点到指定位置
   *
   * 将源节点移动到目标节点的指定相对位置，支持四种移动位置：
   * - `FlexNodeRelPosition.LastChild`: 作为目标节点的最后一个子节点
   * - `FlexNodeRelPosition.FirstChild`: 作为目标节点的第一个子节点
   * - `FlexNodeRelPosition.NextSibling`: 作为目标节点的下一个兄弟节点
   * - `FlexNodeRelPosition.PreviousSibling`: 作为目标节点的上一个兄弟节点
   *
   * @param node - 要移动的源节点，可以是节点ID或完整的节点对象
   * @param toNode - 目标参考节点，可以是节点ID或完整的节点对象
   * @param pos - 相对位置，默认为 `FlexNodeRelPosition.NextSibling`
   *
   * @throws {Error} 当节点参数无效时抛出错误
   * @throws {FlexTreeError} 当移动操作不被允许时抛出错误（如移动到自己的后代节点）
   * @throws {FlexTreeError} 当尝试将根节点作为兄弟节点移动时抛出错误
   *
   * @example
   * ```typescript
   * // 将节点A移动到节点B的最后一个子节点位置
   * await manager.moveNode(nodeA, nodeB, FlexNodeRelPosition.LastChild)
   *
   * // 将节点A移动到节点B的下一个兄弟节点位置
   * await manager.moveNode(nodeA, nodeB, FlexNodeRelPosition.NextSibling)
   * ```
   *
   * ## 工作原理
   *
   * 基于 Nested Set Model（左右值算法），移动操作按以下步骤执行：
   *
   * ### 步骤 1: 获取节点数据
   * 获取源节点和目标节点的完整数据，包括：
   * - `leftValue`: 左值（节点在树中的起始位置）
   * - `rightValue`: 右值（节点在树中的结束位置）
   * - `level`: 层级深度
   * - `id`: 节点唯一标识
   *
   * ### 步骤 2: 移动权限验证
   * 通过 `canMoveTo()` 方法验证移动操作的合法性：
   * - 源节点和目标节点不能是同一个节点
   * - 目标节点不能是源节点的后代节点（避免形成循环引用）
   * - 单树模式下验证节点关系，多树模式下仅验证同树内的节点关系
   *
   * ### 步骤 3: 根节点特殊处理
   * 如果目标节点是根节点，进行额外检查：
   * - 不允许将根节点作为兄弟节点移动（`NextSibling` 或 `PreviousSibling`）
   * - 只允许将其他节点移动为根节点的子节点（`FirstChild` 或 `LastChild`）
   *
   * ### 步骤 4: 源节点脱离（标记删除）
   * 通过 `deleteNode()` 方法的 `onlyMark` 模式将源节点从树中暂时脱离：
   * - **不执行真正的删除操作**，只是将源节点及其所有后代节点的 `leftValue` 和 `rightValue` 转换为**负数**
   * - 转换为负数的目的是：在后续调整目标节点位置的值时，避免与源节点的值发生冲突
   * - 此时源节点在逻辑上已从原位置脱离，但数据仍然存在
   *
   * ### 步骤 5: 调整目标节点位置的空隙
   * 根据移动位置参数 `pos`，执行相应操作为新节点腾出空间：
   *
   * #### 5.1 移动到下一个兄弟节点 (`NextSibling`)
   * - 计算源节点子树的跨度：`movedLength = rightValue - leftValue + 1`
   * - 将目标节点右值之后的所有节点的左右值增加 `movedLength`
   * - 为源节点在目标节点之后腾出空间
   *
   * #### 5.2 移动到上一个兄弟节点 (`PreviousSibling`)
   * - 将目标节点左值及其之后的所有节点的左右值增加 `movedLength`
   * - 为源节点在目标节点之前腾出空间
   *
   * #### 5.3 移动到最后一个子节点 (`LastChild`)
   * - 将目标节点右值及其之后的所有节点的左右值增加 `movedLength`
   * - 为源节点作为目标节点的最后一个子节点腾出空间
   *
   * #### 5.4 移动到第一个子节点 (`FirstChild`)
   * - 将目标节点左值之后的所有节点的左右值增加 `movedLength`
   * - 为源节点作为目标节点的第一个子节点腾出空间
   *
   * ### 步骤 6: 源节点重新定位（修复负值）
   * 将源节点及其后代节点的负值转换为正值，并计算正确的位置：
   * - 根据目标节点的位置和移动类型，计算源节点的新 `leftValue`、`rightValue`
   * - 调整源节点及其所有后代的 `level` 值，使其符合新的层级关系
   * - 将所有负值转换为对应的正值，完成节点的最终定位
   *
   * ### 步骤 7: 执行SQL语句
   * 将所有生成的 SQL 语句按顺序执行，完成移动操作：
   * - 所有SQL语句在一个事务中执行
   * - 确保数据的一致性和完整性
   *
   * ## 算法优势
   *
   * 1. **避免值冲突**: 通过先将源节点值转换为负数，避免了在调整目标位置时与源节点值的冲突
   * 2. **保持树结构**: 整个过程始终维护 Nested Set Model 的完整性约束
   * 3. **高效操作**: 只需要执行有限的SQL更新操作，不需要重新构建整个树
   * 4. **原子性**: 所有更新在一个事务中完成，保证操作的原子性
   *
   * ## 注意事项
   *
   * - 移动操作会改变源节点的 `level` 值及其所有后代的 `level` 值
   * - 移动操作需要写权限，通过 `_assertWriteable()` 验证
   * - 在多树模式下，可以跨树移动节点（此时不验证节点关系）
   */
  async moveNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: NodeId | TreeNode,
    toNode?: NodeId | TreeNode,
    pos: FlexNodeRelPosition = FlexNodeRelPosition.NextSibling,
  ) {
    this._assertWriteable();
    if (!node || !toNode) {
      throw new Error("invalid node param");
    }

    const srcNode = (await this.getNodeData(node)) as unknown as TreeNode;
    const targetNode = (await this.getNodeData(toNode)) as unknown as TreeNode;

    if (!(await this.canMoveTo(srcNode, targetNode))) {
      throw new FlexTreeError(
        `Can not move node<${srcNode[this.keyFields.id]}> to target node<${targetNode[this.keyFields.id]}>`,
      );
    }

    if (this.isRoot(targetNode)) {
      if (pos === FlexNodeRelPosition.NextSibling || pos === FlexNodeRelPosition.PreviousSibling) {
        throw new FlexTreeError("Root node can not have next and previous sibling node");
      }
    }

    const sqls: string[] = [];

    // 按照核心算法：调用deleteNode标记源节点为删除，这保证了树的完整性
    await this.deleteNode(srcNode, { onlyMark: true });

    // 根据移动位置和节点树的长度，重新计算受影响节点的left,right值
    // 将已逻辑删除的节点的左右值更新
    if (pos === FlexNodeRelPosition.LastChild) {
      sqls.push(...this._moveToLastChild(srcNode, targetNode));
    } else if (pos === FlexNodeRelPosition.FirstChild) {
      sqls.push(...this._moveToFirstChild(srcNode, targetNode));
    } else if (pos === FlexNodeRelPosition.NextSibling) {
      sqls.push(...this._moveToNextSibling(srcNode, targetNode));
    } else if (pos === FlexNodeRelPosition.PreviousSibling) {
      sqls.push(...this._moveToPreviousSibling(srcNode, targetNode));
    }

    await this.onExecuteWriteSql(sqls);
  }

  /**
   * 节点上移
   *
   * 当移动的节点没有前一个兄弟节点时，将节点移动到父节点的下一个兄弟节点
   *
   * @param node
   */
  async moveUpNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: NodeId | TreeNode,
  ) {
    this._assertWriteable();
    const srcNode = (await this.getNodeData(node)) as unknown as TreeNode;
    const srcNodeId = srcNode[this.keyFields.id as string] as NodeId;

    let preNode = await this.getPreviousSibling(srcNode);
    if (preNode) {
      const preNodeId = preNode[this.keyFields.id as string] as NodeId;
      await this.moveNode(srcNodeId, preNodeId, FlexNodeRelPosition.PreviousSibling);
    } else {
      try {
        const parentNode = await this.getParent(srcNodeId);
        if (parentNode) {
          try {
            const parentNodeId = parentNode[this.keyFields.id as string] as NodeId;
            await this.moveNode(srcNodeId, parentNodeId, FlexNodeRelPosition.PreviousSibling);
          } catch {
            throw new FlexTreeNodeInvalidOperationError();
          }
        } else {
          throw new FlexTreeNodeInvalidOperationError();
        }
      } catch (error) {
        // 捕获FlexTreeNodeNotFoundError并转换为FlexTreeNodeInvalidOperationError
        if (error instanceof FlexTreeNodeNotFoundError) {
          throw new FlexTreeNodeInvalidOperationError();
        }
        throw error;
      }
    }
  }

  /**
   *
   * 节点下移
   *
   * @param node
   */
  async moveDownNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: NodeId | TreeNode,
  ) {
    this._assertWriteable();
    const srcNode = (await this.getNodeData(node)) as unknown as TreeNode;
    const srcNodeId = srcNode[this.keyFields.id as string] as NodeId;

    let nextNode = await this.getNextSibling(srcNode);
    if (nextNode) {
      const nextNodeId = nextNode[this.keyFields.id as string] as NodeId;
      await this.moveNode(srcNodeId, nextNodeId, FlexNodeRelPosition.NextSibling);
    } else {
      try {
        const parentNode = await this.getParent(srcNodeId);
        if (parentNode) {
          try {
            const parentNodeId = parentNode[this.keyFields.id as string] as NodeId;
            await this.moveNode(srcNodeId, parentNodeId, FlexNodeRelPosition.NextSibling);
          } catch {
            throw new FlexTreeNodeInvalidOperationError();
          }
        } else {
          throw new FlexTreeNodeInvalidOperationError();
        }
      } catch (error) {
        // 捕获FlexTreeNodeNotFoundError并转换为FlexTreeNodeInvalidOperationError
        if (error instanceof FlexTreeNodeNotFoundError) {
          throw new FlexTreeNodeInvalidOperationError();
        }
        throw error;
      }
    }
  }
}
