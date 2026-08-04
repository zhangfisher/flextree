/**
 * repair 方法测试（基于数据库的集成测试）
 *
 * 通过 sqlite 适配器验证 RepairMixin.repair() 的完整修复流程：
 * 1. 直接用 SQL 读取破坏树（不能用 getNodes）
 * 2. repairTree 修复 leftValue/rightValue/level
 * 3. 将发生变化的节点写回数据库（事务）
 *
 * 修复契约（所有场景均需满足）：
 * - 修复后 leftValue + rightValue 集合恰好覆盖 1..2N 连续整数（N = 节点数）
 * - 每个节点 leftValue < rightValue
 * - level 基于实际嵌套深度规范化（根=0，每层 +1）
 */
import { describe, it, expect, beforeEach } from "bun:test";
import { createTreeManager, type TestFlexTreeManager } from "../helpers";
import { repairTree } from "../../src/mixins/repair.mixin";

type Row = {
  id: number;
  name: string;
  level: number;
  leftValue: number;
  rightValue: number;
};

describe("repair", () => {
  let tree: TestFlexTreeManager;

  beforeEach(async () => {
    tree = await createTreeManager();
  });

  /** 直接用 SQL 插入节点（绕过 manager 正常 API，模拟破坏数据） */
  async function insertRows(rows: Row[]) {
    const values = rows
      .map((r) => `(${r.id},'${r.name}',${r.level},${r.leftValue},${r.rightValue})`)
      .join(",");
    await tree.adapter.exec([
      `INSERT INTO tree (id, name, level, leftValue, rightValue) VALUES ${values}`,
    ]);
  }

  /** 读取所有节点（按 leftValue 排序） */
  async function getNodes(): Promise<Row[]> {
    return await tree.adapter.getRows(
      `SELECT id, name, level, leftValue, rightValue FROM tree ORDER BY leftValue`,
    );
  }

  /** 断言修复后数学完整：leftValue/rightValue 覆盖 1..2N 连续，且 leftValue < rightValue */
  function assertComplete(nodes: Row[]) {
    const all = nodes.flatMap((n) => [n.leftValue, n.rightValue]).sort((a, b) => a - b);
    expect(all).toEqual(Array.from({ length: nodes.length * 2 }, (_, i) => i + 1));
    for (const n of nodes) {
      expect(n.leftValue).toBeLessThan(n.rightValue);
    }
  }

  it("修复被破坏的树结构并写回数据库", async () => {
    await insertRows([
      { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 18 },
      { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 9 },
      { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 16 },
      { id: 5, name: "A3", level: 2, leftValue: 7, rightValue: 8 },
      { id: 6, name: "B", level: 1, leftValue: 10, rightValue: 17 },
      { id: 7, name: "B1", level: 2, leftValue: 21, rightValue: 12 },
      { id: 8, name: "B2", level: 2, leftValue: 13, rightValue: 14 },
      { id: 9, name: "B3", level: 2, leftValue: 15, rightValue: 16 },
    ]);

    await tree.repair();

    const nodes = await getNodes();
    assertComplete(nodes);
    expect(nodes).toEqual([
      { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 18 },
      { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 9 },
      { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 6 },
      { id: 5, name: "A3", level: 2, leftValue: 7, rightValue: 8 },
      { id: 6, name: "B", level: 1, leftValue: 10, rightValue: 17 },
      { id: 8, name: "B2", level: 2, leftValue: 11, rightValue: 12 },
      { id: 9, name: "B3", level: 2, leftValue: 13, rightValue: 14 },
      { id: 7, name: "B1", level: 2, leftValue: 15, rightValue: 16 },
    ]);
  });

  it("完整树调用 repair 不产生变化", async () => {
    await insertRows([
      { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 8 },
      { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 7 },
      { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 6 },
    ]);

    await tree.repair();

    const nodes = await getNodes();
    assertComplete(nodes);
    expect(nodes).toEqual([
      { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 8 },
      { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 7 },
      { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 6 },
    ]);
  });

  /**
   * 破坏场景覆盖：针对不同类型被破坏的树结构验证修复结果
   */
  describe("破坏场景覆盖", () => {
    it("根节点 leftValue/rightValue 整体偏移（不从 1 开始）", async () => {
      await insertRows([
        { id: 1, name: "root", level: 0, leftValue: 5, rightValue: 12 },
        { id: 2, name: "A", level: 1, leftValue: 6, rightValue: 9 },
        { id: 3, name: "A1", level: 2, leftValue: 7, rightValue: 8 },
        { id: 4, name: "B", level: 1, leftValue: 10, rightValue: 11 },
      ]);

      await tree.repair();

      const nodes = await getNodes();
      assertComplete(nodes);
      expect(nodes).toEqual([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 8 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 5 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
        { id: 4, name: "B", level: 1, leftValue: 6, rightValue: 7 },
      ]);
    });

    it("深度链 rightValue 全部错误（过大）", async () => {
      await insertRows([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 100 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 99 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 98 },
      ]);

      await tree.repair();

      const nodes = await getNodes();
      assertComplete(nodes);
      expect(nodes).toEqual([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 6 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 5 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      ]);
    });

    it("孤立节点（leftValue/rightValue 在主树范围外）被吸收为根的子节点", async () => {
      await insertRows([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 10 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 5 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
        { id: 4, name: "orphan1", level: 1, leftValue: 50, rightValue: 51 },
        { id: 5, name: "B", level: 1, leftValue: 6, rightValue: 9 },
        { id: 6, name: "B1", level: 2, leftValue: 7, rightValue: 8 },
      ]);

      await tree.repair();

      const nodes = await getNodes();
      assertComplete(nodes);
      expect(nodes).toEqual([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 12 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 5 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
        { id: 5, name: "B", level: 1, leftValue: 6, rightValue: 9 },
        { id: 6, name: "B1", level: 2, leftValue: 7, rightValue: 8 },
        { id: 4, name: "orphan1", level: 1, leftValue: 10, rightValue: 11 },
      ]);
    });

    it("深度嵌套（6 层）部分 rightValue 错误", async () => {
      await insertRows([
        { id: 1, name: "L0", level: 0, leftValue: 1, rightValue: 200 },
        { id: 2, name: "L1", level: 1, leftValue: 2, rightValue: 19 },
        { id: 3, name: "L2", level: 2, leftValue: 3, rightValue: 18 },
        { id: 4, name: "L3", level: 3, leftValue: 4, rightValue: 17 },
        { id: 5, name: "L4", level: 4, leftValue: 5, rightValue: 16 },
        { id: 6, name: "L5a", level: 5, leftValue: 6, rightValue: 7 },
        { id: 7, name: "L5b", level: 5, leftValue: 8, rightValue: 999 },
        { id: 8, name: "L5c", level: 5, leftValue: 10, rightValue: 11 },
        { id: 9, name: "L5d", level: 5, leftValue: 12, rightValue: 13 },
        { id: 10, name: "L5e", level: 5, leftValue: 14, rightValue: 15 },
      ]);

      await tree.repair();

      const nodes = await getNodes();
      assertComplete(nodes);
      expect(nodes).toEqual([
        { id: 1, name: "L0", level: 0, leftValue: 1, rightValue: 20 },
        { id: 2, name: "L1", level: 1, leftValue: 2, rightValue: 19 },
        { id: 3, name: "L2", level: 2, leftValue: 3, rightValue: 18 },
        { id: 4, name: "L3", level: 3, leftValue: 4, rightValue: 17 },
        { id: 5, name: "L4", level: 4, leftValue: 5, rightValue: 16 },
        { id: 6, name: "L5a", level: 5, leftValue: 6, rightValue: 7 },
        { id: 7, name: "L5b", level: 5, leftValue: 8, rightValue: 9 },
        { id: 8, name: "L5c", level: 5, leftValue: 10, rightValue: 11 },
        { id: 9, name: "L5d", level: 5, leftValue: 12, rightValue: 13 },
        { id: 10, name: "L5e", level: 5, leftValue: 14, rightValue: 15 },
      ]);
    });

    it("所有节点 rightValue 相同（严重冲突）", async () => {
      await insertRows([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 99 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 99 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 99 },
      ]);

      await tree.repair();

      const nodes = await getNodes();
      assertComplete(nodes);
      expect(nodes).toEqual([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 6 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 5 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      ]);
    });

    it("level 跳级被规范化为连续值（基于实际嵌套深度）", async () => {
      await insertRows([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 10 },
        { id: 2, name: "A", level: 3, leftValue: 2, rightValue: 5 },
        { id: 3, name: "A1", level: 7, leftValue: 3, rightValue: 4 },
        { id: 4, name: "B", level: 3, leftValue: 6, rightValue: 9 },
        { id: 5, name: "B1", level: 7, leftValue: 7, rightValue: 8 },
      ]);

      await tree.repair();

      const nodes = await getNodes();
      assertComplete(nodes);
      expect(nodes).toEqual([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 10 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 5 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
        { id: 4, name: "B", level: 1, leftValue: 6, rightValue: 9 },
        { id: 5, name: "B1", level: 2, leftValue: 7, rightValue: 8 },
      ]);
    });

    it("rightValue 为负数或零（非法值）", async () => {
      await insertRows([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 0 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: -1 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: -5 },
      ]);

      await tree.repair();

      const nodes = await getNodes();
      assertComplete(nodes);
      expect(nodes).toEqual([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 6 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 5 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      ]);
    });

    it("混合大破坏：leftValue/rightValue 多处错 + 孤立节点 + 范围外节点", async () => {
      await insertRows([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 50 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 13 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
        { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 88 },
        { id: 5, name: "A3", level: 2, leftValue: 7, rightValue: 8 },
        { id: 6, name: "B", level: 1, leftValue: 14, rightValue: 77 },
        { id: 7, name: "B1", level: 2, leftValue: 99, rightValue: 100 },
        { id: 8, name: "B2", level: 2, leftValue: 15, rightValue: 16 },
        { id: 9, name: "B3", level: 2, leftValue: 17, rightValue: 18 },
      ]);

      await tree.repair();

      const nodes = await getNodes();
      assertComplete(nodes);
      expect(nodes).toEqual([
        { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 18 },
        { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 9 },
        { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
        { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 6 },
        { id: 5, name: "A3", level: 2, leftValue: 7, rightValue: 8 },
        { id: 6, name: "B", level: 1, leftValue: 10, rightValue: 17 },
        { id: 8, name: "B2", level: 2, leftValue: 11, rightValue: 12 },
        { id: 9, name: "B3", level: 2, leftValue: 13, rightValue: 14 },
        { id: 7, name: "B1", level: 2, leftValue: 15, rightValue: 16 },
      ]);
    });
  });

  /**
   * 单表多树：repair 通过 {__TREE_ID__} 仅修复当前 treeId 的树，不影响其他树
   */
  describe("单表多树", () => {
    it("仅修复当前 treeId 的树，不影响其他树", async () => {
      const multi = await createTreeManager(1);
      // 插入两棵树；破坏树1的 a12（rightValue=99）
      await multi.adapter.exec([
        `INSERT INTO tree (id, name, treeId, level, leftValue, rightValue) VALUES
          (1,'root1',1,0,1,8),(2,'a1',1,1,2,7),(3,'a11',1,2,3,4),(4,'a12',1,2,5,99),
          (5,'root2',2,0,1,8),(6,'b1',2,1,2,7),(7,'b11',2,2,3,4),(8,'b12',2,2,5,6)`,
      ]);

      await multi.repair();

      // 树1：a12 被修复，整树完整
      const t1 = await multi.adapter.getRows(
        `SELECT leftValue, rightValue FROM tree WHERE treeId=1 ORDER BY leftValue`,
      );
      expect(t1.flatMap((n: any) => [n.leftValue, n.rightValue]).sort((a: number, b: number) => a - b))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      // 树2：完全不受影响
      const t2 = await multi.adapter.getRows(
        `SELECT leftValue, rightValue FROM tree WHERE treeId=2 ORDER BY leftValue`,
      );
      expect(t2.flatMap((n: any) => [n.leftValue, n.rightValue]).sort((a: number, b: number) => a - b))
        .toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  /**
   * repairTree 函数的 treeId 处理（单树表 vs 多树表）
   */
  describe("repairTree - treeId 处理", () => {
    const brokenNodes = [
      { id: 1, name: "root", level: 0, leftValue: 5, rightValue: 12 },
      { id: 2, name: "A", level: 1, leftValue: 6, rightValue: 9 },
      { id: 3, name: "A1", level: 2, leftValue: 7, rightValue: 8 },
      { id: 4, name: "B", level: 1, leftValue: 10, rightValue: 11 },
    ];

    it("单树表（treeId 为空）：结果节点不带 treeId 字段", () => {
      const result = repairTree(brokenNodes, {});
      expect(result.every((n: any) => n.treeId === undefined)).toBe(true);
    });

    it("多树表（treeId 有值）：将 treeId 注入每个结果节点", () => {
      const result = repairTree(brokenNodes, { treeId: 100 });
      expect(result.every((n: any) => n.treeId === 100)).toBe(true);
    });

    it("treeId=null 等同于单树表，不注入", () => {
      const result = repairTree(brokenNodes, { treeId: null });
      expect(result.every((n: any) => n.treeId === undefined)).toBe(true);
    });
  });
});
