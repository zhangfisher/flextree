import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexNodeRelPosition } from "../types";
import { FlexTreeError } from "../errors";
import { isLikeNode } from "../utils/isLikeNode";

/**
 * copyNode 的选项
 */
export interface FlexTreeCopyOptions<NodeId = any, TreeNode = any, TreeId = any> {
  /** 是否包含后代节点，默认 true；false 时仅复制节点本身（副本为叶子节点） */
  includeDescendants?: boolean;
  /** 落点参照节点，副本以 pos 描述的相对关系落在其旁；缺省时等于源节点自身 */
  to?: NodeId | TreeNode;
  /** 副本与落点参照节点的相对位置，默认 FlexNodeRelPosition.NextSibling */
  pos?: FlexNodeRelPosition;
  /**
   * 目标树 id（可选）。提供且不等于当前 manager 的 treeId 时表示**跨树复制**：
   * 此时 `to` 指向的是该树中的节点 id，副本的 treeId 也采用该值。
   */
  treeId?: TreeId;
  /**
   * 指定复制时携带的字段名列表（可选）。未指定（undefined）时复制**所有字段**；
   * 指定为数组（含空数组）时只复制列出的字段，**空数组表示仅复制关键字段**。
   *
   * 无论指定什么列表，树的关键字段（id/treeId/name/level/leftValue/rightValue）
   * 始终包含、不受此参数控制；此参数只筛选其余自定义字段。
   * 典型用途：表中存在不重要字段（无需复制）或有唯一约束的字段（复制会导致
   * 冲突）时，选择性地复制节点数据。
   */
  fields?: string[];
  /**
   * 复制时的**字段变换表**（可选）：`{ 字段名: SQL表达式 }` 映射，作用于子树
   * **所有节点**。提供变换的字段，其值由 SQL 表达式计算（表达式中可引用原列，
   * 按自己的数据库方言书写），未提供变换的字段原样照抄。
   *
   * - 键为**表的物理字段名**（非 keyFields 映射名），如 `{ id: "uuid()", name: "name || '-copy'" }`
   * - `treeId`/`leftValue`/`rightValue`/`level` 是树结构基础字段，**不允许**变换（提供将被忽略）
   * - `id` 变换后 id 列显式出现（自增主键无需变换，省略 id 列由数据库生成）
   *
   * 表达式会**原样拼接**进 INSERT...SELECT 语句，调用方需自行确保其安全性。
   */
  transformField?: Record<string, string>;
}

export class CopyNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 计算副本子树的插入起点（腾挪空间的目标缺口位置）
   *
   * 返回值即副本根的新 leftValue
   */
  private _getCopyTargetStart(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    destNode: TreeNode,
    pos: FlexNodeRelPosition,
  ): number {
    switch (pos) {
      case FlexNodeRelPosition.LastChild:
        return destNode[this.keyFields.rightValue];
      case FlexNodeRelPosition.FirstChild:
        return destNode[this.keyFields.leftValue] + 1;
      case FlexNodeRelPosition.NextSibling:
        return destNode[this.keyFields.rightValue] + 1;
      case FlexNodeRelPosition.PreviousSibling:
        return destNode[this.keyFields.leftValue];
    }
  }

  /**
   * 构建复制操作的写阶段 SQL（纯生成，零 IO）
   *
   * 采用"负值暂存"模式（与 moveNode 的 detach 取负同源），保证对任意落点
   * （包括源子树区间内部，如复制为源节点自身的 child 位）都不会误伤源数据：
   *
   * 1. INSERT...SELECT 先读取**未被任何语句修改**的源子树，副本以负的
   *    leftValue/rightValue 落入暂存区（负值天然小于一切正常左值），
   *    level 按 levelDelta 一次调整到位
   * 2. 两条 UPDATE 为落点腾出宽度为 span 的空间——暂存副本（负值）不受影响；
   *    边界条件与 add.mixin 各 _add* 的腾挪条件等价（targetStart 落点处
   *    恰为该位置的缺口起点，树内左右值唯一性保证 >= 条件不误伤）
   * 3. 镜像 UPDATE 将暂存副本一次性翻正到最终位置：
   *    newLeft = offset - (-left)，offset = targetStart - srcLeft，
   *    代数上恰好把源区间 [srcLeft..srcRight] 平移到 [targetStart..targetStart+span-1]，
   *    且保持子树内部次序不变
   *
   * @param srcNode 源节点（SELECT * 读取的完整行，用于提取自定义字段列表）
   * @param destNode 落点参照节点
   * @param pos 相对位置
   * @param targetStart 副本根的新 leftValue
   * @param includeDescendants 是否包含后代
   * @param destTreeId 落点所在树的 treeId（跨树复制时为目标树，否则为当前 manager 的 treeId）
   * @param fields 指定复制的字段名列表（只筛选自定义字段，关键字段恒包含）；
   *   undefined=全量，[]（空数组）=仅关键字段
   * @param transformField 字段变换表 { 物理字段名: SQL表达式 }；
   *   树结构基础字段（treeId/leftValue/rightValue/level）不允许变换（忽略）
   */
  protected _buildCopySqls(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    srcNode: TreeNode,
    destNode: TreeNode,
    pos: FlexNodeRelPosition,
    targetStart: number,
    includeDescendants: boolean,
    destTreeId?: TreeId,
    fields?: string[],
    transformField?: Record<string, string>,
  ): string[] {
    const srcLeft = srcNode[this.keyFields.leftValue];
    const srcRight = srcNode[this.keyFields.rightValue];
    // 源子树宽度（含后代时为整个子树区间，否则为单节点宽度 2）
    const span = includeDescendants ? srcRight - srcLeft + 1 : 2;
    // 镜像翻正的偏移量：newLeft = offset - 存储的负左值。
    // 不含后代时副本是单叶子（right = left + 1），不能沿用源节点的 srcRight，
    // 故 right 的翻正基准使用副本右端的平移量（srcLeft + span - 1）
    const offset = targetStart - srcLeft;
    const offsetRight = targetStart + span - 1 - srcRight;

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const treeIdField = this.keyFields.treeId;
    const levelField = this.escaper.escapeId(this.keyFields.level);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    // 副本根的 level：child 位为 destNode.level+1，sibling 位为 destNode.level
    const isChildPos =
      pos === FlexNodeRelPosition.FirstChild || pos === FlexNodeRelPosition.LastChild;
    const levelDelta =
      (isChildPos ? destNode[this.keyFields.level] + 1 : destNode[this.keyFields.level]) -
      srcNode[this.keyFields.level];

    // 自定义字段：从源节点行提取（SELECT * 读取，含全部表列），排除系统字段后按原列名照抄。
    // fields 为数组时（含空数组）只携带列出的自定义字段——空数组即"仅关键字段"；
    // undefined 时全量复制。name 等关键字段不在此列，恒包含
    const systemFields = [
      this.keyFields.id,
      this.keyFields.treeId,
      this.keyFields.name,
      this.keyFields.level,
      this.keyFields.leftValue,
      this.keyFields.rightValue,
    ];
    const fieldFilter = Array.isArray(fields) ? new Set(fields) : null;
    const customFields = Object.keys(srcNode).filter(
      (f) => !systemFields.includes(f) && (!fieldFilter || fieldFilter.has(f)),
    );

    // 源子树范围：不含后代时仅命中源节点单行。
    // 注意：源读取按源节点**实际的 treeId** 过滤，不能用 {__TREE_ID__}——
    // 跨树复制时源在其他树中，当前 manager 的 treeId 过滤会读不到源数据
    const srcTreeIdCondition = this.isMultiTree
      ? `${this.escaper.escapeId(treeIdField)} = ${this.escaper.escape(srcNode[treeIdField])} AND `
      : "";
    const subtreeWhere = `${srcTreeIdCondition}${
      includeDescendants
        ? `${leftValueField} >= ${srcLeft} AND ${rightValueField} <= ${srcRight}`
        : `${leftValueField} = ${srcLeft}`
    }`;

    // 落点所在树的 treeId 条件：跨树复制时目标树与当前 manager 的树不同，
    // 不能用 {__TREE_ID__} 占位符（它固定注入 this.treeId），改为显式条件
    const destTreeIdValue = destTreeId !== undefined ? destTreeId : this.treeId;
    const destTreeIdCondition = this.isMultiTree
      ? `${this.escaper.escapeId(treeIdField)} = ${this.escaper.escape(destTreeIdValue)} AND `
      : "";

    // 字段变换表：任意字段（树结构基础字段除外）的 SELECT 表达式替换，作用于子树所有节点。
    // id 变换后 id 列显式出现（等价于为非自增主键生成新 id）。
    // treeId/leftValue/rightValue/level 由算法控制（落点决定），提供变换将被忽略
    const lockedFields = [
      this.keyFields.treeId,
      this.keyFields.level,
      this.keyFields.leftValue,
      this.keyFields.rightValue,
    ];
    const transforms = transformField
      ? Object.fromEntries(
          Object.entries(transformField).filter(([f]) => !lockedFields.includes(f as never)),
        )
      : {};

    // 列清单：id（提供变换时）+ treeId（多树表，取落点树的 treeId）
    // + name + 三个位置字段 + 自定义字段。
    // name 是关键字段，恒复制、不受 fields 筛选控制；
    // 提供变换的字段以表达式替换（作用于子树所有节点）
    const nameField = this.escaper.escapeId(this.keyFields.name);
    const columns: string[] = [];
    const selectExprs: string[] = [];
    if (transforms[this.keyFields.id]) {
      columns.push(idField);
      selectExprs.push(transforms[this.keyFields.id]);
    }
    if (this.isMultiTree) {
      columns.push(this.escaper.escapeId(treeIdField));
      selectExprs.push(this.escaper.escape(destTreeIdValue));
    }
    columns.push(nameField);
    selectExprs.push(transforms[this.keyFields.name] || nameField);
    columns.push(levelField, leftValueField, rightValueField, ...customFields.map((f) => this.escaper.escapeId(f)));
    selectExprs.push(
      `${levelField} + ${levelDelta}`,
      `-${leftValueField}`,
      `-${rightValueField}`,
      ...customFields.map((f) => transforms[f] || this.escaper.escapeId(f)),
    );

    // 腾挪两段平移的中间偏移：把受影响行先抬到"高隔离区"（远超一切正常左值），
    // 再落回目标位置。两段中间值在全表内唯一，规避 UNIQUE(treeId,leftValue) 约束下
    // 单条 UPDATE 逐行检查的撞车问题（低值行 +span 会撞上尚未处理的高值行）
    const quarantineOffset = 10 ** 9;

    return [
      // 第1步：快照源子树为负值暂存副本（此时源数据未被修改，读取安全）。
      // 源 WHERE 使用源实际 treeId（见 subtreeWhere），不经 _sql 注入 {__TREE_ID__}
      this._sql(`
            INSERT INTO ${this.tableName} (${columns.join(",")})
            SELECT ${selectExprs.join(",")}
            FROM ${this.tableName}
            WHERE ${subtreeWhere}
        `),
      // 第2步：腾出落点空间（暂存副本为负值，不受 >= targetStart 条件影响）。
      // 腾挪/翻正均作用于落点所在的树（跨树时为目标树），用显式 treeId 条件。
      // 左值分两段平移（高隔离区 → 落位）绕开 UNIQUE 约束的逐行检查撞车
      this._sql(`
            UPDATE ${this.tableName}
            SET ${leftValueField} = ${leftValueField} + ${quarantineOffset}
            WHERE ${destTreeIdCondition}${leftValueField} >= ${targetStart}
        `),
      this._sql(`
            UPDATE ${this.tableName}
            SET ${leftValueField} = ${leftValueField} + ${span} - ${quarantineOffset}
            WHERE ${destTreeIdCondition}${leftValueField} >= ${quarantineOffset}
        `),
      this._sql(`
            UPDATE ${this.tableName}
            SET ${rightValueField} = ${rightValueField} + ${span}
            WHERE ${destTreeIdCondition}${rightValueField} >= ${targetStart}
        `),
      // 第3步：镜像翻正，将暂存副本摆到最终位置（level 已在 INSERT 中调整到位）
      this._sql(`
            UPDATE ${this.tableName}
            SET
                ${leftValueField} = ${offset} - ${leftValueField},
                ${rightValueField} = ${offsetRight} - ${rightValueField}
            WHERE ${destTreeIdCondition}${leftValueField} < 0
        `),
    ];
  }

  /**
   * 复制节点
   *
   * 将源节点（默认连同其所有后代）复制到指定位置，产生的新子树与源子树
   * 除 id 外完全相同（level/leftValue/rightValue 等位置属性按落点重新计算）。
   *
   * 整个操作在 write() 的事务内以固定 4 条集合 SQL 完成（负值暂存模式），
   * **数据库访问次数与后代数量无关**——即使源节点有上万个后代，
   * 后代数据也不会被读取到应用层。
   *
   * @param nodeId 要复制的源节点 id
   * @param options 选项
   * @returns 副本根节点
   *
   * @throws {FlexTreeError} 落点在源节点的后代节点之下（自引用复制）
   * @throws {FlexTreeError} 落点为根节点且 pos 为 sibling 位（根无兄弟）
   *
   * @example
   * ```typescript
   * await tree.write(async () => {
   *   // 复制节点 A（含后代）到节点 B 之后
   *   const copyRoot = await tree.copyNode(aId, { to: bId, pos: FlexNodeRelPosition.NextSibling });
   *   // 仅复制节点本身（副本为叶子）
   *   const leafCopy = await tree.copyNode(aId, { includeDescendants: false });
   *   // uuid 主键表 / 改名：通过字段变换表提供 SQL 表达式
   *   const copy = await tree.copyNode(aId, {
   *     transformField: { id: "uuid()", name: "name || '-copy'" },
   *   });
   * });
   * ```
   */
  async copyNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: FlexTreeCopyOptions<NodeId, TreeNode, TreeId>,
  ): Promise<TreeNode> {
    this._assertWriteable();

    const {
      includeDescendants = true,
      to,
      pos = FlexNodeRelPosition.NextSibling,
      treeId,
      fields,
      transformField,
    } = options || {};

    // 跨树复制：options.treeId 提供且不等于当前 manager 的 treeId 时，
    // 落点 to 指向该树中的节点，副本的 treeId 也采用该值
    const isCrossTree = treeId !== undefined && treeId !== this.treeId;

    // 读取源节点与落点参照节点（to 缺省时参照源节点自身）。
    // 源读取：跨树场景下源可能不在当前树（反向：从其他树复制进来），按 id 全表定位；
    //         同树场景 getNodeData 的 {__TREE_ID__} 过滤即可命中。
    // 落点读取：跨树场景 to 是目标树的节点 id，须按目标 treeId + id 查（getNodeData
    //           的 {__TREE_ID__} 只查当前树，会漏查或错查同 id 节点）
    const idField = this.escaper.escapeId(this.keyFields.id);
    const srcIsId = !isLikeNode(nodeId, this.keyFields);
    const srcNode = srcIsId
      ? ((await this.getOneNode(
          this._sql(
            `SELECT * FROM ${this.tableName} WHERE ${idField} = ${this.escaper.escape(nodeId as any)}`,
          ),
        )) as TreeNode | null) ?? (await this.getNodeData(nodeId)) as unknown as TreeNode
      : ((await this.getNodeData(nodeId)) as unknown as TreeNode);
    const destNode =
      to === undefined
        ? srcNode
        : isCrossTree
          ? ((await this.getOneNode(
              this._sql(`
                    SELECT * FROM ${this.tableName}
                    WHERE ${this.escaper.escapeId(this.keyFields.treeId)} = ${this.escaper.escape(treeId)}
                      AND ${idField} = ${this.escaper.escape(isLikeNode(to, this.keyFields) ? (to as any)[this.keyFields.id] : to)}
                `),
            )) as TreeNode | null) ?? (() => {
              throw new FlexTreeError(`Destination node not found in tree<${treeId}>`);
            })()
          : ((await this.getNodeData(to)) as unknown as TreeNode);

    const srcLeft = srcNode[this.keyFields.leftValue];
    const srcRight = srcNode[this.keyFields.rightValue];
    const destLeft = destNode[this.keyFields.leftValue];
    const destRight = destNode[this.keyFields.rightValue];

    // 校验：落点不能是源节点的后代（自引用复制）。
    // 落点==源节点自身（to 缺省）或同树非后代均合法——pos 为 child 位且 to 缺省时，
    // 副本挂入源节点内部，这是合法场景。区间判断与 getNodeRelation 的 Descendants 一致。
    if (
      !this.isSameNode(destNode, srcNode) &&
      this.isSameTree(destNode, srcNode) &&
      destLeft > srcLeft &&
      destRight < srcRight
    ) {
      throw new FlexTreeError(
        `Can not copy node<${srcNode[this.keyFields.id]}> to its descendant node<${destNode[this.keyFields.id]}>`,
      );
    }

    // 校验：根节点无兄弟位（与 addNodes/moveNode 的根节点约束一致）
    if (
      this.isRoot(destNode) &&
      (pos === FlexNodeRelPosition.NextSibling || pos === FlexNodeRelPosition.PreviousSibling)
    ) {
      throw new FlexTreeError("Root node can not have next and previous sibling node");
    }

    const targetStart = this._getCopyTargetStart(destNode, pos);

    // 写阶段：4 条集合 SQL 一次提交（write() 的事务承载原子性）
    await this.onExecuteSql(
      this._buildCopySqls(
        srcNode,
        destNode,
        pos,
        targetStart,
        includeDescendants,
        isCrossTree ? treeId : undefined,
        fields,
        transformField,
      ),
    );

    // 收尾：按算出的副本根新 leftValue 反查（方言无关，无需 last_insert_rowid）。
    // 副本落在落点所在的树：跨树时按目标 treeId 反查，同树时按 {__TREE_ID__}
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const copyRoot = await this.getOneNode(
      isCrossTree
        ? this._sql(`
            SELECT * FROM ${this.tableName}
            WHERE ${this.escaper.escapeId(this.keyFields.treeId)} = ${this.escaper.escape(treeId)}
              AND ${leftValueField} = ${targetStart}
        `)
        : this._sql(`
            SELECT * FROM ${this.tableName}
            WHERE {__TREE_ID__} ${leftValueField} = ${targetStart}
        `),
    );
    if (!copyRoot) {
      throw new FlexTreeError(
        `Copy node<${srcNode[this.keyFields.id]}> failed: copy root not found at leftValue=${targetStart}`,
      );
    }
    this.emit("node:added", { tree: this.treeId, at: destNode, nodes: [copyRoot], pos });
    return copyRoot;
  }
}
