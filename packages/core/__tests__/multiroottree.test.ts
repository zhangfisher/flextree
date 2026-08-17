/**
 * MultiRootFlexTree 多根内存树测试
 *
 * 设计依据 CONTEXT.md「Multi-Root Memory Tree」与 ADR-0007：
 * - 直连 MultiRootFlexTreeManager（单例）：数据无隐藏根、level 已归一化
 * - .nodes 返回用户根节点实例；用户根 parent=undefined、root=自身、siblings=其余用户根
 * - load 全量组装（Q13b）：空树合法（nodes=[]、status='loaded'）
 * - status 按根聚合：error > loading > idle > loaded
 * - getByPath 首段在用户根中匹配；'/' 与 '../' 返回 undefined
 * - Live Tree 全套：提交置脏自动重载、回滚不置脏（F1 回归）、recycle 置脏（F2 回归）
 * - lazy：load 只建到根下第一层
 * - toJson 多根嵌套数组 / toList 用户根 pid=0
 * - 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  MultiRootFlexTree,
  MultiRootFlexTreeManager,
  FlexTreeManager,
  FlexTreeError,
  FlexTreeNotFoundError,
} from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

interface TestFields {
  title: string;
}

let driver: BunSqliteAdapter;
let manager: MultiRootFlexTreeManager<TestFields>;
let tree: MultiRootFlexTree<TestFields>;

beforeEach(async () => {
  FlexTreeManager.clearInstance();
  MultiRootFlexTreeManager.clearInstance();
  MultiRootFlexTree.clearInstance();
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
        title VARCHAR(60)
    );`,
    `DELETE FROM tree`,
    `CREATE TABLE IF NOT EXISTS tree2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(60),
        treeId INTEGER,
        level INTEGER,
        leftValue INTEGER,
        rightValue INTEGER,
        title VARCHAR(60)
    );`,
    `DELETE FROM tree2`,
  ]);
  manager = MultiRootFlexTreeManager.getInstance<TestFields>("tree", { adapter: driver });
  await manager.load();
  // 预置数据：根A(子A1,A2)、根B(子B1)、根C
  await manager.write(async () => {
    await manager.addNodes([{ id: 2, name: "A", title: "Root A" }] as any);
    await manager.addNodes(
      [{ id: 3, name: "A1", title: "Child A1" }, { id: 4, name: "A2", title: "Child A2" }] as any,
      2,
    );
    await manager.addNodes([{ id: 5, name: "B", title: "Root B" }] as any);
    await manager.addNodes([{ id: 6, name: "B1", title: "Child B1" }] as any, 5);
    await manager.addNodes([{ id: 7, name: "C", title: "Root C" }] as any);
  });
  tree = new MultiRootFlexTree<TestFields>("tree", { adapter: driver });
  await tree.load();
});

describe("MultiRootFlexTree 基础", () => {
  test("与同表 getInstance 的 MultiRootFlexTreeManager 共享实例", () => {
    expect(tree.manager).toBe(manager);
  });

  test("id 恒为 undefined（多根树禁 treeId）", () => {
    expect(tree.id).toBeUndefined();
  });

  test(".nodes 返回用户根节点实例列表（FlexTreeNode）", () => {
    expect(tree.nodes.length).toBe(3);
    expect(tree.nodes.map((n) => n.name)).toEqual(["A", "B", "C"]);
    expect(tree.nodes[0].constructor.name).toBe("FlexTreeNode");
  });

  test("root 恒为 undefined（无单根）", () => {
    expect(tree.root).toBeUndefined();
  });

  test("status：已加载为 loaded", () => {
    expect(tree.status).toBe("loaded");
  });

  test("load 前 status=idle、nodes 为空", async () => {
    MultiRootFlexTree.clearInstance();
    FlexTreeManager.clearInstance();
    MultiRootFlexTreeManager.clearInstance();
    const fresh = new MultiRootFlexTree<TestFields>("tree2", { adapter: driver });
    expect(fresh.status).toBe("idle");
    expect(fresh.nodes).toEqual([]);
  });

  test("空树 load 合法：nodes=[]、status=loaded", async () => {
    await manager.write(async () => {
      await manager.clear();
    });
    await tree.load();
    expect(tree.nodes).toEqual([]);
    expect(tree.status).toBe("loaded");
  });

  test("dirty 初始为 false，load 后清除", () => {
    expect(tree.dirty).toBe(false);
  });
});

describe("节点导航语义", () => {
  test("用户根 parent=undefined", () => {
    for (const root of tree.nodes) {
      expect(root.parent).toBeUndefined();
    }
  });

  test("用户根 root=自身", () => {
    for (const root of tree.nodes) {
      expect(root.root).toBe(root);
    }
  });

  test("用户根 siblings=其余用户根", () => {
    const a = tree.nodes[0];
    expect(a.siblings?.map((n) => n.name)).toEqual(["B", "C"]);
  });

  test("非根节点 root=所在用户根、parent 正确", () => {
    const a1 = tree.get(3)!;
    expect(a1.name).toBe("A1");
    expect(a1.root).toBe(tree.nodes[0]);
    expect(a1.parent?.name).toBe("A");
    expect(a1.siblings?.map((n) => n.name)).toEqual(["A2"]);
    expect(a1.ancestors.map((n) => n.name)).toEqual(["A"]);
  });

  test("level 已归一化：用户根=0、子节点=1", () => {
    expect(tree.nodes[0].level).toBe(0);
    expect(tree.get(3)!.level).toBe(1);
  });

  test("descendants 在根内正确", () => {
    expect(tree.nodes[0].descendants.map((n) => n.name)).toEqual(["A1", "A2"]);
    expect(tree.nodes[2].descendants).toEqual([]);
  });
});

describe("get / find / findAll / forEach", () => {
  test("get 按 id 跨根查找", () => {
    expect(tree.get(6)!.name).toBe("B1");
    expect(tree.get(999)).toBeUndefined();
  });

  test("get 按条件查找（含根自身）", () => {
    expect(tree.get((n) => n.name === "C")!.name).toBe("C");
    expect(tree.get((n) => n.name === "A1")!.id).toBe(3);
  });

  test("find/findAll 覆盖全部用户树", () => {
    expect(tree.findAll((n) => n.level === 0).length).toBe(3);
    expect(tree.findAll((n) => n.name.startsWith("A")).map((n) => n.name)).toEqual([
      "A",
      "A1",
      "A2",
    ]);
    expect(tree.find((n) => n.name === "B1")!.id).toBe(6);
  });

  test("forEach 遍历全部用户树（回调含根、parent=undefined）", () => {
    const visited: string[] = [];
    tree.forEach((node) => {
      visited.push(node.name);
    });
    expect(visited).toEqual(["A", "A1", "A2", "B", "B1", "C"]);
  });
});

describe("getByPath / update", () => {
  test("首段在用户根中匹配", () => {
    expect(tree.getByPath("A")!.name).toBe("A");
    expect(tree.getByPath("B/B1")!.name).toBe("B1");
    expect(tree.getByPath("A/A1")!.id).toBe(3);
  });

  test("'./' 前缀等价无前缀", () => {
    expect(tree.getByPath("./A/A2")!.id).toBe(4);
  });

  test("'/' 无根锚点返回 undefined", () => {
    expect(tree.getByPath("/")).toBeUndefined();
    expect(tree.getByPath("/A")).toBeUndefined();
  });

  test("'../' 无父级可上溯返回 undefined", () => {
    expect(tree.getByPath("../A")).toBeUndefined();
  });

  test("路径不存在返回 undefined", () => {
    expect(tree.getByPath("X")).toBeUndefined();
    expect(tree.getByPath("A/X")).toBeUndefined();
  });

  test("byField 自定义路径字段（id 为数字型，路径段按字符串比较须传字符串字段）", () => {
    expect(tree.getByPath("Root A", { byField: "title" })!.name).toBe("A");
  });

  test("update 按路径更新（含内存同步刷新）", async () => {
    await tree.update("A/A1", { title: "new title" } as any);
    expect(tree.get(3)!.fields.title).toBe("new title");
    // 数据库侧生效
    const row = await driver.getRows(`SELECT title FROM tree WHERE id=3`);
    expect(row[0].title).toBe("new title");
  });

  test("update 路径不存在抛 FlexTreeNotFoundError", async () => {
    await expect(tree.update("A/X", { title: "x" } as any)).rejects.toThrow(
      FlexTreeNotFoundError,
    );
  });
});

describe("lazy 懒加载", () => {
  test("lazy load 只建到根下第一层，深层按需加载", async () => {
    // 重建带孙节点的数据：A/A1/A1-1
    await manager.write(async () => {
      await manager.addNodes([{ id: 8, name: "A1-1" }] as any, 3);
    });
    MultiRootFlexTree.clearInstance();
    const lazyTree = new MultiRootFlexTree<TestFields>("tree", { adapter: driver, lazy: true });
    expect(lazyTree.lazy).toBe(true);
    await lazyTree.load();
    // 根及其一级子节点已加载（A1 自身数据在列，children=[] 表示子未加载）
    const a1 = lazyTree.getByPath("A/A1")!;
    expect(a1.status).toBe("loaded");
    expect(a1.children).toEqual([]);
    // 未加载的孙节点不可见
    expect(lazyTree.getByPath("A/A1/A1-1")).toBeUndefined();
    // 按需加载后可见
    await a1.load();
    expect(a1.children!.map((n) => n.name)).toEqual(["A1-1"]);
  });

  test("同表懒/非懒树是不同实例", () => {
    const t1 = MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver });
    const t2 = MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver, lazy: true });
    expect(t1).not.toBe(t2);
    expect(MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver })).toBe(t1);
  });
});

describe("Live Tree", () => {
  test("外部 manager 写提交后自动置脏并重载", async () => {
    await manager.write(async () => {
      await manager.addNodes([{ name: "D" }] as any);
    });
    // 自动重载是 fire-and-forget，等一轮微任务
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false); // 重载完成
    expect(tree.nodes.map((n) => n.name)).toEqual(["A", "B", "C", "D"]);
  });

  test("外部写删除根后重载反映结构变化", async () => {
    await manager.write(async () => {
      await manager.deleteNode(2);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.nodes.map((n) => n.name)).toEqual(["B", "C"]);
  });

  test("回滚不置脏（F1 回归：write:after 携带 committed）", async () => {
    const before = tree.nodes.map((n) => n.name);
    await manager
      .write(async () => {
        await manager.addNodes([{ name: "D" }] as any);
        throw new Error("boom"); // 触发回滚
      })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false);
    expect(tree.nodes.map((n) => n.name)).toEqual(before);
  });

  test("自身 update 不触发重载（写路径已同步刷新）", async () => {
    await tree.update("A", { title: "self" } as any);
    expect(tree.dirty).toBe(false);
    expect(tree.get(2)!.fields.title).toBe("self");
  });

  test("manager.clear 后自动重载以空树收场（不保持脏）", async () => {
    await manager.write(async () => {
      await manager.clear();
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false);
    expect(tree.nodes).toEqual([]);
    expect(tree.status).toBe("loaded");
  });
});

describe("Live Tree：回收站（F2 回归）", () => {
  let rbManager: MultiRootFlexTreeManager<TestFields>;
  let rbTree: MultiRootFlexTree<TestFields>;

  beforeEach(async () => {
    FlexTreeManager.clearInstance();
    MultiRootFlexTreeManager.clearInstance();
    MultiRootFlexTree.clearInstance();
    await driver.exec([`DELETE FROM tree`]);
    rbManager = MultiRootFlexTreeManager.getInstance<TestFields>("tree", {
      adapter: driver,
      recyclebin: { id: 999, name: "__bin__" },
    });
    await rbManager.load();
    await rbManager.write(async () => {
      await rbManager.addNodes([{ id: 2, name: "A" }] as any);
      await rbManager.addNodes([{ id: 3, name: "A1" }] as any, 2);
      await rbManager.addNodes([{ id: 5, name: "B" }] as any);
    });
    rbTree = new MultiRootFlexTree<TestFields>("tree", { adapter: driver });
    await rbTree.load();
  });

  test("回收删除（node:recycled）触发置脏重载", async () => {
    await rbManager.write(async () => {
      await rbManager.deleteNode(3, { recycle: true });
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(rbTree.dirty).toBe(false); // 重载完成
    // 回收站内容逻辑不存在：内存树查不到
    expect(rbTree.get(3)).toBeUndefined();
  });

  test("toJson countField 可见口径：被回收节点不计入", async () => {
    await rbManager.write(async () => {
      await rbManager.deleteNode(3, { recycle: true });
    });
    await rbTree.load();
    const json = rbTree.toJson({ includeKeyFields: true, countField: "count" }) as any[];
    const rootA = json.find((n) => n.name === "A");
    expect(rootA.count).toBe(0); // A1 被回收，不可见口径为 0
  });
});

describe("导出", () => {
  test("toJson 返回多根嵌套数组（level 归一化）", () => {
    const json = tree.toJson({ includeKeyFields: true }) as any[];
    expect(json.length).toBe(3);
    expect(json[0].name).toBe("A");
    expect(json[0].level).toBe(0);
    expect(json[0].children.map((c: any) => c.name)).toEqual(["A1", "A2"]);
  });

  test("toList 用户根 pid=0、level 归一化", () => {
    const list = tree.toList({ includeKeyFields: true }) as any[];
    expect(list.length).toBe(6);
    const a = list.find((n) => n.name === "A");
    expect(a.pid).toBe(0);
    expect(a.level).toBe(0);
    const a1 = list.find((n) => n.name === "A1");
    expect(a1.pid).toBe(2);
    expect(a1.level).toBe(1);
    // 全部 pid 不泄漏隐藏根 id
    const hiddenRoot = list.find((n) => n.name === "__root__");
    expect(hiddenRoot).toBeUndefined();
  });

  test("countField 附加后代数", () => {
    const json = tree.toJson({ includeKeyFields: true, countField: "count" }) as any[];
    expect(json.find((n) => n.name === "A").count).toBe(2);
    expect(json.find((n) => n.name === "C").count).toBe(0);
  });
});

describe("单例机制", () => {
  test("getInstance 同键命中同一实例", () => {
    const t1 = MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver });
    const t2 = MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver });
    expect(t1).toBe(t2);
  });

  test("单例命中但 adapter 不一致抛 FlexTreeError", async () => {
    const another = new BunSqliteAdapter();
    await another.open();
    // 本测试注册同键实例（driver），随后换 adapter 应被校验拒绝
    MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver });
    expect(() =>
      MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: another }),
    ).toThrow(FlexTreeError);
  });

  test("clearInstance 清理指定表的懒/非懒形态", () => {
    MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver });
    MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver, lazy: true });
    MultiRootFlexTree.clearInstance("tree");
    const t = MultiRootFlexTree.getInstance<TestFields>("tree", { adapter: driver });
    expect(t).not.toBe(tree);
  });
});
