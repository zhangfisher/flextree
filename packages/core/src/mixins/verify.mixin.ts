import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexTreeVerifyError } from "../errors";

export class VerifyTreeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 校验树的完整性，即树的左右值是否正确
   * 使用纯SQL验证，无需加载所有节点到内存
   *
   * 简化方案：基于 Nested Set Model 数学原理，只需检查3个核心条件：
   * 1. 节点总数正确：COUNT(*) = root.rightValue / 2
   * 2. 值完整性：所有 leftValue 和 rightValue 的并集恰好是 {1, 2, ..., 2n}
   * 3. 基本关系：rightValue > leftValue
   *
   * 如果满足这3个条件，其他性质（奇偶性、父子关系、树结构）自动满足
   */
  async verify(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<boolean> {
    await this.checkNodeCount();
    await this.checkValueIntegrity();
    await this.checkBasicRelation();
    await this.checkUniqueness();
    await this.checkLevelRelation();

    return true;
  }

  /**
   * 检查1: 节点总数检查
   * 根节点的 rightValue / 2 应该等于节点总数
   */
  private async checkNodeCount(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    const sql = this._sql(`
        SELECT
            root.${this.keyFields.rightValue} / 2 as expected_count,
            (SELECT COUNT(*) FROM ${this.tableName} WHERE {__TREE_ID__}${this.keyFields.leftValue} > root.${this.keyFields.leftValue} AND ${this.keyFields.rightValue} < root.${this.keyFields.rightValue}) + 1 as actual_count
        FROM ${this.tableName} root
        WHERE {__TREE_ID__}root.${this.keyFields.leftValue} = 1
        LIMIT 1
    `);

    const result = await this.adapter.getRows(sql);

    if (result.length === 0) {
      return;
    }

    const row = result[0];
    const expectedCount = row.expected_count;
    const actualCount = row.actual_count;

    if (expectedCount !== actualCount) {
      throw new FlexTreeVerifyError(
        `节点总数不匹配：根据根节点计算应为 ${expectedCount}，实际为 ${actualCount}`,
      );
    }
  }

  /**
   * 检查2: 值完整性检查（核心检查）
   * 检查从 1 到 MAX(rightValue) 的每个整数是否都被恰好使用一次
   *
   * 这是 Nested Set Model 的核心约束：所有 leftValue 和 rightValue 的并集必须是连续的整数集合
   */
  private async checkValueIntegrity(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    const treeIdFilter = this.treeId
      ? `AND ${this.keyFields.treeId} = ${this.escaper.escape(this.treeId)}`
      : "";

    const sql = `
        WITH RECURSIVE numbers(n) AS (
            SELECT 1
            UNION ALL
            SELECT n + 1 FROM numbers
            WHERE n < (SELECT MAX(${this.keyFields.rightValue}) FROM ${this.tableName} WHERE 1=1 ${treeIdFilter})
        ),
        used_values AS (
            SELECT ${this.keyFields.leftValue} as value FROM ${this.tableName} WHERE 1=1 ${treeIdFilter}
            UNION
            SELECT ${this.keyFields.rightValue} FROM ${this.tableName} WHERE 1=1 ${treeIdFilter}
        )
        SELECT
            n as missing_number
        FROM numbers
        LEFT JOIN used_values u ON n = u.value
        WHERE u.value IS NULL
        LIMIT 1
    `;

    const missing = await this.adapter.getRows(sql);

    if (missing.length > 0) {
      const missingNum = missing[0].missing_number;

      if (missingNum === 1) {
        return;
      }

      throw new FlexTreeVerifyError(
        `值完整性检查失败：整数 ${missingNum} 缺失（不是任何节点的 leftValue 或 rightValue）`,
      );
    }
  }

  /**
   * 检查3: 基本关系 - 右值必须大于左值
   */
  private async checkBasicRelation(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    const sql = this._sql(`
            SELECT
                ${this.keyFields.id},
                ${this.keyFields.name},
                ${this.keyFields.leftValue},
                ${this.keyFields.rightValue}
            FROM ${this.tableName}
            WHERE {__TREE_ID__}${this.keyFields.rightValue} <= ${this.keyFields.leftValue}
            LIMIT 1
        `);

    const invalidNodes = await this.adapter.getRows(sql);

    if (invalidNodes.length > 0) {
      const node = invalidNodes[0];
      throw new FlexTreeVerifyError(
        `节点 ${node[this.keyFields.name]}(${node[this.keyFields.id]}) 的右值(${node[this.keyFields.rightValue]})不大于左值(${node[this.keyFields.leftValue]})`,
      );
    }
  }

  /**
   * 检查4: 左右值唯一性
   * 分别检查左值和右值的唯一性
   */
  private async checkUniqueness(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    const sqlLeft = this._sql(`
            SELECT
                ${this.keyFields.id},
                ${this.keyFields.name},
                ${this.keyFields.leftValue},
                COUNT(*) as duplicate_count
            FROM ${this.tableName}
            WHERE {__TREE_ID__} 1=1
            GROUP BY ${this.keyFields.leftValue}
            HAVING COUNT(*) > 1
            LIMIT 1
        `);

    const duplicatesLeft = await this.adapter.getRows(sqlLeft);

    if (duplicatesLeft.length > 0) {
      const dup = duplicatesLeft[0];
      throw new FlexTreeVerifyError(
        `左值 ${dup[this.keyFields.leftValue]} 重复出现 ${dup.duplicate_count} 次`,
      );
    }

    const sqlRight = this._sql(`
            SELECT
                ${this.keyFields.id},
                ${this.keyFields.name},
                ${this.keyFields.rightValue},
                COUNT(*) as duplicate_count
            FROM ${this.tableName}
            WHERE {__TREE_ID__} 1=1
            GROUP BY ${this.keyFields.rightValue}
            HAVING COUNT(*) > 1
            LIMIT 1
        `);

    const duplicatesRight = await this.adapter.getRows(sqlRight);

    if (duplicatesRight.length > 0) {
      const dup = duplicatesRight[0];
      throw new FlexTreeVerifyError(
        `右值 ${dup[this.keyFields.rightValue]} 重复出现 ${dup.duplicate_count} 次`,
      );
    }
  }

  /**
   * 检查5: Level 字段关系检查
   * 验证 level 字段与树的层级结构是否一致
   *
   * 两个子检查：
   * 1. 根节点的 level 必须等于 0（leftValue = 1 的节点）
   * 2. 父子节点的 level 差值必须等于 1
   */
  private async checkLevelRelation(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    // 子检查 1: 验证根节点的 level 是否为 0
    await this.checkRootLevel();

    // 子检查 2: 验证父子节点的 level 关系
    await this.checkParentChildLevel();
  }

  /**
   * 检查根节点的 level 是否为 0
   * 根节点定义为 leftValue = 1 的节点，其 level 必须为 0
   */
  private async checkRootLevel(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    const sql = this._sql(`
      SELECT
        ${this.keyFields.id},
        ${this.keyFields.name},
        ${this.keyFields.level}
      FROM ${this.tableName}
      WHERE {__TREE_ID__}${this.keyFields.leftValue} = 1 AND ${this.keyFields.level} <> 0
      LIMIT 1
    `);

    const invalidRoots = await this.adapter.getRows(sql);

    if (invalidRoots.length > 0) {
      const root = invalidRoots[0];
      throw new FlexTreeVerifyError(
        `节点 ${root[this.keyFields.name]}(${root[this.keyFields.id]}) 的左值为 1 但 level=${root[this.keyFields.level]}，根节点的 level 必须为 0`,
      );
    }
  }

  /**
   * 检查父子节点的 level 关系
   * 验证子节点的 level 是否等于父节点的 level + 1
   */
  private async checkParentChildLevel(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    const treeIdFilter = this.treeId
      ? `AND child.${this.keyFields.treeId} = ${this.escaper.escape(this.treeId)}`
      : "";

    const sql = `
      WITH parent_child AS (
        SELECT
          child.${this.keyFields.id} as child_id,
          child.${this.keyFields.name} as child_name,
          child.${this.keyFields.level} as child_level,
          parent.${this.keyFields.id} as parent_id,
          parent.${this.keyFields.name} as parent_name,
          parent.${this.keyFields.level} as parent_level,
          ROW_NUMBER() OVER (
            PARTITION BY child.${this.keyFields.id}
            ORDER BY parent.${this.keyFields.level} DESC
          ) as parent_rank
        FROM ${this.tableName} child
        INNER JOIN ${this.tableName} parent ON
          child.${this.keyFields.leftValue} > parent.${this.keyFields.leftValue} AND
          child.${this.keyFields.rightValue} < parent.${this.keyFields.rightValue}
        WHERE 1=1 ${treeIdFilter}
      )
      SELECT
        child_name,
        child_level,
        parent_name,
        parent_level
      FROM parent_child
      WHERE parent_rank = 1 AND child_level <> parent_level + 1
      LIMIT 1
    `;

    const invalidRelations = await this.adapter.getRows(sql);

    if (invalidRelations.length > 0) {
      const invalid = invalidRelations[0];
      throw new FlexTreeVerifyError(
        `节点 ${invalid.child_name}(level=${invalid.child_level}) 与其直接父节点 ${invalid.parent_name}(level=${invalid.parent_level}) 的层级关系错误，子节点 level 应该是 ${invalid.parent_level + 1}`,
      );
    }
  }
}
