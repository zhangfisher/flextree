/**
 * 提供访问数据库的接口
 */

import { DatabaseType } from "./escaper";
import type * as manager from "./manager";

export interface IFlexTreeAdapter {
  // 当数据库打开准备就绪时
  ready: boolean;
  // 绑定树管理器
  bind: (treeManager: manager.FlexTreeManager) => void;
  // 执行sql，并返回结果
  exec: (sqls: string | string[]) => Promise<void>;
  // 执行查询并返回结果
  getRows: (sql: string) => Promise<any[]>;
  // 执行查询并返回标量
  getScalar: <T = number>(sql: string) => Promise<T>;
  open: (config?: any) => Promise<any>;
  // 返回一个数据库实例对象
  db: any;
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
