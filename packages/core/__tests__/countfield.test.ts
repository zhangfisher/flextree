/**
 * countField 功能测试
 *
 * 设计依据 docs/adr/0006-countfield-visible-scope.md：
 * - 公式：(rightValue - leftValue - 1) / 2，叶子 = 0
 * - 可见口径：默认视角下根节点 count 扣减 Bin 子树；includeRecyclebin=true 不扣减
 * - count 恒为全量后代数：不受 level 截断影响
 * - 附加字段与 id 同地位：指定 fields 时照样附加，不受 includeKeyFields 控制
 * - 重名抛 FlexTreeError
 * - 一致性锚点：默认视角下 ≡ getDescendantCount(node, {level:0})
 * - 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect } from "bun:test";
import {
  FlexTreeManager,
  MultiRootFlexTreeManager,
  FlexTree,
  FlexNodeRelPosition,
  FlexTreeError,
} from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

interface TestFields {
  title: string;
  size: number;
}

let driver: BunSqliteAdapter;

const BIN_ID = 9999;

/** 建表并返回未启用回收站的 manager */
async function createPlainManager(): Promise<FlexTreeManager<TestFields>> {
  FlexTreeManager.clearInstance(); // 测试间清理单例，避免 adapter 校验抛错
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

/** 建表并返回启用回收站的 manager */
async function createRecycleManager(): Promise<FlexTreeManager<TestFields>> {
  await createPlainManager();
  return new FlexTreeManager<TestFields>("tree", {
    adapter: driver,
    recyclebin: { id: BIN_ID, name: "__recyclebin__" },
  });
}

/**
 * 标准树：R → A(A1, A2), B
 * R: 5 节点子树 → 后代 4；A: 3 节点 → 后代 2；A1/A2/B: 叶子 → 0
 */
async function buildTree(manager: FlexTreeManager<TestFields>) {
  await manager.write(async () => {
    await manager.createRoot({ name: "R" } as any);
    const root = await manager.getRoot();
    await manager.addNodes(
      [{ name: "A" }, { name: "B" }] as any,
      root,
      FlexNodeRelPosition.LastChild,
    );
    const a = await manager.findNode({ name: "A" });
    await manager.addNodes(
      [{ name: "A1" }, { name: "A2" }] as any,
      a!.id,
      FlexNodeRelPosition.LastChild,
    );
  });
}

async function idOf(manager: FlexTreeManager<TestFields>, name: string) {
  const n = await manager.findNode({ name }, { includeRecyclebin: true });
  if (!n) throw new Error(`node ${name} not found`);
  return n.id;
}

/** 按名称取 count */
function countOf(list: any[], name: string, nameField = "name") {
  const n = list.find((x) => x[nameField] === name);
  if (!n) throw new Error(`node ${name} not found in result`);
  return n.count;
}

describe("countField：toJson / toList", () => {
  test("toJson 基本公式：叶子=0、父节点=后代数", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const json = (await manager.toJson({ countField: "count" })) as any;
    expect(json.name).toBe("R");
    expect(json.count).toBe(4); // A, A1, A2, B
    const a = json.children.find((c: any) => c.name === "A");
    expect(a.count).toBe(2); // A1, A2
    expect(a.children[0].count).toBe(0); // A1 叶子
  });

  test("toList 基本公式", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const list = (await manager.toList({ countField: "count" })) as any[];
    expect(countOf(list, "R")).toBe(4);
    expect(countOf(list, "A")).toBe(2);
    expect(countOf(list, "A1")).toBe(0);
    expect(countOf(list, "B")).toBe(0);
  });

  test("count 不受 level 截断影响（全量后代数）", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    // 只导出 2 级：R 的 count 仍是全量 4
    const json = (await manager.toJson({ countField: "count", level: 2 })) as any;
    expect(json.count).toBe(4);
    const list = (await manager.toList({ countField: "count", level: 2 })) as any[];
    expect(countOf(list, "R")).toBe(4);
  });

  test("指定 fields 过滤时 count 照样附加（与 id 同地位）", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const list = (await manager.toList({
      countField: "count",
      fields: ["name"],
    })) as any[];
    expect(countOf(list, "R")).toBe(4);
    // fields 限定 name，但 id 与 count 均附加
    const r = list.find((x: any) => x.name === "R");
    expect(r.id).toBeDefined();
    expect(r.count).toBe(4);
    expect(r.title).toBeUndefined(); // 未选字段不出现
  });

  test("includeKeyFields=false 默认导出也附加 count", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const json = (await manager.toJson({ countField: "count" })) as any;
    expect(json.count).toBe(4);
    expect(json.level).toBeUndefined(); // 键字段默认剔除，count 不受影响
  });

  test("不传 countField（默认）不附加任何字段", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const json = (await manager.toJson()) as any;
    expect(json.count).toBeUndefined();
    const list = (await manager.toList()) as any[];
    expect(list.every((n: any) => n.count === undefined)).toBe(true);
  });

  test("countField 与节点已有字段重名 → 抛 FlexTreeError", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    await expect(manager.toList({ countField: "name" })).rejects.toBeInstanceOf(FlexTreeError);
    await expect(manager.toList({ countField: "title" })).rejects.toBeInstanceOf(FlexTreeError);
    await expect(manager.toJson({ countField: "level" })).rejects.toBeInstanceOf(FlexTreeError);
  });
});

describe("countField：读取 API（get/find 族）", () => {
  test("getDescendants：每条数据附加 count", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const nodes = (await manager.getDescendants(undefined, {
      countField: "count",
    })) as any[];
    expect(countOf(nodes, "R")).toBe(4);
    expect(countOf(nodes, "A")).toBe(2);
    expect(countOf(nodes, "A2")).toBe(0);
  });

  test("getDescendants 的 level 参数不影响 count", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const aId = await idOf(manager, "A");
    const nodes = (await manager.getDescendants(aId, {
      level: 1,
      countField: "count",
    })) as any[];
    // 只返回 A1/A2，但各自 count 为 0（叶子），无歧义；
    const r = await manager.getRoot({ countField: "count" });
    expect((r as any).count).toBe(4); // 根的全量后代
  });

  test("getNodes：fields 过滤未含 l/r 时计算后剥离，不泄漏", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const nodes = (await manager.getNodes({
      fields: ["name"],
      countField: "count",
    })) as any[];
    const r = nodes.find((n: any) => n.name === "R");
    expect(r.count).toBe(4);
    expect(r.leftValue).toBeUndefined(); // 临时追加的 l/r 已剥离
    expect(r.rightValue).toBeUndefined();
  });

  test("getNodes：fields 已含 l/r 时保留（调用方显式要的）", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const nodes = (await manager.getNodes({
      fields: ["name", "leftValue", "rightValue"],
      countField: "count",
    })) as any[];
    const r = nodes.find((n: any) => n.name === "R");
    expect(r.count).toBe(4);
    expect(r.leftValue).toBe(1);
  });

  test("getChildren / getSiblings / getAncestors / getParent / getRoot", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const aId = await idOf(manager, "A");

    const children = (await manager.getChildren(aId, { countField: "count" })) as any[];
    expect(children.length).toBe(2);
    expect(children.every((c: any) => c.count === 0)).toBe(true);

    const siblings = (await manager.getSiblings(aId, { countField: "count" })) as any[];
    expect(siblings.length).toBe(1); // B
    expect((siblings[0] as any).count).toBe(0);

    const ancestors = (await manager.getAncestors(aId, { countField: "count" })) as any[];
    expect(ancestors.length).toBe(1); // R
    expect((ancestors[0] as any).count).toBe(4);

    const parent = (await manager.getParent(aId, { countField: "count" })) as any;
    expect(parent.count).toBe(4);

    const root = (await manager.getRoot({ countField: "count" })) as any;
    expect(root.count).toBe(4);
  });

  test("getNode / getNthChild / getNextSibling / getPreviousSibling", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const aId = await idOf(manager, "A");
    const bId = await idOf(manager, "B");

    const node = (await manager.getNode(aId, { countField: "count" })) as any;
    expect(node.count).toBe(2);

    const first = (await manager.getNthChild(aId, 1, { countField: "count" })) as any;
    expect(first.name).toBe("A1");
    expect(first.count).toBe(0);

    const next = (await manager.getNextSibling(aId, { countField: "count" })) as any;
    expect(next.name).toBe("B");
    expect(next.count).toBe(0);

    const prev = (await manager.getPreviousSibling(bId, { countField: "count" })) as any;
    expect(prev.name).toBe("A");
    expect(prev.count).toBe(2);
  });

  test("findNodes / findNode", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const nodes = (await manager.findNodes({ name: "A" }, { countField: "count" })) as any[];
    expect(nodes.length).toBe(1);
    expect(nodes[0].count).toBe(2);

    const node = (await manager.findNode({ name: "R" }, { countField: "count" })) as any;
    expect(node.count).toBe(4);
  });

  test("一致性锚点：默认视角下 count ≡ getDescendantCount(node, {level:0})", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    for (const name of ["R", "A", "A1", "B"]) {
      const nodeId = await idOf(manager, name);
      const node = (await manager.getNode(nodeId, { countField: "count" })) as any;
      const count = await manager.getDescendantCount(nodeId);
      expect(node.count).toBe(count);
    }
  });
});

describe("countField：回收站可见口径", () => {
  test("默认视角：根节点 count 扣减 Bin 子树（含 Bin 自身）", async () => {
    const manager = await createRecycleManager();
    await buildTree(manager);
    const aId = await idOf(manager, "A");
    // 回收 A 子树（A + A1 + A2 = 3 节点）→ Bin 子树规模 = 3
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
    // 可见树只剩 R、B；物理上 root 还有 Bin(含 3 个被回收节点)
    const root = (await manager.getRoot({ countField: "count" })) as any;
    expect(root.count).toBe(1); // 物理 (right-left-1)/2 = 5（含 bin3 + B1），扣 bin 3+自身1 → 4-3=1
    const b = (await manager.findNode({ name: "B" }, { countField: "count" })) as any;
    expect(b.count).toBe(0);
  });

  test("includeRecyclebin=true：不扣减，count 为物理值", async () => {
    const manager = await createRecycleManager();
    await buildTree(manager);
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
    const nodes = (await manager.getNodes({
      includeRecyclebin: true,
      countField: "count",
    })) as any[];
    const root = nodes.find((n: any) => n.name === "R");
    // 物理全集：R 后代 = B + Bin + 3 被回收 = 5
    expect(root.count).toBe(5);
  });

  test("toJson 默认视角与导出内容同口径", async () => {
    const manager = await createRecycleManager();
    await buildTree(manager);
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
    const json = (await manager.toJson({ countField: "count" })) as any;
    // 可见树：R → B；R 的 count = 1 与可见后代一致
    expect(json.count).toBe(1);
    expect(json.children.length).toBe(1); // 只剩 B
    // 一致性锚点同样成立
    const rootId = await idOf(manager, "R");
    expect(json.count).toBe(await manager.getDescendantCount(rootId));
  });

  test("未启用回收站：无 Bin 查询开销路径，count 即物理值", async () => {
    const manager = await createPlainManager();
    await buildTree(manager);
    const root = (await manager.getRoot({ countField: "count" })) as any;
    expect(root.count).toBe(4);
  });
});

describe("countField：MultiRootFlexTreeManager", () => {
  async function createMM(withRecycle = false) {
    FlexTreeManager.clearInstance(); // 测试间清理单例，避免 adapter 校验抛错
    driver = new BunSqliteAdapter();
    await driver.open();
    await driver.exec([
      `CREATE TABLE IF NOT EXISTS tree (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(60),
          treeId INTEGER,
          level INTEGER,
          leftValue INTEGER,
          rightValue INTEGER
      );`,
      `DELETE FROM tree`,
    ]);
    const mm = new MultiRootFlexTreeManager("tree", {
      adapter: driver,
      ...(withRecycle ? { recyclebin: { id: BIN_ID, name: "__recyclebin__" } } : {}),
    });
    await mm.load();
    // 两个用户根：R1(a1, a2)、R2
    await mm.write(async () => {
      await mm.addNodes([{ name: "R1" }, { name: "R2" }] as any, null, FlexNodeRelPosition.LastChild);
      const r1 = await mm.findNode({ name: "R1" });
      await mm.addNodes([{ name: "a1" }, { name: "a2" }] as any, r1!.id, FlexNodeRelPosition.LastChild);
    });
    return mm;
  }

  test("toJson：多根数组各节点附加 count", async () => {
    const mm = await createMM();
    const json = (await mm.toJson({ countField: "count" })) as any[];
    const r1 = json.find((n: any) => n.name === "R1");
    const r2 = json.find((n: any) => n.name === "R2");
    expect(r1.count).toBe(2); // a1, a2
    expect(r2.count).toBe(0);
    expect(r1.children[0].count).toBe(0);
  });

  test("toList：附加 count 且 pid/level 归一化不受影响", async () => {
    const mm = await createMM();
    const list = (await mm.toList({ countField: "count" })) as any[];
    expect(countOf(list, "R1")).toBe(2);
    expect(countOf(list, "R2")).toBe(0);
    const r1 = list.find((n: any) => n.name === "R1");
    expect(r1.pid).toBe(0); // 用户根 pid=0，不泄漏隐藏根 id
  });

  test("get 族透传 countField", async () => {
    const mm = await createMM();
    const r1 = await mm.findNode({ name: "R1" });
    const children = (await mm.getChildren(r1!.id, { countField: "count" })) as any[];
    expect(children.every((c: any) => c.count === 0)).toBe(true);
    const nodes = (await mm.getNodes({ countField: "count" })) as any[];
    expect(countOf(nodes, "R1")).toBe(2);
  });

  test("回收站启用：用户根的 count 不含被回收内容（Bin 挂隐藏根下）", async () => {
    const mm = await createMM(true);
    const r1 = await mm.findNode({ name: "R1" });
    await mm.write(async () => {
      await mm.deleteNode(r1!.id, { recycle: true });
    });
    const json = (await mm.toJson({ countField: "count" })) as any[];
    // 可见多根：只剩 R2；R2 的 count = 0，未被 R1 的回收内容污染
    const r2 = json.find((n: any) => n.name === "R2");
    expect(r2.count).toBe(0);
    expect(json.find((n: any) => n.name === "R1")).toBeUndefined();
  });
});

describe("countField：直连 FlexTree（内存树导出）", () => {
  test("load 后 toJson({countField})：默认视角与导出内容同口径（扣减 Bin）", async () => {
    // 直连 new FlexTree(...) 的用户不走 manager.toJson——load 时须自动预取 Bin 区间
    FlexTreeManager.clearInstance(); // 测试间清理单例，避免 adapter 校验抛错
    driver = new BunSqliteAdapter();
    await driver.open();
    await driver.exec([
      `CREATE TABLE IF NOT EXISTS tree (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(60),
          treeId INTEGER,
          level INTEGER,
          leftValue INTEGER,
          rightValue INTEGER
      );`,
      `DELETE FROM tree`,
    ]);
    const manager = new FlexTreeManager("tree", {
      adapter: driver,
      recyclebin: { id: BIN_ID, name: "__recyclebin__" },
    });
    await buildTree(manager);
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });

    const tree = new FlexTree("tree", {
      adapter: driver,
      recyclebin: { id: BIN_ID, name: "__recyclebin__" },
    });
    await tree.load();
    const json = tree.toJson({ countField: "count" }) as any;
    // 可见树：R → B；R 的 count = 1（物理 5 扣减 Bin 子树 3 + Bin 自身 1）
    expect(json.count).toBe(1);
    expect(json.children.length).toBe(1);

    const list = tree.toList({ countField: "count" }) as any[];
    expect(countOf(list, "R")).toBe(1);
  });

  test("未启用回收站：load 后 toJson({countField}) 为物理值", async () => {
    FlexTreeManager.clearInstance(); // 测试间清理单例，避免 adapter 校验抛错
    driver = new BunSqliteAdapter();
    await driver.open();
    await driver.exec([
      `CREATE TABLE IF NOT EXISTS tree (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(60),
          treeId INTEGER,
          level INTEGER,
          leftValue INTEGER,
          rightValue INTEGER
      );`,
      `DELETE FROM tree`,
    ]);
    const manager = new FlexTreeManager("tree", { adapter: driver });
    await buildTree(manager);

    const tree = new FlexTree("tree", { adapter: driver });
    await tree.load();
    const json = tree.toJson({ countField: "count" }) as any;
    expect(json.count).toBe(4);
  });
});
