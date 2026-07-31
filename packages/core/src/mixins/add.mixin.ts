import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
  FlexTreeNodeInput,
} from "../types";
import { FlexNodeRelPosition } from "../types";
import { FlexTreeError } from "../errors";
import { forEachNestTree } from "../utils/forEachNestTree";

export class AddNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 检测节点数组是否包含嵌套结构
   * @param nodes 节点数组
   * @param childrenField 可选的自定义子节点字段名
   * @returns 是否为嵌套结构
   */
  private detectNestedStructure(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: Partial<TreeNode>[] | FlexTreeNodeInput<Fields, KeyFields>[],
    childrenField?: string,
  ): boolean {
    if (nodes.length === 0) return false;

    // 检查所有节点，不只是第一个
    const field = childrenField || "children";
    for (const node of nodes) {
      if (field in (node as any) && Array.isArray((node as any)[field])) {
        return true;
      }
    }

    return false;
  }

  /**
   *
   * 将nodes添加到relNode的子节点集的最后面
   *
   * @param relNode
   * @param nodes
   * @param fields
   */
  protected _addLastChilds(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    relNode: TreeNode,
    nodes: Partial<TreeNode>[],
    fields: string[],
  ) {
    const isMultiTree = this.isMultiTree;
    const treeIdField = this.keyFields.treeId;
    const treeIdValue = this.treeId;

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    const values = nodes
      .map((node, i) => {
        const row = [
          relNode[this.keyFields.level] + 1,
          relNode[this.keyFields.rightValue] + i * 2,
          relNode[this.keyFields.rightValue] + i * 2 + 1,
        ];
        for (let i = 3; i < fields.length; i++) {
          const fieldName = fields[i];
          // 如果是多树表且当前字段是treeId，使用manager的treeId值
          if (isMultiTree && fieldName === treeIdField) {
            row.push(this.escaper.escape(treeIdValue));
          } else {
            row.push(this.escaper.escape(node[fieldName]));
          }
        }
        return `(${row.join(",")})`;
      })
      .join(",");
    return [
      this._sql(`
                UPDATE ${this.tableName} SET ${leftValueField} = ${leftValueField} + ${nodes.length * 2}
                WHERE {__TREE_ID__} ${leftValueField} >= ${relNode[this.keyFields.rightValue]}
            `),
      this._sql(`
                UPDATE ${this.tableName} SET ${rightValueField} = ${rightValueField} + ${nodes.length * 2}
                WHERE {__TREE_ID__} ${rightValueField} >= ${relNode[this.keyFields.rightValue]}
            `),
      this._sql(`
                INSERT INTO ${this.tableName} ( ${fields.map((f) => this.escaper.escapeId(f)).join(",")})
                VALUES ${values}
            `),
    ];
  }

  /**
   *
   * 将nodes添加到relNode的子节点集的最前面
   *
   */
  protected _addFirstChilds(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    relNode: TreeNode,
    nodes: Partial<TreeNode>[],
    fields: string[],
  ) {
    const isMultiTree = this.isMultiTree;
    const treeIdField = this.keyFields.treeId;
    const treeIdValue = this.treeId;

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    const values = nodes
      .map((node, i) => {
        const row = [
          relNode[this.keyFields.level] + 1,
          relNode[this.keyFields.leftValue] + i * 2 + 1,
          relNode[this.keyFields.leftValue] + i * 2 + 2,
        ];
        for (let i = 3; i < fields.length; i++) {
          const fieldName = fields[i];
          // 如果是多树表且当前字段是treeId，使用manager的treeId值
          if (isMultiTree && fieldName === treeIdField) {
            row.push(this.escaper.escape(treeIdValue));
          } else {
            row.push(this.escaper.escape(node[fieldName]));
          }
        }
        return `(${row.join(",")})`;
      })
      .join(",");
    return [
      this._sql(`
                UPDATE ${this.tableName} SET ${leftValueField} = ${leftValueField} + ${nodes.length * 2}
                WHERE {__TREE_ID__} ${leftValueField} > ${relNode[this.keyFields.leftValue]}
            `),
      this._sql(`
                UPDATE ${this.tableName} SET ${rightValueField} = ${rightValueField} + ${nodes.length * 2}
                WHERE {__TREE_ID__} ${rightValueField} >= ${relNode[this.keyFields.leftValue] + 1}
            `),
      this._sql(`
                INSERT INTO ${this.tableName} ( ${fields.map((f) => this.escaper.escapeId(f)).join(",")})
                VALUES ${values}
            `),
    ];
  }

  protected _addNextSiblings(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    relNode: TreeNode,
    nodes: Partial<TreeNode>[],
    fields: string[],
  ) {
    const isMultiTree = this.isMultiTree;
    const treeIdField = this.keyFields.treeId;
    const treeIdValue = this.treeId;

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    const values = nodes
      .map((node, i) => {
        const row = [
          relNode[this.keyFields.level],
          relNode[this.keyFields.rightValue] + i * 2 + 1,
          relNode[this.keyFields.rightValue] + i * 2 + 2,
        ];
        for (let i = 3; i < fields.length; i++) {
          const fieldName = fields[i];
          // 如果是多树表且当前字段是treeId，使用manager的treeId值
          if (isMultiTree && fieldName === treeIdField) {
            row.push(this.escaper.escape(treeIdValue));
          } else {
            row.push(this.escaper.escape(node[fieldName]));
          }
        }
        return `(${row.join(",")})`;
      })
      .join(",");
    return [
      this._sql(`
                UPDATE ${this.tableName} SET ${leftValueField} = ${leftValueField} + ${nodes.length * 2}
                WHERE {__TREE_ID__} ${leftValueField} > ${relNode[this.keyFields.rightValue]}
            `),
      this._sql(`
                UPDATE ${this.tableName} SET ${rightValueField} = ${rightValueField} + ${nodes.length * 2}
                WHERE {__TREE_ID__} ${rightValueField} > ${relNode[this.keyFields.rightValue]}
            `),
      this._sql(`
                INSERT INTO ${this.tableName} ( ${fields.map((f) => this.escaper.escapeId(f)).join(",")})
                VALUES ${values}
            `),
    ];
  }

  protected _addPreviousSiblings(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    relNode: TreeNode,
    nodes: Partial<TreeNode>[],
    fields: string[],
  ) {
    const isMultiTree = this.isMultiTree;
    const treeIdField = this.keyFields.treeId;
    const treeIdValue = this.treeId;

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    const values = nodes
      .map((node, i) => {
        const row = [
          relNode[this.keyFields.level],
          relNode[this.keyFields.leftValue] + i * 2,
          relNode[this.keyFields.leftValue] + i * 2 + 1,
        ];
        for (let i = 3; i < fields.length; i++) {
          const fieldName = fields[i];
          // 如果是多树表且当前字段是treeId，使用manager的treeId值
          if (isMultiTree && fieldName === treeIdField) {
            row.push(this.escaper.escape(treeIdValue));
          } else {
            row.push(this.escaper.escape(node[fieldName]));
          }
        }
        return `(${row.join(",")})`;
      })
      .join(",");
    return [
      this._sql(`
                UPDATE ${this.tableName} SET ${leftValueField} = ${leftValueField} + ${nodes.length * 2}
                WHERE {__TREE_ID__} ${leftValueField} >= ${relNode[this.keyFields.leftValue]}
            `),
      this._sql(`
                UPDATE ${this.tableName} SET ${rightValueField} = ${rightValueField} + ${nodes.length * 2}
                WHERE {__TREE_ID__} ${rightValueField} > ${relNode[this.keyFields.leftValue]}
            `),
      this._sql(`
                INSERT INTO ${this.tableName} ( ${fields.map((f) => this.escaper.escapeId(f)).join(",")})
                VALUES ${values}
            `),
    ];
  }

  /**
   *
   * 增加多个节点
   *
   * 新API（推荐使用）：
   * addNodes([
   *  {...},
   *  {...}
   * ], {at: 'nodeId', pos: FlexNodeRelPosition.LastChild, childrenField: 'children'})
   *
   * 旧API（向后兼容）：
   * addNodes([
   *  {...},
   *  {...}
   * ], 'nodeId', FlexNodeRelPosition.LastChild)
   *
   *
   * 1. 批量插入时，需要保证节点数据的字段名称是一样的，比如
   *    addNode([{id:1,name:'test'},{id:2,xname:'test2'}])  // ❌错误
   * 2. 所有关键字段中(id,name,treeId,leftValue,rightValue,level)中，
   *      leftValue,rightValue,level是自动计算的，不需要手动输入
   *      id字段则取决于数据库表设计，如果是自增则不必设置，否则需要
   *      treeId则是在
   *
   *
   * ，id是自增的，则可以不必指定，是可选的
   * 3. 如果是单树表，可以不必指定treeId,如果是多树表，则必须指定
   * 4. 支持嵌套节点结构，使用children字段（可自定义）表示子节点数组
   *
   * @param nodes 要添加的节点数组
   * @param optionsOrAt 新API的options对象或旧API的atNode参数
   * @param pos 旧API的位置参数（仅在使用旧API时有效）
   *
   */
  // 新API：使用options对象（推荐）
  async addNodes(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: Partial<TreeNode>[] | FlexTreeNodeInput<Fields, KeyFields>[],
    options?: {
      at?: NodeId | TreeNode | null;
      pos?: FlexNodeRelPosition;
      childrenField?: string;
    },
  ): Promise<void>;

  // 旧API：直接参数（向后兼容）
  async addNodes(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: Partial<TreeNode>[],
    atNode?: NodeId | TreeNode | null,
    pos?: FlexNodeRelPosition,
  ): Promise<void>;

  // 统一实现方法
  async addNodes(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: Partial<TreeNode>[] | FlexTreeNodeInput<Fields, KeyFields>[],
    optionsOrAt?: any,
    pos?: FlexNodeRelPosition,
  ): Promise<void> {
    this._assertWriteable();

    if (nodes.length === 0) {
      return;
    }

    // 参数解析：支持新的options对象模式和旧的直接参数模式
    let atNode: NodeId | TreeNode | null | undefined;
    let actualPos: FlexNodeRelPosition = FlexNodeRelPosition.LastChild;
    let childrenField: string | undefined;

    // 判断使用哪种调用方式
    if (typeof optionsOrAt === "object" && optionsOrAt !== null) {
      // 新的options对象模式
      atNode = optionsOrAt.at;
      actualPos = optionsOrAt.pos ?? FlexNodeRelPosition.LastChild;
      childrenField = optionsOrAt.childrenField;
    } else {
      // 旧的直接参数模式（向后兼容）
      atNode = optionsOrAt;
      actualPos = pos ?? FlexNodeRelPosition.LastChild;
    }

    // 获取目标节点信息
    const relNode = await this.getNodeData(atNode);

    if (this.isRoot(relNode!)) {
      if (
        actualPos === FlexNodeRelPosition.NextSibling ||
        actualPos === FlexNodeRelPosition.PreviousSibling
      ) {
        throw new FlexTreeError("Root node can not have next and previous sibling node");
      }
    }

    // 检测是否为嵌套结构
    const isNested = this.detectNestedStructure(nodes, childrenField);

    if (isNested) {
      return this.addNodesNested(
        nodes as FlexTreeNodeInput<Fields, KeyFields>[],
        relNode,
        actualPos,
        childrenField,
      );
    } else {
      return this.addNodesFlat(nodes as Partial<TreeNode>[], relNode, actualPos);
    }
  }

  /**
   * 扁平化节点添加（原有逻辑）
   */
  private async addNodesFlat(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: Partial<TreeNode>[],
    relNode: TreeNode,
    pos: FlexNodeRelPosition,
  ) {
    // 处理节点数据:   单树表不需要增加treeId字段
    const fields: string[] = [
      this.keyFields.level,
      this.keyFields.leftValue,
      this.keyFields.rightValue,
    ];
    if (this.isMultiTree) {
      fields.push(this.keyFields.treeId);
    }
    fields.push(...Object.keys(nodes[0]).filter((f) => !fields.includes(f))); // 添加其他字段

    let sqls: string[] = [];

    if (pos === FlexNodeRelPosition.LastChild) {
      sqls = this._addLastChilds(relNode, nodes, fields);
    } else if (pos === FlexNodeRelPosition.FirstChild) {
      sqls = this._addFirstChilds(relNode, nodes, fields);
    } else if (pos === FlexNodeRelPosition.NextSibling) {
      sqls = this._addNextSiblings(relNode, nodes, fields);
    } else if (pos === FlexNodeRelPosition.PreviousSibling) {
      sqls = this._addPreviousSiblings(relNode, nodes, fields);
    }
    await this.onExecuteWriteSql(sqls);
  }

  /**
   * 嵌套节点添加
   */
  private async addNodesNested(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: FlexTreeNodeInput<Fields, KeyFields>[],
    relNode: TreeNode,
    pos: FlexNodeRelPosition,
    childrenField?: string,
  ) {
    // 计算基础左值
    const baseLeftValue = this.calculateBaseLeftValue(relNode, pos);

    // 直接在嵌套结构上计算位置
    const positions = this.calculateNestedPositions(nodes, baseLeftValue, childrenField);

    // 构建字段列表
    const fields: string[] = [
      this.keyFields.level,
      this.keyFields.leftValue,
      this.keyFields.rightValue,
    ];

    if (this.isMultiTree) {
      fields.push(this.keyFields.treeId);
    }

    // 从第一个节点提取自定义字段（排除children字段）
    const customFields = Object.keys(nodes[0]).filter(
      (f) => !fields.includes(f) && f !== 'children' && f !== childrenField
    );
    fields.push(...customFields);

    // 生成SQL
    const sqls = this.generateNestedSql(nodes, positions, relNode, pos, fields, childrenField);

    await this.onExecuteWriteSql(sqls);
  }

  /**
   * 计算基础左值 - 根据相对位置确定起始位置
   */
  private calculateBaseLeftValue(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    relNode: TreeNode,
    pos: FlexNodeRelPosition,
  ): number {
    switch (pos) {
      case FlexNodeRelPosition.LastChild:
        return relNode[this.keyFields.rightValue];
      case FlexNodeRelPosition.FirstChild:
        return relNode[this.keyFields.leftValue];
      case FlexNodeRelPosition.NextSibling:
        return relNode[this.keyFields.rightValue];
      case FlexNodeRelPosition.PreviousSibling:
        return relNode[this.keyFields.leftValue];
      default:
        return relNode[this.keyFields.rightValue];
    }
  }

  /**
   * 计算嵌套节点位置 - 使用 forEachNestTree 简化实现
   * 利用 forEachNestTree 的双次调用机制（进入/退出节点）来分配左右值
   */
  private calculateNestedPositions(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: FlexTreeNodeInput<Fields, KeyFields>[],
    baseLeftValue: number,
    childrenField?: string,
  ): Map<FlexTreeNodeInput<Fields, KeyFields>, { left: number; right: number }> {
    const positions = new Map<FlexTreeNodeInput<Fields, KeyFields>, { left: number; right: number }>();
    let counter = baseLeftValue;

    // forEachNestTree 的双次调用机制完美匹配 Nested Set Model：
    // - 第一次调用（进入节点）: 设置左值
    // - 第二次调用（退出节点）: 设置右值
    forEachNestTree(nodes, (node: any, level: number) => {
      if (!node.leftValue) {
        // 第一次访问（进入节点） - 设置左值
        node.leftValue = counter++;
      } else {
        // 第二次访问（退出节点） - 设置右值
        node.rightValue = counter++;
      }
      // 存储位置映射
      positions.set(node, { left: node.leftValue, right: node.rightValue });
    }, { childrenKey: childrenField || 'children' });

    return positions;
  }

  /**
   * 生成嵌套节点SQL
   */
  private generateNestedSql(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: FlexTreeNodeInput<Fields, KeyFields>[],
    positions: Map<FlexTreeNodeInput<Fields, KeyFields>, { left: number; right: number }>,
    relNode: TreeNode,
    pos: FlexNodeRelPosition,
    fields: string[],
    childrenField?: string,
  ): string[] {
    const isMultiTree = this.isMultiTree;
    const treeIdField = this.keyFields.treeId;
    const treeIdValue = this.treeId;

    // 使用 forEachNestTree 处理节点并生成 SQL 值
    const values: string[] = [];

    forEachNestTree(nodes, (node: any, level: number) => {
      // 仅在第一次访问时处理（进入节点）
      if (node.leftValue && !node._processed) {
        node._processed = true;

        const nodePos = positions.get(node);
        if (!nodePos) {
          throw new Error(`Missing position for node ${node.name || "unknown"}`);
        }

        const row = [level, nodePos.left, nodePos.right] as any[];

        // 添加其他字段
        for (let i = 3; i < fields.length; i++) {
          const fieldName = fields[i];
          if (isMultiTree && fieldName === treeIdField) {
            row.push(this.escaper.escape(treeIdValue));
          } else {
            row.push(this.escaper.escape(node[fieldName]));
          }
        }

        values.push(`(${row.join(",")})`);
      }
    }, { childrenKey: childrenField || 'children' });

    // 清理临时属性
    Object.keys(nodes).forEach((key) => {
      if (key === '_processed') {
        delete (nodes as any)[key];
      }
    });

    // 生成SQL语句
    const totalNodes = values.length;
    const baseLeftValue = this.calculateBaseLeftValue(relNode, pos);
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    let updateConditions: string[];

    switch (pos) {
      case FlexNodeRelPosition.LastChild:
        updateConditions = [
          `WHERE {__TREE_ID__} ${leftValueField} >= ${baseLeftValue}`,
          `WHERE {__TREE_ID__} ${rightValueField} >= ${baseLeftValue}`,
        ];
        break;
      case FlexNodeRelPosition.FirstChild:
        updateConditions = [
          `WHERE {__TREE_ID__} ${leftValueField} > ${baseLeftValue}`,
          `WHERE {__TREE_ID__} ${rightValueField} > ${baseLeftValue}`,
        ];
        break;
      case FlexNodeRelPosition.NextSibling:
        updateConditions = [
          `WHERE {__TREE_ID__} ${leftValueField} > ${baseLeftValue}`,
          `WHERE {__TREE_ID__} ${rightValueField} > ${baseLeftValue}`,
        ];
        break;
      case FlexNodeRelPosition.PreviousSibling:
        updateConditions = [
          `WHERE {__TREE_ID__} ${leftValueField} >= ${baseLeftValue}`,
          `WHERE {__TREE_ID__} ${rightValueField} >= ${baseLeftValue}`,
        ];
        break;
      default:
        updateConditions = [
          `WHERE {__TREE_ID__} ${leftValueField} >= ${baseLeftValue}`,
          `WHERE {__TREE_ID__} ${rightValueField} >= ${baseLeftValue}`,
        ];
    }

    return [
      this._sql(`
        UPDATE ${this.tableName} SET ${leftValueField} = ${leftValueField} + ${totalNodes * 2}
        ${updateConditions[0]}
      `),
      this._sql(`
        UPDATE ${this.tableName} SET ${rightValueField} = ${rightValueField} + ${totalNodes * 2}
        ${updateConditions[1]}
      `),
      this._sql(`
        INSERT INTO ${this.tableName} (${fields.map((f) => this.escaper.escapeId(f)).join(",")})
        VALUES ${values.join(",")}
      `),
    ];
  }
}
