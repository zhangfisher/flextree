/**
 * write:commit 事件测试
 *
 * 设计依据 docs/adr/0005-sql-before-commit-event.md：
 * - COMMIT 前聚合：一次 write 内全部 SQL 聚合为一批，在事务回调末尾、COMMIT 前触发一次
 * - 只读通知：监听器抛出的异常被吞掉，事务照常提交
 * - 空批不触发：write 内未执行任何 SQL 时不触发（对齐 sqljs Persist Hook 先例）
 * - repair 经 write 复用写机制，天然覆盖
 * - MultiRootFlexTreeManager 不转发此事件（与 write:before/write:after 同档）
 * - 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { FlexTreeManager, FlexNodeRelPosition } from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";
import { MultiRootFlexTreeManager } from "../src/multi_root_manager";

interface TestFields {
  title: string;
  size: number;
}

let driver: BunSqliteAdapter;

/** 创建单树 manager，预置树：root → A, B */
async function createManager(): Promise<FlexTreeManager<TestFields>> {
  driver = new BunSqliteAdapter();
  await driver.open();
  await driver.exec([
    `CREATE TABLE IF NOT EXISTS tree (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(60),
        treeId INTEGER,
        level INTEGER,
        leftValue INTEGER,
        rightValue INTEGER,
        title VARCHAR(60),
        size INTEGER
    );`,
    `DELETE FROM tree`,
  ]);
  return new FlexTreeManager<TestFields>("tree", { adapter: driver });
}

/** 构建精确结构：root → A, B */
async function buildTree(manager: FlexTreeManager<TestFields>) {
  await manager.write(async () => {
    await manager.createRoot({ name: "R" } as any);
    const root = await manager.getRoot();
    await manager.addNodes([{ name: "A" }, { name: "B" }] as any, root, FlexNodeRelPosition.LastChild);
  });
}

describe("write:commit 事件", () => {
  let manager: FlexTreeManager<TestFields>;

  beforeEach(async () => {
    manager = await createManager();
  });

  test("一次 write 内多批 SQL 聚合触发一次", async () => {
    await buildTree(manager);
    const payloads: { tree: any; sqls: string[] }[] = [];
    manager.on("write:commit", (p) => payloads.push(p));

    await manager.write(async () => {
      const root = await manager.getRoot();
      // 两次 addNodes = 两批独立 exec
      await manager.addNodes([{ name: "C" }] as any, root, FlexNodeRelPosition.LastChild);
      await manager.addNodes([{ name: "D" }] as any, root, FlexNodeRelPosition.LastChild);
    });

    expect(payloads).toHaveLength(1);
    // 两批 SQL 全部聚合在同一载荷中
    expect(payloads[0].sqls.length).toBeGreaterThanOrEqual(2);
    expect(payloads[0].sqls.some((s) => s.includes("C"))).toBe(true);
    expect(payloads[0].sqls.some((s) => s.includes("D"))).toBe(true);
    // 单树表 tree 为 undefined
    expect(payloads[0].tree).toBeUndefined();
  });

  test("空批不触发（write 内未执行任何 SQL）", async () => {
    await buildTree(manager);
    let fired = 0;
    manager.on("write:commit", () => fired++);

    await manager.write(async () => {
      // 只有读操作，无任何 SQL 执行
      await manager.getRoot();
    });

    expect(fired).toBe(0);
  });

  test("监听器抛异常被吞掉，事务照常提交", async () => {
    await buildTree(manager);
    manager.on("write:commit", () => {
      throw new Error("listener boom");
    });

    // write 不因监听器异常而失败
    await manager.write(async () => {
      const root = await manager.getRoot();
      await manager.addNodes([{ name: "E" }] as any, root, FlexNodeRelPosition.LastChild);
    });

    // 数据已提交
    expect(await manager.findNode({ name: "E" })).not.toBeNull();
  });

  test("多树表载荷携带 tree 字段", async () => {
    const payloads: { tree: any; sqls: string[] }[] = [];
    const tree1 = new FlexTreeManager<TestFields>("tree", { adapter: driver, treeId: 1 });
    tree1.on("write:commit", (p) => payloads.push(p));

    await tree1.write(async () => {
      await tree1.createRoot({ name: "R1" } as any);
    });

    expect(payloads).toHaveLength(1);
    expect(payloads[0].tree).toBe(1);
  });

  test("repair 经 write 复用，事件覆盖", async () => {
    await buildTree(manager);
    // 手动破坏结构，让 repair 产生实际 UPDATE
    await driver.exec([`UPDATE tree SET leftValue = 99 WHERE name = 'A'`]);

    let fired = 0;
    let sqlCount = 0;
    manager.on("write:commit", (p) => {
      fired++;
      sqlCount = p.sqls.length;
    });

    await manager.repair();

    expect(fired).toBe(1);
    expect(sqlCount).toBeGreaterThan(0);
    expect(await manager.verify()).toBe(true);
  });

  test("监听器内看到的是 SQL 字符串数组", async () => {
    let received: string[] | undefined;
    manager.on("write:commit", (p) => {
      received = p.sqls;
    });

    await manager.write(async () => {
      await manager.createRoot({ name: "R" } as any);
    });

    expect(Array.isArray(received)).toBe(true);
    expect(received!.length).toBeGreaterThan(0);
    expect(typeof received![0]).toBe("string");
    expect(received![0]).toContain("INSERT INTO");
  });

  test("MultiRootFlexTreeManager 不转发此事件", async () => {
    await driver.exec([`DELETE FROM tree`]);
    const mm = new MultiRootFlexTreeManager<TestFields>("tree", { adapter: driver });
    await mm.load();

    let mmFired = 0;
    let subFired = 0;
    mm.on("write:commit", () => mmFired++);
    // 内部子管理器照常触发（决策：mm 不转发，但子管理器事件独立存在）
    (mm as any)._manager.on("write:commit", () => subFired++);

    await mm.write(async () => {
      await mm.addNodes([{ name: "R1" }] as any);
    });

    expect(mmFired).toBe(0);
    expect(subFired).toBe(1);
  });
});
