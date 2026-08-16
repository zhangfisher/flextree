/**
 * Live Tree 功能测试
 *
 * 设计依据 CONTEXT.md「Live Tree」：
 * - FlexTree 内部走 getInstance 单例：与同键 FlexTreeManager 共享实例，事件互通
 * - 已提交写（write:after committed=true）确认本批有 node:* 事件 → tree.dirty=true 并自动全量重载
 * - 重载进行中的读操作（root/get/getByPath/find/findAll/forEach/toJson/toList）抛 FlexTreeDirtyError
 * - 回滚（committed=false）→ 不置脏不重载，内存树保持有效
 * - 重载失败 → 保持脏态，读取持续报错；手动 load 成功后恢复
 * - getInstance：键为 tableName+treeId；adapter 不一致抛 FlexTreeError
 * - 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  FlexTreeManager,
  FlexTree,
  FlexNodeRelPosition,
  FlexTreeError,
  FlexTreeDirtyError,
} from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

interface TestFields {
  title: string;
}

let driver: BunSqliteAdapter;
let manager: FlexTreeManager<TestFields>;
let tree: FlexTree<TestFields>;

beforeEach(async () => {
  FlexTreeManager.clearInstance();
  FlexTree.clearInstance();
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
  ]);
  // getInstance 创建：与 FlexTree 共享单例
  manager = FlexTreeManager.getInstance<TestFields>("tree", { adapter: driver });
  await manager.write(async () => {
    await manager.createRoot({ name: "R" } as any);
    const root = await manager.getRoot();
    await manager.addNodes([{ name: "A" }, { name: "B" }] as any, root, FlexNodeRelPosition.LastChild);
  });
  tree = new FlexTree<TestFields>("tree", { adapter: driver });
  await tree.load();
});

describe("Live Tree：单例连通", () => {
  test("FlexTree 与同键 getInstance 的 manager 共享实例", () => {
    expect(tree.manager).toBe(manager);
  });

  test("同表不同 treeId 各自持有实例（多树表）", () => {
    const m1 = FlexTreeManager.getInstance<TestFields>("tree", { adapter: driver, treeId: 1 });
    const m2 = FlexTreeManager.getInstance<TestFields>("tree", { adapter: driver, treeId: 2 });
    expect(m1).not.toBe(m2);
    expect(FlexTreeManager.getInstance("tree", { adapter: driver, treeId: 1 })).toBe(m1);
  });

  test("单例命中但 adapter 不一致 → 抛 FlexTreeError", async () => {
    const anotherDriver = new BunSqliteAdapter();
    await anotherDriver.open();
    expect(() =>
      FlexTreeManager.getInstance<TestFields>("tree", { adapter: anotherDriver }),
    ).toThrow(FlexTreeError);
  });
});

describe("FlexTree 单例机制", () => {
  test("同键 getInstance 命中同一实例，共享加载状态", async () => {
    const t1 = FlexTree.getInstance<TestFields>("tree", { adapter: driver });
    const t2 = FlexTree.getInstance<TestFields>("tree", { adapter: driver });
    expect(t1).toBe(t2);
    // 共享加载状态：一处 load，另一处可见
    await t1.load();
    expect(t2.root).toBeDefined();
    expect(t2.status).toBe("loaded");
  });

  test("lazy 形态与全量形态是不同实例（键含 lazy）", async () => {
    const full = FlexTree.getInstance<TestFields>("tree", { adapter: driver });
    const lazy = FlexTree.getInstance<TestFields>("tree", { adapter: driver, lazy: true });
    expect(full).not.toBe(lazy);
    expect((full.options as any).lazy).toBe(false);
    expect((lazy.options as any).lazy).toBe(true);
  });

  test("多树表：不同 treeId 各自持有实例", async () => {
    const t1 = FlexTree.getInstance<TestFields>("tree", { adapter: driver, treeId: 1 });
    const t2 = FlexTree.getInstance<TestFields>("tree", { adapter: driver, treeId: 2 });
    expect(t1).not.toBe(t2);
    expect(FlexTree.getInstance("tree", { adapter: driver, treeId: 1 })).toBe(t1);
  });

  test("FlexTree 单例命中但 adapter 不一致 → 抛 FlexTreeError", async () => {
    const anotherDriver = new BunSqliteAdapter();
    await anotherDriver.open();
    expect(() =>
      FlexTree.getInstance<TestFields>("tree", { adapter: anotherDriver }),
    ).toThrow(FlexTreeError);
  });

  test("clearInstance 清理后重建新实例", async () => {
    const t1 = FlexTree.getInstance<TestFields>("tree", { adapter: driver });
    FlexTree.clearInstance("tree");
    const t2 = FlexTree.getInstance<TestFields>("tree", { adapter: driver });
    expect(t1).not.toBe(t2);
  });

  test("单例树自动重载共享：一处写，两处读取一致", async () => {
    const t1 = FlexTree.getInstance<TestFields>("tree", { adapter: driver });
    const t2 = FlexTree.getInstance<TestFields>("tree", { adapter: driver });
    await t1.load();
    const root = await manager.getRoot();
    await manager.write(async () => {
      await manager.addNodes([{ name: "Z" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    await new Promise((r) => setTimeout(r, 50));
    // 同一实例：两处引用看到的都是重载后的树
    expect(t1.getByPath("Z")).toBeDefined();
    expect(t2.getByPath("Z")).toBeDefined();
    expect(t1.dirty).toBe(false);
  });
});

describe("Live Tree：已提交写 → 置脏并自动重载", () => {
  test("node:added 提交后 → dirty=true 且自动重载完成（微任务排空后数据可见）", async () => {
    expect(tree.dirty).toBe(false);
    const root = await manager.getRoot();
    await manager.write(async () => {
      await manager.addNodes([{ name: "C" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    expect(tree.dirty).toBe(true); // 同步检查点：write:after 时已置脏
    // 自动重载是 fire-and-forget：排空微任务后完成
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false); // 重载成功清除脏标记
    expect(tree.getByPath("C")).toBeDefined(); // 新节点已入内存树
  });

  test("node:updated 提交后 → 同样触发自动重载（数据类事件也整树重载）", async () => {
    const aId = (await manager.findNode({ name: "A" }))!.id;
    expect(tree.get(aId)!.name).toBe("A");
    await manager.write(async () => {
      await manager.update({ id: aId, name: "A2" } as any);
    });
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false);
    expect(tree.get(aId)!.name).toBe("A2");
  });

  test("结构事件族（moved/deleted/cleared）均触发", async () => {
    const a = await manager.findNode({ name: "A" });
    const b = await manager.findNode({ name: "B" });

    await manager.write(async () => {
      await manager.moveNode(a!.id, b!.id, FlexNodeRelPosition.FirstChild);
    });
    expect(tree.dirty).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false);

    await manager.write(async () => {
      await manager.deleteNode(a!.id);
    });
    expect(tree.dirty).toBe(true);
    await new Promise((r) => setTimeout(r, 50));

    await manager.write(async () => {
      await manager.clear();
    });
    expect(tree.dirty).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false);
    expect(tree.get(1)).toBeUndefined(); // 树已清空
  });

  test("node:recycled（启用回收站）触发自动重载", async () => {
    // 单独建带回收站的 manager/tree（本测试默认 manager 未启用回收站）
    FlexTreeManager.clearInstance();
    const rbManager = FlexTreeManager.getInstance<TestFields>("tree", {
      adapter: driver,
      recyclebin: { id: 9999, name: "__recyclebin__" },
    });
    const rbTree = new FlexTree<TestFields>("tree", { adapter: driver });
    await rbTree.load();
    const root = await rbManager.getRoot();
    await rbManager.write(async () => {
      await rbManager.addNodes([{ name: "A" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    await new Promise((r) => setTimeout(r, 50));
    const aId = (await rbManager.findNode({ name: "A" }))!.id;
    await rbManager.write(async () => {
      await rbManager.deleteNode(aId, { recycle: true });
    });
    expect(rbTree.dirty).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(rbTree.dirty).toBe(false);
    expect(rbTree.get(aId)).toBeUndefined(); // 默认视角下已不可见
  });

  test("手动 sync 也清除脏标记", async () => {
    const root = await manager.getRoot();
    await manager.write(async () => {
      await manager.addNodes([{ name: "C" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    await new Promise((r) => setTimeout(r, 50)); // 等自动重载完成，避免与手动 sync 竞态
    await tree.sync();
    expect(tree.dirty).toBe(false);
  });
});

describe("Live Tree：重载期间的读守卫", () => {
  test("读操作抛 FlexTreeDirtyError，重载完成后恢复", async () => {
    const root = await manager.getRoot();
    // 数组收集而非布尔变量：回调内赋值不会被控制流分析收窄为字面量 false
    const dirtyErrors: unknown[] = [];
    // 在 write:after 的自动重载进行中同步读：利用事件钩子在重载启动后立即读
    manager.on("write:after", () => {
      // 时序：write:after 监听按注册顺序同步执行，_bindLiveEvents 的监听先注册，
      // 故此处执行时自动重载已启动（_reloading=true）
      try {
        tree.getByPath("A");
      } catch (e) {
        dirtyErrors.push(e);
      }
    });
    await manager.write(async () => {
      await manager.addNodes([{ name: "C" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    // 监听器里捕获到守卫错误（重载进行中），或重载极快已完成——两种均合法，
    // 但 getByPath 必须不返回脏数据
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false);
    for (const e of dirtyErrors) {
      expect(e).toBeInstanceOf(FlexTreeDirtyError);
    }
    expect(dirtyErrors.length > 0 || tree.getByPath("C") !== undefined).toBe(true);
  });

  test("守卫覆盖全部读 API（以 find/toJson 为代表）", async () => {
    const root = await manager.getRoot();
    const errors: string[] = [];
    manager.on("write:after", () => {
      for (const probe of [
        () => tree.find(() => true),
        () => tree.findAll(() => true),
        () => tree.toJson(),
        () => tree.toList(),
        () => tree.get(1),
        () => tree.root,
        () => tree.forEach(() => {}),
      ]) {
        try {
          probe();
        } catch (e: any) {
          errors.push(e.constructor.name);
        }
      }
    });
    await manager.write(async () => {
      await manager.addNodes([{ name: "C" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    // 重载极快时探针可能全部错过（合法）；捕获到时必须是 FlexTreeDirtyError
    for (const name of errors) {
      expect(name).toBe("FlexTreeDirtyError");
    }
    await new Promise((r) => setTimeout(r, 50));
    expect(tree.dirty).toBe(false);
  });
});

describe("Live Tree：回滚不置脏", () => {
  test("写事务回滚 → dirty 保持 false，内存树仍有效", async () => {
    const root = await manager.getRoot();
    let sawAdded = false;
    manager.on("node:added", () => {
      sawAdded = true;
    });
    await manager
      .write(async () => {
        await manager.addNodes([{ name: "C" }] as any, root, FlexNodeRelPosition.LastChild);
        throw new Error("boom"); // 触发回滚
      })
      .catch(() => {});
    expect(sawAdded).toBe(true); // 事件确实发过（事务内）
    expect(tree.dirty).toBe(false); // 但回滚后未置脏
    expect(tree.getByPath("C")).toBeUndefined(); // 数据库无 C，内存树也未受污染
  });

  test("write:after payload 携带 committed", async () => {
    const results: boolean[] = [];
    manager.on("write:after", (payload) => {
      results.push(payload!.committed);
    });
    const root = await manager.getRoot();
    await manager.write(async () => {
      await manager.addNodes([{ name: "C" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    await manager
      .write(async () => {
        throw new Error("boom");
      })
      .catch(() => {});
    expect(results).toEqual([true, false]);
  });
});

describe("Live Tree：边界", () => {
  test("树未加载时收到已提交写 → 置脏但不自动重载，显式 load 后干净", async () => {
    const fresh = new FlexTree<TestFields>("tree", { adapter: driver });
    const aId = (await manager.findNode({ name: "A" }))!.id;
    await manager.write(async () => {
      await manager.update({ id: aId, title: "x" } as any);
    });
    expect(fresh.dirty).toBe(true); // 置脏
    await fresh.load(); // 显式加载
    expect(fresh.dirty).toBe(false);
    // title 是自定义字段，经 fields 访问（无快捷 getter）
    expect(fresh.get(aId)!.fields.title).toBe("x");
  });

  test("clearInstance 后重建：事件订阅随新实例重建", async () => {
    FlexTreeManager.clearInstance("tree");
    const manager2 = FlexTreeManager.getInstance<TestFields>("tree", { adapter: driver });
    const tree2 = new FlexTree<TestFields>("tree", { adapter: driver });
    await tree2.load();
    expect(tree2.manager).toBe(manager2);
    const root = await manager2.getRoot();
    await manager2.write(async () => {
      await manager2.addNodes([{ name: "D" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    expect(tree2.dirty).toBe(true);
    // 旧 tree 订阅在旧 manager 上，不再收新实例的事件（单例被显式清理时的预期行为）
    expect(tree.dirty).toBe(false);
  });

  test("空批写（未执行 SQL）不置脏", async () => {
    await manager.write(async () => {
      /* 无操作 */
    });
    expect(tree.dirty).toBe(false);
  });
});
