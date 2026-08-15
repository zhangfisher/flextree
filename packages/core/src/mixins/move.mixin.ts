import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexNodeRelPosition, FlexTreeNodeRelation } from "../types";
import {
  FlexTreeError,
  FlexTreeNodeInvalidOperationError,
  FlexTreeNodeNotFoundError,
} from "../errors";
import { isLikeNode } from "../utils/isLikeNode";

/**
 * moveNode 的选项（第三参数为对象时的形态）
 */
export interface FlexTreeMoveOptions<_TreeNode = any, TreeId = any> {
  /** 相对位置，默认 FlexNodeRelPosition.NextSibling（toNode 缺省的跨树迁出场景下无效） */
  pos?: FlexNodeRelPosition;
  /**
   * 目标树 id（可选）。提供且不等于当前 manager 的 treeId 时表示**跨树移动**：
   * - `toNode` 提供时：子树移到该树中 `toNode` 的指定相对位置
   * - `toNode` 缺省时：**迁出为新树**——node 成为该 treeId 的根（pos 无效），
   *   目标 treeId 必须尚无树（已存在则抛错）
   * 等于当前 treeId 时视为同树移动（忽略）；单树模式下提供将抛错。
   */
  treeId?: TreeId;
  /**
   * 回收站视角开关（启用回收站后生效）：
   * - 默认 false：node/toNode 任一在 bin 子树内（含 bin 自身，id 路径）抛 NotFound
   * - true：站内节点可移动（站内重排）、可移出（恢复）、可移入（手动回收）
   *
   * 注意：bin 自身作为移动源时保持位置不变量——落点须仍在根孩子层，跨树迁出被禁止
   */
  includeRecyclebin?: boolean;
}

/**
 * 跨树移动上下文（由 moveNode 解析后传入各 _moveTo*）
 *
 * - destTreeCondition：腾挪/挂载 SQL 的目标树 WHERE 前缀（显式 treeId 条件，
 *   不能用 {__TREE_ID__}——它注入的是源树条件，跨树时空间会腾错树）
 * - srcTreeCondition：翻正 SQL 的源树 WHERE 前缀（脱离的负值行仍属源树）
 * - treeIdSetClause：翻正语句追加的 treeId 改写（与坐标翻正同一条 UPDATE 完成，
 *   避免 (源treeId, 目标树坐标) 中间态撞 UNIQUE(treeId,leftValue) 约束）
 */
export interface CrossTreeMoveContext {
  /** 目标树条件前缀（显式 treeId 条件；跨树时须替换掉 {__TREE_ID__} 占位符） */
  destTreeCondition: string;
  /** 源树条件前缀（显式 treeId 条件；翻正负值行时替换掉 {__TREE_ID__} 占位符） */
  srcTreeCondition: string;
  /** 翻正语句追加的 treeId 改写（与坐标翻正同一条 UPDATE 完成，避免 (源treeId, 目标树坐标) 中间态撞 UNIQUE(treeId,leftValue) 约束） */
  treeIdSetClause: string;
}

/**
 * 跨树腾挪的两段平移隔离区偏移（与 copy.mixin 的 quarantineOffset 同源）：
 * 把受影响行先抬到远超一切正常左值的高隔离区再落回目标位置，
 * 规避 UNIQUE(treeId,leftValue) 约束下单条 UPDATE 逐行检查的撞车
 */
const QUARANTINE_OFFSET = 10 ** 9;

export class MoveNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   *
   * 返回node是否允许移动到toNode的指定的位置
   *
   *
   * 当满足以下条件时不允许移动
   *
   *  - 两个节点是一样的
   *  - toNode是node的后代
   *
   * 跨树移动根节点是允许的（等效删除原树，详见 moveNode）
   *
   * @example
   *
   *   canMoveTo(node1,node2)       node1能否移动到node2的后面，即下一个兄弟节点
   *   canMoveTo(node1,node2,{treeId:2})   node1能否跨树移动到tree2的node2位置
   *
   * @param node
   * @param toNode
   * @param options 跨树预检选项，treeId 指定目标树（语义与 moveNode 一致）
   * @returns  {boolean} true 允许移动，false 不允许移动
   */
  async canMoveTo(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: NodeId | TreeNode,
    toNode?: NodeId | TreeNode,
    options?: FlexTreeMoveOptions<TreeNode, TreeId>,
  ) {
    const srcNode = (await this.getNodeData(node)) as unknown as TreeNode;
    const destTreeId = options?.treeId;
    const isCrossTree = this._resolveCrossTree(destTreeId);
    const targetNode = (
      await this._getMoveDestNode(toNode as NodeId | TreeNode, isCrossTree ? destTreeId : undefined)
    ) as unknown as TreeNode;

    // 回收站门控（与 moveNode 同视角，保证预检与执行结论一致）：
    // 默认视角下源或落点在站内 → 不允许（moveNode 执行时抛 NotFound）。
    // 传节点对象时按"对象即凭证"放行（能拿到引用必然已进入回收站视角）
    if (this.recycleBinEnabled && !options?.includeRecyclebin && !isCrossTree) {
      const srcIsObject = typeof node === "object";
      const destIsObject = toNode !== undefined && typeof toNode === "object";
      const srcInBin = srcIsObject ? false : await this.isInRecycleBin(srcNode);
      const destInBin = destIsObject ? false : await this.isInRecycleBin(targetNode);
      if (srcInBin || destInBin) {
        return false;
      }
    }

    let isAllow: boolean = true;
    //
    if (
      !this.isMultiTree ||
      (this.isMultiTree && targetNode[this.keyFields.treeId] === srcNode[this.keyFields.treeId])
    ) {
      if (targetNode[this.keyFields.id] === srcNode[this.keyFields.id]) {
        isAllow = false;
      } else {
        // 传已解析的 srcNode（对象路径）：原始参数若是 id，getNodeRelation 内部
        // 会经 getNode 重查——启用回收站时站内节点被默认过滤而误判
        const r = await this.getNodeRelation(targetNode, srcNode);
        if (r === FlexTreeNodeRelation.Descendants) {
          isAllow = false;
        }
      }
    }
    return isAllow;
  }

  /**
   * 解析跨树标志：treeId 有效且不等于当前 manager 的 treeId 时为跨树
   * （与 copyNode 的 isCrossTree 判定一致；等于当前树时视为同树、忽略）
   *
   * 单树模式（isMultiTree === false）下提供 treeId 属于配置错误，直接抛错
   */
  protected _resolveCrossTree(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    treeId?: TreeId,
  ): treeId is TreeId {
    if (treeId === undefined) return false;
    if (!this.isMultiTree) {
      throw new FlexTreeError("treeId option requires multi-tree table");
    }
    return treeId !== this.treeId;
  }

  /**
   * 读取移动的落点参照节点
   *
   * 跨树时 toNode 指向目标树中的节点（id 或节点对象均可），按 目标treeId + id 查询
   * （getNodeData 的 {__TREE_ID__} 只查当前树，跨树时会漏查——即使 id 全表唯一，
   * 不限定目标树也无法确认节点确实在该树中）；
   * 同树时走 getNodeData 既有路径。查不到时抛错（目标树不存在或节点不在该树）
   */
  protected async _getMoveDestNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    toNode: NodeId | TreeNode,
    destTreeId?: TreeId,
  ): Promise<TreeNode> {
    if (destTreeId === undefined) {
      return (await this.getNodeData(toNode)) as unknown as TreeNode;
    }
    const idField = this.escaper.escapeId(this.keyFields.id);
    const nodeId = isLikeNode(toNode, this.keyFields)
      ? (toNode as any)[this.keyFields.id]
      : toNode;
    const destNode = await this.getOneNode(
      this._sql(`
            SELECT * FROM ${this.tableName}
            WHERE ${this.escaper.escapeId(this.keyFields.treeId)} = ${this.escaper.escape(destTreeId)}
              AND ${idField} = ${this.escaper.escape(nodeId)}
        `),
    );
    if (!destNode) {
      throw new FlexTreeError(`Destination node not found in tree<${destTreeId}>`);
    }
    return destNode as TreeNode;
  }

  /**
   * 构建跨树移动上下文（见 CrossTreeMoveContext 字段注释）
   */
  protected _buildCrossTreeContext(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    destTreeId: TreeId,
  ): CrossTreeMoveContext {
    const treeIdField = this.escaper.escapeId(this.keyFields.treeId);
    // 条件串自带末尾空格，拼接时不依赖模板换行缩进；不含 {__TREE_ID__} 占位符
    // （多树模式下 _sql 会向模板中残留的占位符注入 this.treeId 即源树条件，
    //  与显式目标树条件拼接会得到恒假条件，故各 _moveTo* 模板中跨树分支
    //  必须完全去掉占位符、只保留 ${destCond} / ${restoreCond}）
    return {
      destTreeCondition: `${treeIdField} = ${this.escaper.escape(destTreeId)} AND `,
      srcTreeCondition: `${treeIdField} = ${this.escaper.escape(this.treeId)} AND `,
      treeIdSetClause: `, ${treeIdField} = ${this.escaper.escape(destTreeId)}`,
    };
  }

  /**
   * 跨树迁出为新树的根（toNode 缺省 + options.treeId 提供时）
   *
   * 目标树须为空（已校验）：无需腾挪，直接将脱离取负的子树翻正到
   * 新树的 [1..span] 区间，level 归零到根，treeId 同语句改写为目标树。
   * 等效于"把 node 子树搬出去另立一棵树"
   */
  private _moveToNewTree(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    crossTree: CrossTreeMoveContext,
  ): string[] {
    const srcLeft = fromNode[this.keyFields.leftValue];
    const srcLevel = fromNode[this.keyFields.level];

    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    // 翻正 + 归属改写在同一条 UPDATE：newLeft = 1 - srcLeft + 存储的负左值
    // 代数上把 [srcLeft..srcRight] 平移到 [1..span]，子树内部次序不变；
    // rightValue 翻正语句按目标树过滤（leftValue 翻正已改写归属，见 _moveToNextSibling 注释）
    return [
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = 1 - ${srcLeft} - ${leftValueField}${crossTree.treeIdSetClause},
                    ${levelField} = ${levelField} - ${srcLevel}
                WHERE ${crossTree.srcTreeCondition}${leftValueField} < 0
            `),
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = 1 - ${srcLeft} - ${rightValueField}
                WHERE ${crossTree.destTreeCondition}${rightValueField} < 0
            `),
    ];
  }

  /**
   * 移动到下一个节点
   *
   * 跨树（crossTree 提供时）：腾挪作用于目标树（腾挪条件天然覆盖目标树祖先链，
   * 无需额外补偿）；目标坐标在另一棵树、与源树脱离无关，adjustedToNode* 不扣减；
   * 翻正语句同语句改写 treeId
   */
  private _moveToNextSibling(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    toNode: TreeNode,
    crossTree?: CrossTreeMoveContext,
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

    // 目标树条件：跨树时用显式 treeId 条件并**吞掉** {__TREE_ID__} 占位符
    // （_sql 注入的是 this.treeId 即源树条件，拼上会得到 treeId=目标 AND treeId=源 的恒假条件）
    const destCond = crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}";
    // 翻正语句的树条件：跨树时脱离的负值行仍属源树，按源树过滤
    const restoreCond = crossTree ? crossTree.srcTreeCondition : "{__TREE_ID__}";
    // rightValue 翻正语句的树条件：跨树时**按目标树过滤**——leftValue 翻正语句已把
    // 移动行的 treeId 改写为目标树，此时负 rightValue 行已不属源树，按源树过滤恒不命中
    const restoreRightCond = crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}";
    // 翻正时同语句改写 treeId（跨树专属），避免 (源treeId,目标树坐标) 中间态
    const treeIdSet = crossTree ? crossTree.treeIdSetClause : "";

    // 计算目标节点在deleteNode调整后的rightValue
    // 如果目标节点在源节点右边，它的rightValue会被减少movedLength
    // （跨树时目标在另一棵树，不受源树脱离影响，不扣减）
    const adjustedToNodeRightValue =
      toNodeRightValue > rightValue && !crossTree
        ? toNodeRightValue - movedLength
        : toNodeRightValue;

    const sqls: string[] = [
      // 第1步：为目标位置腾出空间（在调整后的目标节点之后）
      // 跨树时先经高隔离区两段平移，规避 UNIQUE(treeId,leftValue) 逐行检查撞车
      ...(crossTree
        ? [
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${QUARANTINE_OFFSET}
                WHERE ${destCond}
                    ${leftValueField} > ${adjustedToNodeRightValue}
            `),
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength} - ${QUARANTINE_OFFSET}
                WHERE ${destCond}
                    ${leftValueField} > ${QUARANTINE_OFFSET}
            `),
          ]
        : [
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength}
                WHERE ${destCond}
                    ${leftValueField} > ${adjustedToNodeRightValue}
            `),
          ]),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE ${destCond}
                    ${rightValueField} > ${adjustedToNodeRightValue}
            `),

      // 第2步：将已逻辑删除的节点移动到新位置并恢复为正数
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${adjustedToNodeRightValue + 1} + (-${leftValueField} - ${leftValue})${treeIdSet},
                    ${levelField} = ${toNode[this.keyFields.level]} + ${levelField} - ${fromNode[this.keyFields.level]}
                WHERE ${restoreCond}
                    ${leftValueField} < 0
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${adjustedToNodeRightValue + 1} + (-${rightValueField} - ${leftValue})${treeIdSet}
                WHERE ${restoreRightCond}
                    ${rightValueField} < 0
            `),
    ];

    // 跨树无需额外的祖先链补偿：腾挪条件 rightValue > adjustedToNodeRightValue
    // 天然覆盖目标树的全部祖先（祖先的 rightValue 必大于落点右值）
    return sqls;
  }

  private _moveToPreviousSibling(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    toNode: TreeNode,
    crossTree?: CrossTreeMoveContext,
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

    // 跨树时目标树条件与翻正改写（见 _moveToNextSibling 注释）
    const destCond = crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}";
    const restoreCond = crossTree ? crossTree.srcTreeCondition : "{__TREE_ID__}";
    const restoreRightCond = crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}";
    const treeIdSet = crossTree ? crossTree.treeIdSetClause : "";

    // 计算目标节点在deleteNode调整后的leftValue
    // 如果目标节点在源节点右边，它的leftValue会被减少movedLength
    // （跨树时目标在另一棵树，不受源树脱离影响，不扣减）
    const adjustedToNodeLeftValue =
      toNodeLeftValue > rightValue && !crossTree
        ? toNodeLeftValue - movedLength
        : toNodeLeftValue;

    const sqls: string[] = [
      // 第1步：为目标位置腾出空间（在调整后的目标节点之前）
      // 跨树时先经高隔离区两段平移，规避 UNIQUE(treeId,leftValue) 逐行检查撞车
      ...(crossTree
        ? [
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${QUARANTINE_OFFSET}
                WHERE 
                    ${destCond}
                    ${leftValueField} >= ${adjustedToNodeLeftValue}
            `),
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength} - ${QUARANTINE_OFFSET}
                WHERE 
                    ${destCond}
                    ${leftValueField} > ${QUARANTINE_OFFSET}
            `),
          ]
        : [
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength}
                WHERE 
                    ${destCond}
                    ${leftValueField} >= ${adjustedToNodeLeftValue}
            `),
          ]),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE 
                    ${destCond}
                    ${rightValueField} >= ${adjustedToNodeLeftValue}
            `),

      // 第2步：将已逻辑删除的节点移动到新位置并恢复为正数
      // 源节点应该插入到adjustedToNodeLeftValue之前
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${adjustedToNodeLeftValue} + (-${leftValueField} - ${leftValue})${treeIdSet},
                    ${levelField} = ${toNode[this.keyFields.level]} + ${levelField} - ${fromNode[this.keyFields.level]}
                WHERE 
                    ${restoreCond} ${leftValueField} < 0
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${adjustedToNodeLeftValue} + (-${rightValueField} - ${leftValue})${treeIdSet}
                WHERE
                    ${restoreRightCond} ${rightValueField} < 0
            `),
    ];
    // 跨树无需额外的祖先链补偿：腾挪条件 rightValue >= adjustedToNodeLeftValue
    // 天然覆盖目标树的全部祖先（祖先的 rightValue 必大于等于落点左值）
    return sqls;
  }

  private _moveToLastChild(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    toNode: TreeNode,
    crossTree?: CrossTreeMoveContext,
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

    // 跨树时目标树条件与翻正改写（见 _moveToNextSibling 注释）
    const destCond = crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}";
    const restoreCond = crossTree ? crossTree.srcTreeCondition : "{__TREE_ID__}";
    const restoreRightCond = crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}";
    const treeIdSet = crossTree ? crossTree.treeIdSetClause : "";

    // 计算目标节点在deleteNode调整后的rightValue
    // 如果目标节点在源节点右边，它的rightValue会被减少movedLength
    // （跨树时目标在另一棵树，不受源树脱离影响，不扣减）
    const adjustedToNodeRightValue =
      toNodeRightValue > rightValue && !crossTree
        ? toNodeRightValue - movedLength
        : toNodeRightValue;

    const sqls: string[] = [
      // 第1步：为目标位置腾出空间（在调整后的目标节点右值之前，作为最后一个子节点）
      // 跨树时先经高隔离区两段平移，规避 UNIQUE(treeId,leftValue) 逐行检查撞车
      ...(crossTree
        ? [
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${QUARANTINE_OFFSET}
                WHERE 
                    ${destCond}
                    ${leftValueField} > ${adjustedToNodeRightValue}
            `),
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength} - ${QUARANTINE_OFFSET}
                WHERE 
                    ${destCond}
                    ${leftValueField} > ${QUARANTINE_OFFSET}
            `),
          ]
        : [
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength}
                WHERE 
                    ${destCond}
                    ${leftValueField} > ${adjustedToNodeRightValue}
            `),
          ]),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE 
                    ${destCond}
                    ${rightValueField} > ${adjustedToNodeRightValue}
            `),

      // 第2步：将已逻辑删除的节点移动到新位置并恢复为正数
      // 源节点应该插入到adjustedToNodeRightValue之前（作为目标节点的最后一个子节点）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${adjustedToNodeRightValue} + (-${leftValueField} - ${leftValue})${treeIdSet},
                    ${levelField} = ${toNode[this.keyFields.level]} + ${levelField} - ${fromNode[this.keyFields.level]} + 1
                WHERE 
                    ${restoreCond} ${leftValueField} < 0
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${adjustedToNodeRightValue} + (-${rightValueField} - ${leftValue})${treeIdSet}
                WHERE
                    ${restoreRightCond} ${rightValueField} < 0
            `),

      // 第3步：更新目标节点本身的rightValue（因为它现在包含了新的子树）
      // 跨树时按目标树 + id 定位（{__TREE_ID__} 是源树条件，且目标树可能有同 id 节点）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE ${crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}"}${idField} = ${toNode[this.keyFields.id]}
            `),
    ];
    // 跨树无需额外的祖先链补偿：第3步已对目标节点本身 +span，腾挪条件
    // rightValue > adjustedToNodeRightValue 天然覆盖目标树的其余祖先
    return sqls;
  }

  private _moveToFirstChild(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    fromNode: TreeNode,
    toNode: TreeNode,
    crossTree?: CrossTreeMoveContext,
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

    // 跨树时目标树条件与翻正改写（见 _moveToNextSibling 注释）
    const destCond = crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}";
    const restoreCond = crossTree ? crossTree.srcTreeCondition : "{__TREE_ID__}";
    const restoreRightCond = crossTree ? crossTree.destTreeCondition : "{__TREE_ID__}";
    const treeIdSet = crossTree ? crossTree.treeIdSetClause : "";

    // 计算目标节点在deleteNode调整后的位置
    // 如果目标节点在源节点右边，它的leftValue和rightValue会被减少movedLength
    // （跨树时目标在另一棵树，不受源树脱离影响，不扣减）
    const adjustedToNodeLeftValue =
      toNodeLeftValue > rightValue && !crossTree
        ? toNodeLeftValue - movedLength
        : toNodeLeftValue;
    const adjustedToNodeRightValue =
      toNodeRightValue > rightValue && !crossTree
        ? toNodeRightValue - movedLength
        : toNodeRightValue;

    const sqls: string[] = [
      // 第1步：为目标位置腾出空间（在调整后的目标节点左值之后，作为第一个子节点）
      // 更新所有leftValue大于目标节点leftValue的节点，包括目标节点的子节点和后续兄弟节点
      // 跨树时先经高隔离区两段平移，规避 UNIQUE(treeId,leftValue) 逐行检查撞车
      ...(crossTree
        ? [
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${QUARANTINE_OFFSET}
                WHERE 
                    ${destCond}
                    ${leftValueField} > ${adjustedToNodeLeftValue}
            `),
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength} - ${QUARANTINE_OFFSET}
                WHERE 
                    ${destCond}
                    ${leftValueField} > ${QUARANTINE_OFFSET}
            `),
          ]
        : [
            this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} + ${movedLength}
                WHERE 
                    ${destCond}
                    ${leftValueField} > ${adjustedToNodeLeftValue}
            `),
          ]),

      // rightValue更新：只更新目标节点及其后续兄弟节点
      // 排除祖先节点：ancestors.leftValue < toNode.leftValue
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE 
                    ${destCond}
                    ${rightValueField} > ${adjustedToNodeLeftValue} AND
                    ${leftValueField} >= ${adjustedToNodeLeftValue}
            `),

      // 第2步：将已逻辑删除的节点移动到新位置并恢复为正数
      // 源节点应该插入到adjustedToNodeLeftValue之后（作为目标节点的第一个子节点）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${adjustedToNodeLeftValue} + (-${leftValueField} - ${leftValue}) + 1${treeIdSet},
                    ${levelField} = ${toNode[this.keyFields.level]} + ${levelField} - ${fromNode[this.keyFields.level]} + 1
                WHERE 
                    ${restoreCond} ${leftValueField} < 0
            `),

      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${adjustedToNodeLeftValue} + (-${rightValueField} - ${leftValue}) + 1${treeIdSet}
                WHERE
                    ${restoreRightCond} ${rightValueField} < 0
            `),

      // 第3步：更新目标节点的所有祖先节点的rightValue
      // 使用更精确的条件，只包含真正的祖先节点，避免更新后续兄弟节点
      // 祖先节点的特征是：leftValue < adjustedToNodeLeftValue 且 rightValue > adjustedToNodeRightValue
      // （跨树时该条件即祖先链扩张，条件已切换为目标树）
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} + ${movedLength}
                WHERE 
                    ${destCond}
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
   * @param node - 要移动的源节点，可以是节点ID或完整的节点对象（须属于当前树）
   * @param toNode - 目标参考节点，可以是节点ID或完整的节点对象
   * @param posOrOptions - 相对位置（枚举）或选项对象；选项对象可指定 `pos` 与 `treeId`
   *
   * @throws {Error} 当节点参数无效时抛出错误
   * @throws {FlexTreeError} 当移动操作不被允许时抛出错误（如移动到自己的后代节点）
   * @throws {FlexTreeError} 当尝试将根节点作为兄弟节点移动时抛出错误
   * @throws {FlexTreeError} 单树模式下提供 treeId 选项时抛出错误
   * @throws {FlexTreeError} 跨树移动时目标树中找不到 toNode 抛出错误
   * @throws {FlexTreeError} 迁出为新树（toNode 缺省）时目标 treeId 已存在树抛出错误
   *
   * @example
   * ```typescript
   * // 将节点A移动到节点B的最后一个子节点位置（位置参数风格，向后兼容）
   * await manager.moveNode(nodeA, nodeB, FlexNodeRelPosition.LastChild)
   *
   * // 将节点A移动到节点B的下一个兄弟节点位置
   * await manager.moveNode(nodeA, nodeB, { pos: FlexNodeRelPosition.NextSibling })
   *
   * // 跨树移动：将节点A移动到 treeId=2 中节点C的最后一个子节点位置
   * await manager.moveNode(nodeA, nodeC, { treeId: 2, pos: FlexNodeRelPosition.LastChild })
   *
   * // 跨树移动根节点：整棵树并入 treeId=2（等效删除了当前 manager 所管理的树）
   * const root = await manager.getRoot();
   * await manager.moveNode(root, nodeC, { treeId: 2, pos: FlexNodeRelPosition.LastChild })
   * // 此后对当前 manager 的任何操作均会失败（树已不存在）
   *
   * // 迁出为新树：node 子树成为 treeId=3 的新树根（toNode 缺省，pos 无效）
   * await manager.moveNode(nodeA, undefined, { treeId: 3 })
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
   * ### 步骤 4: 源节点脱离
   * 通过 `_buildDetachSqls()` 生成脱离 SQL，将源节点从树中暂时脱离：
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
   * - 多树模式下支持跨树移动：提供 `options.treeId` 指定目标树，源节点须属于当前树，
   *   `toNode` 指向目标树中的节点；跨树移动不验证节点关系（不同树的节点无祖先关系）。
   *   **方向是单向的：只能将当前树的节点移出到其他树**，不能把其他树的节点移入当前树
   *   （其他树的节点在当前 manager 的 {__TREE_ID__} 过滤下查不到，会抛 NotFound；
   *   反向移动请使用目标树侧的 manager 执行）
   * - 跨树移动会触发两个事件：先 `node:deleted`（源树视角，节点被移离），后 `node:moved`
   *   （`toTree` 指向目标树）
   * - **跨树且 toNode 缺省 = 迁出为新树**：node 连同其子树成为 `options.treeId` 的**新树根**
   *   （level=0、leftValue=1，子树内部结构保持），`pos` 无效；目标 treeId 必须尚无树，
   *   已存在则抛错。源根节点同样适用（整棵树"搬家"到新 treeId）
   * - **跨树移动根节点是允许的**：整棵源树（根及其所有后代）并入目标树，等效于删除了
   *   原树。此操作成功后，**当前 manager 所管理的树已不存在，对它的任何后续操作均会失败**
   *   （读取得到空结果、写入抛错）。如需继续管理该 treeId，须先重新 createRoot
   * - 目标为根节点时禁止 sibling 位（根无兄弟，同树/跨树同规则）
   */
  async moveNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: NodeId | TreeNode,
    toNode?: NodeId | TreeNode,
    posOrOptions: FlexNodeRelPosition | FlexTreeMoveOptions<TreeNode, TreeId> = FlexNodeRelPosition.NextSibling,
  ) {
    this._assertWriteable();
    // 第三参数联合类型：枚举（旧位置参数风格）或选项对象
    const options: FlexTreeMoveOptions<TreeNode, TreeId> =
      typeof posOrOptions === "number"
        ? { pos: posOrOptions }
        : (posOrOptions ?? {});

    const pos = options.pos ?? FlexNodeRelPosition.NextSibling;
    // 跨树判定：treeId 提供且不等于当前树（单树模式传 treeId 直接抛错）
    const destTreeId = options.treeId;
    const isCrossTree = this._resolveCrossTree(destTreeId);
    // 跨树 + toNode 缺省：迁出为新树（node 成为该 treeId 的根），pos 无效
    const isNewTree = isCrossTree && toNode === undefined;
    // 回收站视角（启用回收站后生效；对象即凭证：仅 id 路径做门控点查）
    const includeBin = !!options.includeRecyclebin;

    if (!node || (!toNode && !isNewTree)) {
      throw new Error("invalid node param");
    }
    // node/toNode 收窄为局部变量：NodeId | TreeNode 的泛型联合在后续对象字面量/
    // 函数实参位置会触发 TS2590（联合类型过于复杂），此处经 any 中转切断归约
    const nodeArg: any = node;
    const toNodeArg: any = toNode;

    // 源节点限当前树（多树表的 id 是表主键、全表唯一；getNodeData 的
    // {__TREE_ID__} 过滤保证源不在当前树时正确报 NotFound）
    const srcNode = (await this.getNodeData(node)) as unknown as TreeNode;

    // ---- 回收站门控与位置不变量（启用回收站后生效）----
    // id 路径门控：默认视角下源节点在站内（含 bin 自身后代）→ NotFound；
    // 传节点对象时按"对象即凭证"放行（能拿到引用必然已进入回收站视角读取过）
    let srcInBin = false;
    if (this.recycleBinEnabled) {
      if (typeof node !== "object" && !includeBin) {
        if (await this.isInRecycleBin(srcNode)) {
          throw new FlexTreeNodeNotFoundError();
        }
      }
      srcInBin = await this.isInRecycleBin(srcNode);
      // 位置不变量：bin 自身作为移动源时，落点须保持在根孩子层；跨树迁出禁止
      if (this.isRecycleBin(srcNode)) {
        if (isCrossTree) {
          throw new FlexTreeError("Recyclebin node can not be moved to another tree");
        }
        if (
          pos === FlexNodeRelPosition.FirstChild ||
          pos === FlexNodeRelPosition.LastChild
        ) {
          // 作为根的子节点：合法（根孩子层内），但 toNode 必须是根
          const targetForCheck = (await this._getMoveDestNode(toNode as any)) as TreeNode;
          if (!this.isRoot(targetForCheck)) {
            throw new FlexTreeError("Recyclebin node must stay at root's children level");
          }
        } else {
          // sibling 位：目标须是根的孩子（level===1）
          const targetForCheck = (await this._getMoveDestNode(toNode as any)) as TreeNode;
          if (targetForCheck[this.keyFields.level] !== 1) {
            throw new FlexTreeError("Recyclebin node must stay at root's children level");
          }
        }
      }
    }

    const moveSqls: string[] = [];
    // 跨树上下文：目标树腾挪条件、源树翻正条件、翻正同语句改写 treeId
    const crossTree = isCrossTree ? this._buildCrossTreeContext(destTreeId) : undefined;

    if (isNewTree) {
      // 目标树必须为空：已有树则翻正会与既有根撞 UNIQUE(treeId,leftValue)
      const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
      const existingRoot = await this.getOneNode(
        this._sql(`
                SELECT * FROM ${this.tableName}
                WHERE ${crossTree!.destTreeCondition}${leftValueField} = 1
            `),
      );
      if (existingRoot) {
        throw new FlexTreeError(`Tree<${destTreeId}> already exists`);
      }
      // 脱离 + 翻正归位到新树的 [1..span]，node 成为新树根
      const detachSqls = this._buildDetachSqls(srcNode, { detach: true });
      moveSqls.push(...detachSqls, ...this._moveToNewTree(srcNode, crossTree!));
      await this.onExecuteSql(moveSqls);
      // 与跨树移动同序：先 node:deleted（源树视角）后 node:moved
      this.emit("node:deleted", { tree: this.treeId, node: nodeArg } as any);
      this.emit("node:moved", {
        tree: this.treeId,
        toTree: destTreeId,
        from: nodeArg,
        to: undefined,
        pos,
      } as any);
      return;
    }

    // 落点参照节点：跨树时按 目标treeId + id 读取（isNewTree 分支已 return，此处必有 toNode）
    // 参数经 any 中转：NodeId | TreeNode 的泛型联合会触发 TS2590（联合类型过于复杂）
    const targetNode = (await this._getMoveDestNode(
      toNode as any,
      isCrossTree ? destTreeId : undefined,
    )) as TreeNode;

    // 落点门控：默认视角下落点在站内（含 bin 自身）→ NotFound（对象即凭证原则同样适用）
    let destInBin = false;
    if (this.recycleBinEnabled && !isCrossTree) {
      // 参数经 any 中转：toNode 的泛型联合会触发 TS2590（联合类型过于复杂）
      const toNodeLocal: any = toNode;
      if (typeof toNodeLocal !== "object" && !includeBin) {
        if (await this.isInRecycleBin(targetNode)) {
          throw new FlexTreeNodeNotFoundError();
        }
      }
      destInBin = await this.isInRecycleBin(targetNode);
    }

    // canMoveTo 与 moveNode 同视角透传（回收站视角下落点可为 bin；跨树时透传目标树）
    if (
      !(await this.canMoveTo(
        srcNode,
        targetNode,
        isCrossTree
          ? { treeId: destTreeId }
          : includeBin
            ? { includeRecyclebin: true }
            : undefined,
      ))
    ) {
      throw new FlexTreeError(
        `Can not move node<${srcNode[this.keyFields.id]}> to target node<${targetNode[this.keyFields.id]}>`,
      );
    }

    // 根节点校验：目标是根节点时禁止兄弟位（根无兄弟；同树/跨树同规则）。
    // 注意跨树移动源根节点是允许的——整棵源树并入目标树，等效删除了原树
    if (this.isRoot(targetNode)) {
      if (pos === FlexNodeRelPosition.NextSibling || pos === FlexNodeRelPosition.PreviousSibling) {
        throw new FlexTreeError("Root node can not have next and previous sibling node");
      }
    }

    // 按照核心算法：让源节点脱离原位置（取负 + 回缩右侧左右值），
    // 这保证了后续移动 SQL 计算时树的完整性（源子树已不在原位置占位）。
    // 脱离 SQL 与下方的移动 SQL 拼接后，在同一个事务中执行，保证整个移动操作原子完成。
    // 脱离的 {__TREE_ID__} 即源树条件，跨树时无需调整。
    const detachSqls = this._buildDetachSqls(srcNode, { detach: true });

    // 根据移动位置和节点树的长度，重新计算受影响节点的left,right值
    // 将已脱离（取负）的节点的左右值更新到新位置并翻正
    if (pos === FlexNodeRelPosition.LastChild) {
      moveSqls.push(...this._moveToLastChild(srcNode, targetNode, crossTree));
    } else if (pos === FlexNodeRelPosition.FirstChild) {
      moveSqls.push(...this._moveToFirstChild(srcNode, targetNode, crossTree));
    } else if (pos === FlexNodeRelPosition.NextSibling) {
      moveSqls.push(...this._moveToNextSibling(srcNode, targetNode, crossTree));
    } else if (pos === FlexNodeRelPosition.PreviousSibling) {
      moveSqls.push(...this._moveToPreviousSibling(srcNode, targetNode, crossTree));
    }
    // 一个事务：先脱离源位置，再挂载到目标位置
    await this.onExecuteSql([...detachSqls, ...moveSqls]);
    // 事件载荷经 any 中转：node/toNode 的泛型联合会触发 TS2590（联合类型过于复杂）
    const event: any = {
      tree: this.treeId,
      toTree: isCrossTree ? destTreeId : this.treeId,
      from: nodeArg,
      to: toNodeArg,
      pos,
    };
    if (isCrossTree) {
      // 跨树移动对源树而言节点被移离：先发 node:deleted（源树视角），
      // 再发 node:moved（toTree 指向目标树）
      this.emit("node:deleted", { tree: this.treeId, node: nodeArg } as any);
    }
    // 回收站状态跃迁规则：仅"站外→站内"跃迁发 node:deleted(recycled)——
    // 节点从逻辑树消失。站内重排、恢复移出（站内→站外）只发 node:moved
    if (this.recycleBinEnabled && !srcInBin && destInBin) {
      this.emit("node:deleted", { tree: this.treeId, node: nodeArg, recycled: true } as any);
    }
    this.emit("node:moved", event);
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
