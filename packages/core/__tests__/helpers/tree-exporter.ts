/**
 * 树导出工具函数
 * 用于导出树数据以便调试和查看
 */

import Database from "bun:sqlite";
import type { IFlexTreeNodeFields, DefaultTreeKeyFields } from "../../src";
import { TestFields } from "./tree-manager";
import BunSqliteAdapter from "../../../bun-sqlite/src";

/**
 * 导出默认字段名的树数据用于调试
 */
export async function dumpTree(
  adapter: BunSqliteAdapter,
): Promise<IFlexTreeNodeFields<TestFields, DefaultTreeKeyFields>[]> {
  const rows = await adapter.getRows("SELECT * FROM tree ORDER BY leftValue");
  return rows as IFlexTreeNodeFields<TestFields, DefaultTreeKeyFields>[];
}

/**
 * 导出自定义字段名的树数据用于调试
 */
export async function dumpCustomTree(srcDb: Database, dbFile: string = "tree.db") {
  // BunSqliteAdapter使用内存数据库，dump功能不再需要
  // 保留函数签名以兼容现有测试
}

/**
 * 通用树数据导出函数（兼容旧版本）
 */
export async function dumpTreeCompat(srcDb: Database, dbFile: string = "tree.db") {
  // BunSqliteAdapter使用内存数据库，dump功能不再需要
  // 保留函数签名以兼容现有测试
}
