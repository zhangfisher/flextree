/**
 * 树管理器创建工具函数
 * 统一管理所有类型的 FlexTreeManager 和 FlexTree 创建函数
 */

import { FlexTreeManager, FlexTree } from "../../src";
import BunSqliteAdapter from "../../../bun-sqlite/src";

export interface TestFields {
  title: string;
  size: number;
}

/**
 * 创建树表（默认字段名）
 */
export async function createTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS  tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),
            treeId INTEGER,
            level INTEGER,
            leftValue INTEGER,
            rightValue INTEGER,
            title VARCHAR(60),
            size INTEGER
        );
        `,
  ]);
}

/**
 * 创建多树表（默认字段名）
 */
export async function createMultiTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS  tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),
            treeId INTEGER,
            level INTEGER,
            leftValue INTEGER,
            rightValue INTEGER,
            title VARCHAR(60),
            size INTEGER,
            UNIQUE(treeId, leftValue)
        );
        `,
  ]);
}

/**
 * 创建自定义树表
 */
export async function createCustomTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS  tree (
            pk INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60),
            tree INTEGER,
            level INTEGER,
            lft INTEGER,
            rgt INTEGER,
            size INTEGER
        );
        `,
  ]);
}

/**
 * 创建多树表（自定义字段名）
 */
export async function createCustomMultiTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS  tree (
            pk INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60),
            tree INTEGER,
            level INTEGER,
            lft INTEGER,
            rgt INTEGER,
            size INTEGER,
            UNIQUE(tree, lft)
        );
        `,
  ]);
}

/**
 * 清空所有表数据
 */
async function clearAllTables(driver: BunSqliteAdapter) {
  await driver.exec([`DELETE FROM tree`]);
}

/**
 * 创建默认字段名的树管理器
 */
export async function createTreeManager(treeId?: number): Promise<FlexTreeManager<TestFields>> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  if (treeId) {
    await createMultiTreeTable(sqliteAdapter);
  } else {
    await createTreeTable(sqliteAdapter);
  }
  await clearAllTables(sqliteAdapter);

  const manager = new FlexTreeManager<TestFields>("tree", {
    treeId: treeId,
    adapter: sqliteAdapter,
  });

  return manager;
}

/**
 * 创建默认字段名的 FlexTree
 */
export async function createFlexTree(
  treeId?: number,
  options?: { lazy?: boolean }
): Promise<FlexTree<TestFields>> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  if (treeId) {
    await createMultiTreeTable(sqliteAdapter);
  } else {
    await createTreeTable(sqliteAdapter);
  }
  await clearAllTables(sqliteAdapter);

  const tree = new FlexTree<TestFields>("tree", {
    treeId: treeId,
    adapter: sqliteAdapter,
    lazy: options?.lazy ?? false, // 默认禁用 lazy loading，但可以通过 options 覆盖
  });

  return tree;
}

/**
 * 创建自定义字段名的树管理器
 */
export async function createCustomTreeManager(treeId?: any) {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  if (treeId) {
    await createCustomMultiTreeTable(sqliteAdapter);
  } else {
    await createCustomTreeTable(sqliteAdapter);
  }
  await clearAllTables(sqliteAdapter);
  return new FlexTreeManager<
    {
      size: number;
    },
    {
      id: ["pk", number];
      treeId: ["tree", number];
      name: "title";
      leftValue: "lft";
      rightValue: "rgt";
    }
  >("tree", {
    treeId,
    adapter: sqliteAdapter,
    fields: {
      id: "pk",
      treeId: "tree",
      name: "title",
      leftValue: "lft",
      rightValue: "rgt",
    },
  });
}

/**
 * 创建自定义字段名的 FlexTree
 */
export async function createCustomFlexTree(treeId?: any) {
  const sqliteDriver = new BunSqliteAdapter();
  await sqliteDriver.open();
  if (treeId) {
    await createCustomMultiTreeTable(sqliteDriver);
  } else {
    await createCustomTreeTable(sqliteDriver);
  }
  await clearAllTables(sqliteDriver);
  const tree = new FlexTree<
    {
      size: number;
    },
    {
      id: ["pk", number];
      treeId: ["tree", number];
      name: "title";
      leftValue: "lft";
      rightValue: "rgt";
    }
  >("tree", {
    treeId,
    adapter: sqliteDriver,
    fields: {
      id: "pk",
      treeId: "tree",
      name: "title",
      leftValue: "lft",
      rightValue: "rgt",
    },
  });
  return tree;
}

// 导出类型
export type TestFlexTreeManager = FlexTreeManager<TestFields>;
export type TestFlexTree = FlexTree<TestFields>;
export type DemoFlexTreeManager = FlexTreeManager<{
  title: string;
  size: number;
}>;
export type DemoFlexTree = FlexTree<{
  title: string;
  size: number;
}>;

export type CustomDemoFlexTreeManager = FlexTreeManager<
  {
    size: number;
  },
  {
    id: ["pk", number];
    treeId: ["tree", number];
    name: "title";
    leftValue: "lft";
    rightValue: "rgt";
  }
>;

export type CustomDemoFlexTree = FlexTree<
  {
    size: number;
  },
  {
    id: ["pk", number];
    treeId: ["tree", number];
    name: "title";
    leftValue: "lft";
    rightValue: "rgt";
  }
>;
