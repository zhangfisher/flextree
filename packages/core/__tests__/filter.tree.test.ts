import { describe, test, expect, beforeEach } from "bun:test";
import { FlexTreeManager } from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";
import { toTree } from "./helpers";

interface TestFields {
  status: number;
  name: string;
}

describe("getNodes with where parameter", () => {
  let manager: FlexTreeManager<TestFields>;
  let adapter: BunSqliteAdapter;

  beforeEach(async () => {
    // 创建适配器
    adapter = new BunSqliteAdapter();
    await adapter.open();

    // 创建测试表
    await adapter.exec(`
      CREATE TABLE test_tree (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        leftValue INTEGER,
        rightValue INTEGER,
        level INTEGER,
        status INTEGER,
        name TEXT
      )
    `);

    // 手动插入测试树结构数据
    /*
    ROOT (left=1, right=38, level=0, status=0, name='ROOT')
        A (left=2, right=13, level=1, status=1, name='A')
          A1 (left=3, right=4, level=2, status=2, name='A1')
          A2 (left=5, right=6, level=2, status=1, name='A2')
          A3 (left=7, right=8, level=2, status=2, name='A3')
          A4 (left=9, right=10, level=2, status=1, name='A4')
          A5 (left=11, right=12, level=2, status=2, name='A5')
        B (left=14, right=25, level=1, status=2, name='B')
          B1 (left=15, right=16, level=2, status=1, name='B1')
          B2 (left=17, right=18, level=2, status=2, name='B2')
          B3 (left=19, right=20, level=2, status=1, name='B3')
          B4 (left=21, right=22, level=2, status=2, name='B4')
          B5 (left=23, right=24, level=2, status=1, name='B5')
        C (left=26, right=37, level=1, status=1, name='C')
          C1 (left=27, right=28, level=2, status=2, name='C1')
          C2 (left=29, right=30, level=2, status=1, name='C2')
          C3 (left=31, right=32, level=2, status=2, name='C3')
          C4 (left=33, right=34, level=2, status=1, name='C4')
          C5 (left=35, right=36, level=2, status=2, name='C5')
    */

    const testData = [
      { id: 1, leftValue: 1, rightValue: 38, level: 0, status: 0, name: "ROOT" },
      { id: 2, leftValue: 2, rightValue: 13, level: 1, status: 1, name: "A" },
      { id: 3, leftValue: 3, rightValue: 4, level: 2, status: 2, name: "A1" },
      { id: 4, leftValue: 5, rightValue: 6, level: 2, status: 1, name: "A2" },
      { id: 5, leftValue: 7, rightValue: 8, level: 2, status: 2, name: "A3" },
      { id: 6, leftValue: 9, rightValue: 10, level: 2, status: 1, name: "A4" },
      { id: 7, leftValue: 11, rightValue: 12, level: 2, status: 2, name: "A5" },
      { id: 8, leftValue: 14, rightValue: 25, level: 1, status: 2, name: "B" },
      { id: 9, leftValue: 15, rightValue: 16, level: 2, status: 1, name: "B1" },
      { id: 10, leftValue: 17, rightValue: 18, level: 2, status: 2, name: "B2" },
      { id: 11, leftValue: 19, rightValue: 20, level: 2, status: 1, name: "B3" },
      { id: 12, leftValue: 21, rightValue: 22, level: 2, status: 2, name: "B4" },
      { id: 13, leftValue: 23, rightValue: 24, level: 2, status: 1, name: "B5" },
      { id: 14, leftValue: 26, rightValue: 37, level: 1, status: 1, name: "C" },
      { id: 15, leftValue: 27, rightValue: 28, level: 2, status: 2, name: "C1" },
      { id: 16, leftValue: 29, rightValue: 30, level: 2, status: 1, name: "C2" },
      { id: 17, leftValue: 31, rightValue: 32, level: 2, status: 2, name: "C3" },
      { id: 18, leftValue: 33, rightValue: 34, level: 2, status: 1, name: "C4" },
      { id: 19, leftValue: 35, rightValue: 36, level: 2, status: 2, name: "C5" }
    ];

    for (const row of testData) {
      await adapter.exec(`
        INSERT INTO test_tree (id, leftValue, rightValue, level, status, name)
        VALUES (${row.id}, ${row.leftValue}, ${row.rightValue}, ${row.level}, ${row.status}, '${row.name}')
      `);
    }

    // 创建管理器实例
    manager = new FlexTreeManager<TestFields>("test_tree", {
      adapter: adapter,
    });
  });

  test("应该返回所有节点当没有where条件时", async () => {
    const result = await manager.getNodes();
    const treeString = toTree(result);
    expect(treeString).toBe(`ROOT (id=1, status=0)
├── A (id=2, status=1)
│   ├── A1 (id=3, status=2)
│   ├── A2 (id=4, status=1)
│   ├── A3 (id=5, status=2)
│   ├── A4 (id=6, status=1)
│   └── A5 (id=7, status=2)
├── B (id=8, status=2)
│   ├── B1 (id=9, status=1)
│   ├── B2 (id=10, status=2)
│   ├── B3 (id=11, status=1)
│   ├── B4 (id=12, status=2)
│   └── B5 (id=13, status=1)
└── C (id=14, status=1)
    ├── C1 (id=15, status=2)
    ├── C2 (id=16, status=1)
    ├── C3 (id=17, status=2)
    ├── C4 (id=18, status=1)
    └── C5 (id=19, status=2)`);
  });

  test("应该正确过滤：ROOT不满足条件时返回空集", async () => {
    const result = await manager.getNodes({ where: "status > 1" });
    expect(result).toEqual([]); // ROOT status=0，不满足条件
  });

  test("应该正确过滤：包含满足条件的节点及其后代", async () => {
    // 修改测试数据：让ROOT满足条件
    await adapter.exec("UPDATE test_tree SET status = 2 WHERE id = 1");

    const result = await manager.getNodes({ where: "status >= 1" });
    // ROOT(status=2)满足，A(status=1)满足，B(status=2)满足，C(status=1)满足
    // 因为所有节点的祖先ROOT都满足条件，所以都应该包含
    const names = result.map((n) => n.name);
    expect(names).toEqual([
      "ROOT", "A", "A1", "A2", "A3", "A4", "A5",
      "B", "B1", "B2", "B3", "B4", "B5",
      "C", "C1", "C2", "C3", "C4", "C5"
    ]);
  });

  test("应该正确过滤：严格级联过滤", async () => {
    // 修改测试数据：让ROOT满足条件
    await adapter.exec("UPDATE test_tree SET status = 2 WHERE id = 1");

    const result = await manager.getNodes({ where: "status > 1" });
    const treeString = toTree(result);
    // ROOT(status=2)满足，A(status=1)不满足所以A及其后代被排除
    // B(status=2)满足，B中只有B2和B4满足status>1
    // C(status=1)不满足所以C及其后代被排除
    expect(treeString).toBe(`ROOT (id=1, status=2)
└── B (id=8, status=2)
    ├── B2 (id=10, status=2)
    └── B4 (id=12, status=2)`);
  });

  test("应该正确组合level和where参数", async () => {
    // 修改测试数据：让ROOT满足条件
    await adapter.exec("UPDATE test_tree SET status = 2 WHERE id = 1");

    const result = await manager.getNodes({
      level: 1,
      where: "status >= 1",
    });

    const names = result.map((n) => n.name);
    // ROOT(level=0)和A(level=1)和B(level=1)和C(level=1)都满足status>=1，且level<=1
    expect(names).toEqual(["ROOT", "A", "B", "C"]);
  });

  test("应该正确组合fields和where参数", async () => {
    const result = await manager.getNodes({
      fields: ["id", "name"],
      where: "status > 100", // 不会匹配任何节点
    });
    expect(result).toEqual([]);
  });

  test("应该抛出错误检测到危险SQL模式", async () => {
    await expect(async () => {
      await manager.getNodes({
        where: "status > 1; DROP TABLE test_tree",
      });
    }).toThrow("Dangerous SQL pattern");
  });

  test("应该正确处理空字符串where条件", async () => {
    const result1 = await manager.getNodes({ where: "" });
    const result2 = await manager.getNodes({ where: "   " });
    const result3 = await manager.getNodes();

    const names1 = result1.map((n) => n.name);
    const names2 = result2.map((n) => n.name);
    const names3 = result3.map((n) => n.name);

    expect(names1).toEqual([
      "ROOT", "A", "A1", "A2", "A3", "A4", "A5",
      "B", "B1", "B2", "B3", "B4", "B5",
      "C", "C1", "C2", "C3", "C4", "C5"
    ]);
    expect(names2).toEqual([
      "ROOT", "A", "A1", "A2", "A3", "A4", "A5",
      "B", "B1", "B2", "B3", "B4", "B5",
      "C", "C1", "C2", "C3", "C4", "C5"
    ]);
    expect(names3).toEqual([
      "ROOT", "A", "A1", "A2", "A3", "A4", "A5",
      "B", "B1", "B2", "B3", "B4", "B5",
      "C", "C1", "C2", "C3", "C4", "C5"
    ]);
  });

  test("应该保持树的遍历顺序", async () => {
    // 修改测试数据：让ROOT和B满足条件
    await adapter.exec("UPDATE test_tree SET status = 2 WHERE id IN (1, 8)");

    const result = await manager.getNodes({ where: "status > 1" });
    const names = result.map((n) => n.name);
    // ROOT满足，B满足，B2和B4本身也满足status>1，所以都应包含
    expect(names).toEqual(["ROOT", "B", "B2", "B4"]); // 按leftValue排序
  });

  test("应该正确过滤：status > 0 条件", async () => {
    const result = await manager.getNodes({ where: "status > 0" });
    // ROOT status=0 不满足>0，所以所有节点都被过滤
    expect(result).toEqual([]);
  });

  test("应该正确过滤：status >= 0 条件", async () => {
    const result = await manager.getNodes({ where: "status >= 0" });
    // ROOT status=0 满足>=0，所有节点status都>=0，所以返回所有节点
    const names = result.map((n) => n.name);
    expect(names).toEqual([
      "ROOT", "A", "A1", "A2", "A3", "A4", "A5",
      "B", "B1", "B2", "B3", "B4", "B5",
      "C", "C1", "C2", "C3", "C4", "C5"
    ]);
  });

  test("应该正确过滤：status >= 1 条件", async () => {
    const result = await manager.getNodes({ where: "status >= 1" });
    // ROOT status=0 不满足>=1，所以所有节点都被过滤
    expect(result).toEqual([]);
  });

  test("应该正确过滤：status >= 1 条件（ROOT满足）", async () => {
    // 修改ROOT status为1，使其满足条件
    await adapter.exec("UPDATE test_tree SET status = 1 WHERE id = 1");

    const result = await manager.getNodes({ where: "status >= 1" });
    // ROOT满足，所有子节点的status都是1或2，都满足>=1
    // 所以返回所有节点
    const names = result.map((n) => n.name);
    expect(names).toEqual([
      "ROOT", "A", "A1", "A2", "A3", "A4", "A5",
      "B", "B1", "B2", "B3", "B4", "B5",
      "C", "C1", "C2", "C3", "C4", "C5"
    ]);
  });

  test("应该正确过滤：status > 1 条件", async () => {
    const result = await manager.getNodes({ where: "status > 1" });
    // ROOT status=0 不满足>1，所以所有节点都被过滤
    expect(result).toEqual([]);
  });

  test("应该正确过滤：status > 1 条件（ROOT满足）", async () => {
    // 修改ROOT status为2，使其满足条件
    await adapter.exec("UPDATE test_tree SET status = 2 WHERE id = 1");

    const result = await manager.getNodes({ where: "status > 1" });
    // ROOT满足，A(1)不满足所以A及其后代被排除
    // B(2)满足，其中>1的子节点：B2,B4
    // C(1)不满足所以C及其后代被排除
    const names = result.map((n) => n.name);
    expect(names).toEqual(["ROOT", "B", "B2", "B4"]);
  });

  test("应该正确过滤：status < 2 条件", async () => {
    const result = await manager.getNodes({ where: "status < 2" });
    const treeString = toTree(result);
    // ROOT(0)满足，A(1)满足，B(2)不满足所以B及其后代被排除，C(1)满足
    // 满足<2的节点：ROOT,A,A2,A4,C,C2,C4
    expect(treeString).toBe(`ROOT (id=1, status=0)
├── A (id=2, status=1)
│   ├── A2 (id=4, status=1)
│   └── A4 (id=6, status=1)
└── C (id=14, status=1)
    ├── C2 (id=16, status=1)
    └── C4 (id=18, status=1)`);
  });

  test("应该正确过滤：status >= 2 条件", async () => {
    const result = await manager.getNodes({ where: "status >= 2" });
    // ROOT status=0 不满足>=2，所以所有节点都被过滤
    expect(result).toEqual([]);
  });

  test("应该正确过滤：status >= 2 条件（ROOT满足）", async () => {
    // 修改ROOT status为2，使其满足条件
    await adapter.exec("UPDATE test_tree SET status = 2 WHERE id = 1");

    const result = await manager.getNodes({ where: "status >= 2" });
    // ROOT满足，A(1)不满足所以A及其后代被排除
    // B(2)满足，其中>=2的子节点：B2,B4
    // C(1)不满足所以C及其后代被排除
    const names = result.map((n) => n.name);
    expect(names).toEqual(["ROOT", "B", "B2", "B4"]);
  });

  test("应该正确处理复杂的WHERE条件", async () => {
    // 修改测试数据：创建更复杂的场景
    // 让ROOT、A、B、C都满足status>1，其他节点保持原status
    await adapter.exec("UPDATE test_tree SET status = 2 WHERE id IN (1, 2, 8, 14)");

    const result = await manager.getNodes({ where: "status > 1 AND level < 2" });
    const names = result.map((n) => n.name);
    // 只有ROOT(level=0)、A(level=1)、B(level=1)、C(level=1)满足条件且level<2
    expect(names).toEqual(["ROOT", "A", "B", "C"]);
  });

  test("应该正确过滤：status != 2 条件", async () => {
    const result = await manager.getNodes({ where: "status != 2" });
    const treeString = toTree(result);
    // ROOT(status=0)满足!=2，A(status=1)满足，B(status=2)不满足所以B及其后代被排除，C(status=1)满足
    // 满足!=2的节点：ROOT,A,A2,A4,C,C2,C4
    expect(treeString).toBe(`ROOT (id=1, status=0)
├── A (id=2, status=1)
│   ├── A2 (id=4, status=1)
│   └── A4 (id=6, status=1)
└── C (id=14, status=1)
    ├── C2 (id=16, status=1)
    └── C4 (id=18, status=1)`);
  });
});
