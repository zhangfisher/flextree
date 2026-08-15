import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexTreeError, FlexTreeNodeNotFoundError, FlexTreeNotExists } from "../errors";
import { isLikeNode } from "../utils/isLikeNode";
import { isNull } from "../utils/isNull";
import { checkSqlSafety } from "../utils/checkSqlSafety";

export class GetNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   *
   * 根据输入参数返回节点数据
   *
   * - 如果node==undefined 返回根节点
   * - 如果node是节点对象，则直接返回
   * - 如果node是字符串或数字，则根据ID获取节点信息
   *
   * 注意：这是**内部读取路径**，不过滤回收站——写操作的前置读取（deleteNode 的
   * recycle 分支、clearRecycleBin、恢复移动等）需要读到"逻辑不存在"的节点，
   * 由各写方法自行做门控判定。公共查询请用 getNode（默认过滤）
   */
  async getNodeData(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    param: any,
  ) {
    let node: TreeNode;
    // 如果输入的是节点对象已经包含了节点信息，可以直接使用
    if (isNull(param)) {
      // 未指定目标节点，则添加到根节点
      node = (await this.getRoot()) as TreeNode;
      if (!node) {
        throw new FlexTreeNotExists();
      }
    } else if (isLikeNode(param, this.keyFields)) {
      node = param as TreeNode;
    } else if (["string", "number"].includes(typeof param)) {
      // 否则需要根据ID获取节点信息（内部路径：绕过回收站过滤）
      node = (await this.getNode(param as any, { includeRecyclebin: true })) as TreeNode;
    } else {
      throw new FlexTreeError("Invalid node parameter");
    }
    if (!this.isValidNode(node!)) {
      throw new FlexTreeNodeNotFoundError("Invalid node parameter");
    }
    return node;
  }

  /**
   * 获取节点列表
   * @param {object} options                    选项
   * @param {number}  [options.level]            限定返回的层级,0表示不限制,1表示只返回根节点，2表示返回根节点和其子节点, 依次类推
   * @param {number}  [options.files]            限定返回的字段名称
   * @param {string}  [options.where]            WHERE过滤条件，确保树的完整性：父节点被过滤时，其所有后代也被过滤
   * @param {boolean} [options.includeRecyclebin] 默认 false：回收站（bin 及其后代）在数据库端被排除；true 返回物理全集
   * @returns TreeNode[]
   */
  async getNodes(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    options?: {
      level?: number;
      fields?: (keyof TreeNode)[];
      where?: string;
      includeRecyclebin?: boolean;
    },
  ): Promise<TreeNode[]> {
    const { level, fields, where } = Object.assign({ level: 0, fields: [], where: "" }, options);

    const fieldList = fields.length > 0 ? fields.map((f) => `${f}`).join(",") : "*";

    // 数据库端回收站过滤（数据库端过滤铁律：行数在 DB 端就已正确）
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin, "Node.");

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    let sql: string;

    if (where && where.trim()) {
      // 带过滤条件的复杂查询
      const validatedWhere = checkSqlSafety(where);
      const levelCondition = level > 0 ? `AND Node.${levelField}<=${level}` : "";

      sql = this._sql(`SELECT Node.${fieldList} FROM ${this.tableName} Node
        WHERE {__TREE_ID__} Node.${leftValueField} > 0
          AND Node.${rightValueField} > 0
          ${levelCondition}
          ${binFilter}
          AND ${validatedWhere}
          AND NOT EXISTS (
              SELECT 1 FROM ${this.tableName} Ancestor
              WHERE {__TREE_ID__} Ancestor.${leftValueField} < Node.${leftValueField}
                AND Ancestor.${rightValueField} > Node.${rightValueField}
                AND NOT (${validatedWhere})
          )
        ORDER BY Node.${leftValueField}`);
    } else {
      // 原有的简单查询（保持向后兼容）
      sql = this._sql(`SELECT ${fieldList} FROM ${this.tableName}
            WHERE {__TREE_ID__} ${leftValueField}>0
              AND ${rightValueField}>0
              ${level > 0 ? `AND ${levelField}<=${level}` : ""}
              ${await this._buildBinFilter(!!options?.includeRecyclebin)}
            ORDER BY ${leftValueField}
        `);
    }

    return await this.getRows(sql);
  }

  /**
   * 根据id获取节点
   *
   * 启用回收站时默认过滤：bin 及其后代按 id 查找抛 NotFound（Logical Invisibility），
   * includeRecyclebin=true 时照常返回
   * @param nodeId
   * @param options.includeRecyclebin 默认 false
   */
  async getNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId,
    options?: { includeRecyclebin?: boolean },
  ): Promise<TreeNode | undefined> {
    const idField = this.escaper.escapeId(this.keyFields.id);
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin);
    const sql = this._sql(`SELECT * FROM ${this.tableName}
            WHERE {__TREE_ID__} (${idField}=${this.escaper.escape(nodeId as any)})${binFilter}`);
    const result = await this.getRows(sql);
    if (result.length === 0) {
      throw new FlexTreeNodeNotFoundError();
    }
    return result[0] as TreeNode;
  }

  /**
   * 获取第几个子节点
   *
   * getChildNode(nodeId,1)  //获取第一个子节点
   * getChildNode(nodeId,-1) //获取最后一个子节点
   * getChildNode(nodeId,3)  //获取第三个子节点
   *
   * @param this
   * @param node
   */
  async getNthChild(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    node: NodeId | TreeNode,
    index: number = 1,
    options?: { includeRecyclebin?: boolean },
  ): Promise<TreeNode | undefined> {
    const relNodeId = this.escaper.escape(
      isLikeNode(node, this.keyFields) ? (node as any)[this.keyFields.id] : node,
    );

    // 数据库端回收站过滤（bin 及其后代不计入序号）
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin, "Node.");

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }
    const sql = `SELECT Node.* FROM ${this.tableName}  Node
            JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
            WHERE ${treeCondition}
                (
                    Node.${leftValueField} > RelNode.${leftValueField}
                    AND Node.${rightValueField} < RelNode.${rightValueField}
                    AND Node.${levelField} = RelNode.${levelField} + 1
                )${binFilter}
            ORDER BY Node.${leftValueField} ${index < 0 ? "DESC" : ""}
            LIMIT 1 OFFSET ${Math.abs(index) - 1}
        `;
    const result = await this.getRows(sql);
    return result.length > 0 ? (result[0] as TreeNode) : undefined;
  }

  /**
   *
   * 获取指定节点的所有后代
   *
   * @param nodeId                              节点ID或节点数据对象,如果nodeId=undefined,则返回所有节点,相当于getNodes()
   * @param {object} options                    选项
   * @param {number}  [options.level]           限制返回的级别
   * @param {boolean} [options.includeSelf]     返回结果是否包括自身
   * @param {boolean} [options.includeRecyclebin] 默认 false：回收站（bin 及其后代）在数据库端被排除
   */
  async getDescendants(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId?: NodeId | TreeNode,
    options?: { level?: number; includeSelf?: boolean; includeRecyclebin?: boolean },
  ): Promise<IFlexTreeNodeFields<Fields, KeyFields>[]> {
    if (isNull(nodeId)) {
      return await this.getNodes(options);
    }
    const { level, includeSelf } = Object.assign({ includeSelf: false, level: 0 }, options);
    const relNode = await this.getNodeData(nodeId);
    const relNodeId = this.escaper.escape(relNode[this.keyFields.id]);

    // 数据库端回收站过滤
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin, "Node.");

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }
    let sql: string = "";
    if (level === 0) {
      // 不限定层级
      sql = `SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
                WHERE
                  ${treeCondition}
                  ((Node.${leftValueField} > RelNode.${leftValueField}
                  AND Node.${rightValueField} < RelNode.${rightValueField})
                  ${includeSelf ? `OR Node.${idField} = ${relNodeId}` : ""})${binFilter}
                ORDER BY ${leftValueField}
                `;
    } else {
      // 限定层级
      sql = `SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
                WHERE
                ${treeCondition}
                ((Node.${leftValueField} > RelNode.${leftValueField}
                AND Node.${rightValueField} < RelNode.${rightValueField}
                AND Node.${levelField} > RelNode.${levelField}
                AND Node.${levelField} <= RelNode.${levelField}+${level})
                ${includeSelf ? `OR Node.${idField} = ${relNodeId}` : ""})${binFilter}
                ORDER BY ${leftValueField}
            `;
    }
    // 得到的平面形式的节点列表
    return await this.getRows(sql);
  }

  /**
   * 获取后代节点数量
   */
  async getDescendantCount(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: { level?: number; includeRecyclebin?: boolean },
  ) {
    const { level } = Object.assign({ level: 0 }, options);
    const relNode = await this.getNodeData(nodeId);
    const relNodeId = this.escaper.escape(relNode[this.keyFields.id]);
    const relNodeLevel = relNode[this.keyFields.level];

    // 数据库端回收站过滤
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin, "Node.");

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }

    const sql = `SELECT COUNT(*) FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
            WHERE ${treeCondition}
                (
                    Node.${leftValueField} > RelNode.${leftValueField}
                    AND Node.${rightValueField} < RelNode.${rightValueField}
                ) ${level > 0 ? `AND Node.${levelField} <= ${relNodeLevel + level} ` : ""}${binFilter}`;
    return await this.getScalar(sql);
  }

  /**
   * 获取子节点集合
   *
   * @param nodeId  节点ID或节点数据
   * @param options.includeRecyclebin 默认 false：回收站内容在数据库端被排除
   * @returns  返回子节点集合,不包括后代节点
   */
  async getChildren(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: { includeRecyclebin?: boolean },
  ) {
    return await this.getDescendants(nodeId, {
      level: 1,
      includeRecyclebin: options?.includeRecyclebin,
    });
  }

  /**
   * 获取所有祖先节点,包括父节点
   * @param nodeId
   * @param {object} options
   * @param {boolean} [options.includeSelf] 是否包括自身
   *
   */
  async getAncestors(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: { includeSelf?: boolean },
  ) {
    const { includeSelf } = Object.assign({ includeSelf: false }, options);

    const relNode = await this.getNodeData(nodeId);
    const relNodeId = this.escaper.escape(relNode[this.keyFields.id]);

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }

    const sql = `SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
            WHERE ${treeCondition}
            (
                (
                    Node.${leftValueField} < RelNode.${leftValueField}
                    AND Node.${rightValueField} > RelNode.${rightValueField}
                )
                ${includeSelf ? `OR Node.${idField} = ${relNodeId}` : ""}
            )
            ORDER BY ${leftValueField}
        `;
    return await this.getRows(sql);
  }

  /**
   *  获取祖先节点数量(不包括自身)
   * @param nodeId
   * @returns {number}  返回祖先节点数量
   */
  async getAncestorsCount(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId,
  ) {
    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }
    const sql = `SELECT COUNT(*) FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${this.escaper.escape(nodeId)}
            WHERE ${treeCondition}
                (
                    Node.${leftValueField} < RelNode.${leftValueField}
                    AND Node.${rightValueField} > RelNode.${rightValueField}
                )
        `;
    return await this.getScalar(sql);
  }

  /**
   * 获取父节点
   * @param nodeId
   * @returns
   */
  async getParent(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
  ): Promise<TreeNode> {
    const relNode = await this.getNodeData(nodeId);
    const relNodeId = this.escaper.escape(relNode[this.keyFields.id]);

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }
    const sql = `SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
            WHERE ${treeCondition}
            (
                Node.${leftValueField} < RelNode.${leftValueField}
                AND Node.${rightValueField} > RelNode.${rightValueField}
            )
            ORDER BY ${leftValueField} DESC LIMIT 1
        `;
    const result = await this.getRows(sql);
    if (result.length === 0) {
      throw new FlexTreeNodeNotFoundError();
    }
    return result[0] as TreeNode;
  }

  /**
     * 获取所有兄弟节点
     *
     * SELECT Node.* FROM user Node
        JOIN (
        SELECT Node.* FROM user Node
        JOIN user RelNode ON RelNode.id = 'd'
        WHERE (Node.tree_left < RelNode.tree_left
        AND Node.tree_right > RelNode.tree_right  )
        ORDER BY Node.tree_left DESC LIMIT 1
        ) ParentNode
        WHERE
            (
                Node.tree_left > ParentNode.tree_left
                AND Node.tree_right < ParentNode.tree_right
                AND Node.tree_level =  ParentNode.tree_level +1
            )
        ORDER BY Node.tree_left

     * @param node
     * @param options.includeRecyclebin 默认 false：bin 及其后代（作为兄弟时）在数据库端被排除
     */
  async getSiblings(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: { includeSelf?: boolean; includeRecyclebin?: boolean },
  ) {
    const { includeSelf } = Object.assign({ includeSelf: false }, options);
    const relNode = await this.getNodeData(nodeId);
    const relNodeId = this.escaper.escape(relNode[this.keyFields.id]);

    // 数据库端回收站过滤
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin, "Node.");

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }
    const sql = `SELECT Node.* FROM ${this.tableName} Node
            JOIN (
                SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
                WHERE
                    (Node.${leftValueField} < RelNode.${leftValueField}
                    AND Node.${rightValueField} > RelNode.${rightValueField} )
                ORDER BY Node.${leftValueField} DESC LIMIT 1
            ) ParentNode
            WHERE ${treeCondition}
            (
                (
                    Node.${leftValueField} > ParentNode.${leftValueField}
                    AND Node.${rightValueField} < ParentNode.${rightValueField}
                    AND Node.${levelField} = ParentNode.${levelField}+1
                    ${includeSelf ? "" : `AND Node.${idField} != ${relNodeId}`}
                )
            )${binFilter}
            ORDER BY ${leftValueField}
        `;
    return await this.getRows(sql);
  }

  /**
   * 获取下一个兄弟节点
   *
   *    下一节点应满足：同一级别，同一棵树,Left要大于node.tree_left,且具有同一个
   *
   *    SELECT Node.* FROM user Node
   *     JOIN user RelNode ON RelNode.id = 'g'
   *     WHERE
   *         (Node.tree_left = RelNode.tree_right+1
   *     AND Node.tree_id=0
   *     ) LIMIT 1
   *
   * 启用回收站时默认跳过 bin 及其后代（数据库端条件改写，非取回后跳过）：
   * 下一个兄弟 = 同层且 leftValue 越过当前子树右值的第一个**逻辑存在**节点
   *
   * @param options.includeRecyclebin 默认 false
   */
  async getNextSibling(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: { includeRecyclebin?: boolean },
  ) {
    const relNode = await this.getNodeData(nodeId);
    const relNodeId = this.escaper.escape(relNode[this.keyFields.id]);

    // 数据库端回收站过滤
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin, "Node.");

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);
    const levelField = this.escaper.escapeId(this.keyFields.level);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }

    const sql = `SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
            WHERE ${treeCondition}
                (
                    Node.${leftValueField} = RelNode.${rightValueField}+1
                    AND Node.${levelField} = RelNode.${levelField}
                )${binFilter}
            ORDER BY Node.${leftValueField}
            LIMIT 1`;
    return await this.getOneNode(sql);
  }

  /**
   * 获取上一个兄弟节点
   * @param nodeId
   * @param options.includeRecyclebin 默认 false：默认视角下跳过 bin 及其后代（数据库端过滤）
   */
  async getPreviousSibling(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: { includeRecyclebin?: boolean },
  ) {
    const relNode = await this.getNodeData(nodeId);
    const relNodeId = this.escaper.escape(relNode[this.keyFields.id]);

    // 数据库端回收站过滤
    const binFilter = await this._buildBinFilter(!!options?.includeRecyclebin, "Node.");

    // 预计算转义后的字段名以提高性能和代码可读性
    const idField = this.escaper.escapeId(this.keyFields.id);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    let treeCondition = "";
    if (this.treeId) {
      treeCondition = `Node.${this.escaper.escapeId(this.keyFields.treeId)}=${this.escaper.escape(this.treeId)} AND`;
    }

    const sql = `SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${idField} = ${relNodeId}
            WHERE ${treeCondition}
                (
                    Node.${rightValueField} = RelNode.${leftValueField}-1
                )${binFilter}
            ORDER BY Node.${leftValueField} DESC
            LIMIT 1`;
    return await this.getOneNode(sql);
  }

  /**
   * 获取根节点
   *
   * 一棵树仅有一个根节点,所以只需要获取leftValue=1的节点即可
   *
   */
  async getRoot(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>) {
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const sql = this._sql(`SELECT * FROM ${this.tableName}
                        WHERE {__TREE_ID__} ${leftValueField}=1`);
    return (await this.getOneNode(sql))!;
  }
}
