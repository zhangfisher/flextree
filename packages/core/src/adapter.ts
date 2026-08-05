/**
 * 提供访问数据库的接口
 */

import { DatabaseType } from "./escaper";
import type * as manager from "./manager";

export interface IFlexTreeAdapter {
  /**
   * 当数据库是否已连接
   */
  connected: boolean;
  // 绑定树管理器
  bind: (treeManager: manager.FlexTreeManager) => void;
  // 执行sql，并返回结果
  exec: (sqls: string | string[]) => Promise<void>;
  // 执行查询并返回结果
  getRows: (sql: string) => Promise<any[]>;
  // 执行查询并返回标量
  getScalar: <T = number>(sql: string) => Promise<T>;

  open: (config?: any) => Promise<any>;
  /**
   * 在事务中执行异步回调：callback 内的所有数据库操作（exec/getRows 等）原子提交，
   * callback 抛错则整体回滚。callback 支持 async；嵌套调用（事务内再开事务）时直接复用外层事务。
   *
   * 这是跨方法/多操作原子性的承载者：write(fn) 用它包住 fn，fn 内多个 onExecuteSql 共享一个事务。
   * @param callback 事务体（可为 async）
   * @returns callback 完成（事务已提交/回滚）
   */
  transaction: (callback: () => Promise<void>) => Promise<void>;
  /**
   * 返回数据库为类型，取值: "sqlite" | "mysql" | "postgresql" | "oracle" | "sqlserver";
   *
   * 由于FlexTree需要拼接生成SQL,而不同数据库的SQL存在差异，所以需要此参数来进行差异化处理
   *
   * 如果没有指定，则默认为`postgresql`
   *
   */
  type?: DatabaseType;
}
