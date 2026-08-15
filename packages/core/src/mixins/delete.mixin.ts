import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";
import { FlexTreeNodeNotFoundError } from "../errors";
import { FlexNodeRelPosition } from "../types";

export class DeleteNodeMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 构建节点脱离/删除的 SQL（纯生成，零 IO、零副作用）
   *
   * - detach=true（脱离）：将目标子树的 leftValue/rightValue 取负，并回缩其右侧节点的左右值。
   *   供 moveNode 复用——源节点先从原位置脱离，再由移动 SQL 重新挂载到目标位置。
   * - detach=false（删除）：DELETE 目标子树，并回缩其右侧节点的左右值。
   *
   * 返回的 SQL 必须在同一个事务中**按顺序**执行：先取负/删除，再回缩左右值。
   * 回缩条件使用 `leftValue > L` / `rightValue > R`，此时源子树已取负（负数 < L）不会被误伤。
   *
   * @param nodeData 已读取的节点数据（须含 leftValue/rightValue）
   * @param options.detach true=脱离（取负，保留记录），false=删除（DELETE）
   * @returns SQL 语句数组
   */
  protected _buildDetachSqls(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeData: TreeNode,
    options: { detach?: boolean },
  ): string[] {
    const detach = !!options?.detach;
    const leftValue = nodeData[this.keyFields.leftValue];
    const rightValue = nodeData[this.keyFields.rightValue];
    const span = rightValue - leftValue + 1;

    // 预计算转义后的字段名以提高性能和代码可读性
    const leftValueField = this.escaper.escapeId(this.keyFields.leftValue);
    const rightValueField = this.escaper.escapeId(this.keyFields.rightValue);

    const sqls: string[] = [];
    // 第1步：取负（脱离）或删除目标子树
    if (detach) {
      sqls.push(
        this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = -${leftValueField},
                    ${rightValueField} = -${rightValueField}
                WHERE {__TREE_ID__}
                ${leftValueField}>=${leftValue} AND ${rightValueField}<=${rightValue}
            `),
      );
    } else {
      sqls.push(
        this._sql(`
                DELETE FROM ${this.tableName}
                WHERE {__TREE_ID__}
                ${leftValueField}>=${leftValue} AND ${rightValueField}<=${rightValue}
            `),
      );
    }
    // 第2步：回缩目标子树右侧节点的左右值，填补空隙
    sqls.push(
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${leftValueField} = ${leftValueField} - ${span}
                WHERE {__TREE_ID__}
                ${leftValueField}>${leftValue}
            `),
    );
    sqls.push(
      this._sql(`
                UPDATE ${this.tableName}
                SET
                    ${rightValueField} = ${rightValueField} - ${span}
                WHERE {__TREE_ID__}
                ${rightValueField}>${rightValue}
            `),
    );
    return sqls;
  }

  /**
   *
   * 删除指定节点及其子节点
   *
   * @param nodeId
   * @param {object} options
   * @param {boolean} [options.detach]   假删除（脱离）：仅将目标子树的 leftValue/rightValue 取负并回缩右侧节点，保留记录。
   *                                     供 moveNode 内部复用；普通删除无需设置。
   * @param {boolean} [options.recycle]  逻辑删除：子树经 moveNode 移入回收站（结构保持、level 重编）。
   *                                     仅在启用回收站后生效；对回收站内的节点无效（站内删除恒为物理删除）。
   * @param {boolean} [options.includeRecyclebin] 默认 false：回收站内的节点（含 bin 自身的后代）视为不存在，
   *                                     删除时抛 NotFound；true 时进入回收站视角照常操作。
   *
   * @returns {void}
   *
   */
  async deleteNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    nodeId: NodeId | TreeNode,
    options?: { detach?: boolean; recycle?: boolean; includeRecyclebin?: boolean },
  ): Promise<void> {
    this._assertWriteable();
    const detach = !!options?.detach;
    // 内部脱离路径（moveNode 复用）不做回收站判定
    if (detach) {
      const nodeData = (await this.getNodeData(nodeId)) as unknown as TreeNode;
      await this.onExecuteSql(this._buildDetachSqls(nodeData, { detach }));
      return;
    }

    // 回收站启用时的分支处理
    if (this.recycleBinEnabled) {
      // 删除 bin 自身 = 清空回收站（管理动作，不受 includeRecyclebin 门控）
      if (this.isRecycleBin(nodeId)) {
        await this.clearRecycleBin();
        return;
      }
      // 必须重新读取节点数据，保证节点数据的有效性（此处 getNodeData 不过滤，手动判定）
      const nodeData = (await this.getNodeData(nodeId)) as unknown as TreeNode;
      const inBin =
        nodeData[this.keyFields.leftValue] !== undefined &&
        (await this.isInRecycleBin(nodeData));
      if (inBin) {
        // Logical Invisibility：默认视角下站内节点不存在
        if (!options?.includeRecyclebin) {
          throw new FlexTreeNodeNotFoundError();
        }
        // 站内删除恒为物理删除（recycle 参数无效：逻辑删除的东西再删即物理删除）
        await this.onExecuteSql(this._buildDetachSqls(nodeData, { detach: false }));
        this.emit("node:deleted", { tree: this.treeId, node: nodeId });
        return;
      }
      // 站外 + recycle=true：逻辑删除（moveNode 进站，保持结构）
      if (options?.recycle) {
        const binId = this._getBinId()!;
        await this.moveNode(nodeData, binId, {
          pos: FlexNodeRelPosition.LastChild,
          includeRecyclebin: true,
        });
        // moveNode 已发 node:deleted(recycled) + node:moved；deleteNode 补充回收专用事件
        this.emit("node:recycled", { tree: this.treeId, node: nodeId });
        return;
      }
      // 站外 + recycle=false：物理删除（下方原路径）
      await this.onExecuteSql(this._buildDetachSqls(nodeData, { detach: false }));
      this.emit("node:deleted", { tree: this.treeId, node: nodeId });
      return;
    }

    // 未启用回收站：原路径（recycle 参数被忽略）
    const nodeData = (await this.getNodeData(nodeId)) as unknown as TreeNode;
    // 走 onExecuteSql，保证取负/删除 + 回缩在同一事务中原子执行
    await this.onExecuteSql(this._buildDetachSqls(nodeData, { detach }));
    // 脱离是移动操作的中间步骤，最终语义为移动而非删除，不触发删除事件
    if (!detach) {
      this.emit("node:deleted", { tree: this.treeId, node: nodeId });
    }
  }

  /**
   * 清空回收站：删除 bin 节点下所有子孙，bin 自身保留
   *
   * - 未启用回收站：静默返回
   * - 管理动作，不受 includeRecyclebin 门控，不发出事件
   * - 逐个删除前**重新读取**子节点数据：前一次删除会回缩后续兄弟的左右值，
   *   预读的坐标会失效（DELETE 区间错位）
   */
  async clearRecycleBin(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
  ): Promise<void> {
    if (!this.recycleBinEnabled) return;
    this._assertWriteable();
    const binId = this._getBinId()!;
    const binNode = (await this.getNodeData(binId)) as unknown as TreeNode;
    // 循环取 bin 的第一个子节点删除，直到清空（每次读取都是最新坐标）
    for (;;) {
      const first = (await this.getNthChild(binNode, 1, { includeRecyclebin: true })) as
        | TreeNode
        | undefined;
      if (!first) break;
      await this.onExecuteSql(this._buildDetachSqls(first, { detach: false }));
    }
  }

  /**
   * 清除树所有节点,包括根节点
   */
  async clear(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>) {
    this._assertWriteable();
    let sql: string = "";
    if (this.treeId) {
      sql = this._sql(`DELETE FROM ${this.tableName} WHERE {__TREE_ID__}`);
    } else {
      sql = `DELETE FROM ${this.tableName}`;
    }
    await this.onExecuteSql([sql]);
    this.emit("node:cleared", { tree: this.treeId });
  }
}
