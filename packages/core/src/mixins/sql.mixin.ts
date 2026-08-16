import type { FlexTreeManager } from "../manager";
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "../types";

export class SqlMixin<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  TreeId = NonUndefined<KeyFields["treeId"]>[1],
> {
  /**
   * 执行读取操作
   * @param {string} sql  执行的sql
   * @returns  返回查询结果
   */
  protected async getRows(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    sql: string,
  ): Promise<any> {
    await this.assertConnected();
    await this._guardRead();
    return await this.adapter.getRows(sql);
  }
  /**
   * 执行操作，无返回值
   * @param {string[]} sqls
   * @returns 返回执行结果
   */
  async onExecuteSql(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    sqls: string[],
  ): Promise<any> {
    await this.assertConnected();
    // 不自开事务：调用方负责提供事务——write(fn) 内由 write 的 transaction 承载（跨方法原子），
    // repair 由其自身 transaction 承载。所有调用方均经 _assertWriteable 或自包事务保证在事务内。
    // 收集供 write 在 COMMIT 前聚合触发 write:commit（空批不触发由 write 判定）
    this._pendingSqls.push(...sqls);
    await this.adapter.exec(sqls);
  }

  /**
   * 构建sql时调用，进行一些额外的处理
   *
   *
   * @param sql
   */
  protected _sql(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, sql: string) {
    // 在一表多树时,需要增加额外的树判定
    if (this.treeId) {
      // 预计算转义后的字段名以提高性能和代码可读性
      const treeIdField = this.escaper.escapeId(this.keyFields.treeId);
      // 字符串类型直接传给escaper处理，数值类型也直接传递
      // escaper会根据类型自动添加引号（字符串）或不添加（数值）
      sql = sql.params({
        __TREE_ID__: `${treeIdField}=${this.escaper.escape(this.treeId)} AND `,
      });
    } else {
      sql = sql.params({ __TREE_ID__: "" });
    }
    return sql;
  }

  protected async getOneNode(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    sql: string,
  ): Promise<TreeNode | null> {
    const result = await this.getRows(sql);
    return result.length > 0 ? (result[0] as TreeNode) : null;
  }

  protected async getScalar<T = number>(
    this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    sql: string,
  ): Promise<T> {
    await this.assertConnected();
    await this._guardRead();
    return (await this.adapter.getScalar(sql)) as T;
  }
}
