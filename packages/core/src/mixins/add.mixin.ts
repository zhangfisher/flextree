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

// 内部处理用的扁平化节点结构
interface FlattenedNode<Fields, KeyFields> {
  node: Partial<IFlexTreeNodeFields<any, KeyFields>>; // 已排除children字段
  level: number;
  parentIndex?: number; // 在扁平化数组中的父节点索引
  originalIndex: number; // 在原始嵌套结构中的位置
}

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
   * 将嵌套节点结构扁平化
   * @param nodes 嵌套节点数组
   * @param baseLevel 基础层级
   * @param childrenField 可选的自定义子节点字段名
   * @returns 扁平化的节点数组
   */
  private flattenNestedNodes(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodes: FlexTreeNodeInput<Fields, KeyFields>[],
    baseLevel: number,
    childrenField?: string,
  ): FlattenedNode<Fields, KeyFields>[] {
    const flattened: FlattenedNode<Fields, KeyFields>[] = [];
    const childField = childrenField || "children";

    const traverse = (
      nodeInputs: FlexTreeNodeInput<Fields, KeyFields>[],
      level: number,
      parentIndex?: number,
    ) => {
      nodeInputs.forEach((nodeInput, index) => {
        const nodeData = { ...nodeInput };
        delete (nodeData as any)[childField]; // 移除子节点字段

        const currentIndex = flattened.length;
        const flattenedNode: FlattenedNode<Fields, KeyFields> = {
          node: nodeData,
          level,
          parentIndex,
          originalIndex: currentIndex,
        };

        flattened.push(flattenedNode);

        // 递归处理子节点，使用当前节点索引作为父索引
        const children = (nodeInput as any)[childField];
        if (children && children.length > 0) {
          traverse(children, level + 1, currentIndex);
        }
      });
    };

    traverse(nodes, baseLevel);
    return flattened;
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
    // 获取参考节点的层级
    const baseLevel = relNode[this.keyFields.level] + 1;

    // 扁平化嵌套结构
    const flattened = this.flattenNestedNodes(nodes, baseLevel, childrenField);

    // 构建字段列表
    const fields: string[] = [
      this.keyFields.level,
      this.keyFields.leftValue,
      this.keyFields.rightValue,
    ];

    if (this.isMultiTree) {
      fields.push(this.keyFields.treeId);
    }

    // 从第一个节点提取自定义字段
    const customFields = Object.keys(flattened[0].node).filter((f) => !fields.includes(f));
    fields.push(...customFields);

    // 计算位置并生成SQL
    const sqls = this.generateNestedSql(flattened, relNode, pos, fields);

    await this.onExecuteWriteSql(sqls);
  }

  /**
   * 计算嵌套节点位置 - 使用深度优先分配
   */
  private calculateNestedPositions(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    flattened: FlattenedNode<Fields, KeyFields>[],
    baseLeftValue: number,
  ): Map<number, { left: number; right: number }> {
    const positions = new Map<number, { left: number; right: number }>();

    // 构建父子关系映射
    const parentToChildren = new Map<number, number[]>();
    const childToParent = new Map<number, number>();

    flattened.forEach((node, index) => {
      if (node.parentIndex !== undefined) {
        if (!parentToChildren.has(node.parentIndex)) {
          parentToChildren.set(node.parentIndex, []);
        }
        parentToChildren.get(node.parentIndex)!.push(index);
        childToParent.set(index, node.parentIndex);
      }
    });

    let currentValue = baseLeftValue;

    // 按原始索引顺序遍历节点，使用深度优先分配位置
    const assignPosition = (nodeIndex: number): { left: number; right: number } => {
      if (positions.has(nodeIndex)) {
        return positions.get(nodeIndex)!;
      }

      const node = flattened[nodeIndex];
      const children = parentToChildren.get(nodeIndex) || [];

      if (children.length === 0) {
        // 叶子节点
        const pos = { left: currentValue, right: currentValue + 1 };
        currentValue += 2;
        positions.set(nodeIndex, pos);
        return pos;
      } else {
        // 非叶子节点，先为子节点分配位置
        const leftBoundary = currentValue;
        currentValue += 1; // 跳过父节点的左边界

        children.forEach((childIndex) => {
          assignPosition(childIndex);
        });

        const rightBoundary = currentValue;
        currentValue += 1; // 跳过父节点的右边界

        const pos = { left: leftBoundary, right: rightBoundary };
        positions.set(nodeIndex, pos);
        return pos;
      }
    };

    // 处理所有根节点（没有父节点的节点）
    flattened.forEach((node, index) => {
      if (!childToParent.has(index)) {
        assignPosition(index);
      }
    });

    return positions;
  }

  /**
   * 生成嵌套节点SQL
   */
  private generateNestedSql(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    flattened: FlattenedNode<Fields, KeyFields>[],
    relNode: TreeNode,
    pos: FlexNodeRelPosition,
    fields: string[],
  ): string[] {
    // 根据不同位置计算基础值
    let baseLeftValue: number;

    switch (pos) {
      case FlexNodeRelPosition.LastChild:
        baseLeftValue = relNode[this.keyFields.rightValue];
        break;
      case FlexNodeRelPosition.FirstChild:
        baseLeftValue = relNode[this.keyFields.leftValue];
        break;
      case FlexNodeRelPosition.NextSibling:
        baseLeftValue = relNode[this.keyFields.rightValue];
        break;
      case FlexNodeRelPosition.PreviousSibling:
        baseLeftValue = relNode[this.keyFields.leftValue];
        break;
      default:
        baseLeftValue = relNode[this.keyFields.rightValue];
    }

    // 计算所有节点的位置
    const positions = this.calculateNestedPositions(flattened, baseLeftValue);

    // 验证位置计算
    if (positions.size !== flattened.length) {
      const missing = flattened.filter((n) => !positions.has(n.originalIndex));
      throw new Error(
        `Position calculation failed: ${positions.size} positions for ${flattened.length} nodes. Missing: ${missing.map((n) => n.node.name).join(", ")}`,
      );
    }

    // 生成批量插入值
    const isMultiTree = this.isMultiTree;
    const treeIdField = this.keyFields.treeId;
    const treeIdValue = this.treeId;

    if (flattened.length !== positions.size) {
      const missing = flattened.filter((n) => !positions.has(n.originalIndex));
      throw new Error(
        `Position calculation failed: ${positions.size} positions for ${flattened.length} nodes. Missing: ${missing.map((n) => n.node.name).join(", ")}`,
      );
    }

    const values = flattened
      .map((flatNode) => {
        const nodePos = positions.get(flatNode.originalIndex);
        if (!nodePos) {
          const errorMsg = `Missing position for node ${flatNode.node.name || "unknown"} at index ${flatNode.originalIndex}`;
          const availableInfo = Array.from(positions.entries())
            .map(([idx, pos]) => {
              const node = flattened[idx];
              return `Index ${idx} (${node.node.name}): left=${pos.left}, right=${pos.right}`;
            })
            .join(", ");
          throw new Error(`${errorMsg}. Available: ${availableInfo}`);
        }

        const row = [flatNode.level, nodePos.left, nodePos.right] as any[];

        // 添加其他字段
        for (let i = 3; i < fields.length; i++) {
          const fieldName = fields[i];
          if (isMultiTree && fieldName === treeIdField) {
            row.push(this.escaper.escape(treeIdValue));
          } else {
            row.push(this.escaper.escape(flatNode.node[fieldName]));
          }
        }

        return `(${row.join(",")})`;
      })
      .join(",");

    // 生成SQL语句
    const totalNodes = flattened.length;
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
        VALUES ${values}
      `),
    ];
  }
}
