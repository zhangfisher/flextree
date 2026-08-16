/**
 * 回收站功能测试
 *
 * 设计依据 docs/adr/0002-recycle-bin-via-bin-node.md 与 docs/plans/recyclebin-implementation.md：
 * - Logical Invisibility：默认视角下 bin 及其后代在所有 API 中表现为不存在
 * - 数据库端过滤铁律：排除发生在 SQL WHERE（返回行数即最终行数）
 * - 状态跃迁事件：node:deleted(recycled) 仅站外→站内跃迁发出
 * - Bin 位置不变量：恒为根孩子层，跨树迁出禁止
 * - 串行执行（项目约束：测试涉及数据库操作）
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { FlexTreeManager, FlexNodeRelPosition, FlexTreeNodeNotFoundError, FlexTreeError } from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

interface TestFields {
  title: string;
  size: number;
}

let driver: BunSqliteAdapter;

const BIN_ID = 9999;
const BIN_NAME = "__recyclebin__";

/** 创建启用回收站的 manager，预置树：root → A(A1, A2), B */
async function createManager(): Promise<FlexTreeManager<TestFields>> {
  FlexTreeManager.clearInstance(); // 测试间清理单例，避免 toJson/getTree 撞上残留实例
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
  return new FlexTreeManager<TestFields>("tree", {
    adapter: driver,
    recyclebin: { id: BIN_ID, name: BIN_NAME },
  });
}

/** 构建精确结构：root → A(A1, A2), B */
async function buildTree(manager: FlexTreeManager<TestFields>) {
  await manager.write(async () => {
    await manager.createRoot({ name: "R" } as any);
    const root = await manager.getRoot();
    await manager.addNodes([{ name: "A" }, { name: "B" }] as any, root, FlexNodeRelPosition.LastChild);
    const a = await manager.findNode({ name: "A" });
    // 传 id 而非节点对象（旧参数风格下节点对象会被误判为 options 对象——既有行为）
    await manager.addNodes([{ name: "A1" }, { name: "A2" }] as any, a!.id, FlexNodeRelPosition.LastChild);
  });
}

/** 找 id */
async function idOf(manager: FlexTreeManager<TestFields>, name: string) {
  const n = await manager.findNode({ name }, { includeRecyclebin: true });
  if (!n) throw new Error(`node ${name} not found`);
  return n.id;
}

describe("回收站：配置与生命周期", () => {
  test("未配置 recyclebin：recycle=true 等同物理删除，clearRecycleBin 静默返回", async () => {
    await createManager();
    // 重建一个未配置的 manager（同一张表）
    const plain = new FlexTreeManager<TestFields>("tree", { adapter: driver });
    await buildTree(plain);
    const aId = await idOf(plain, "A");
    await plain.write(async () => {
      await plain.deleteNode(aId, { recycle: true });
    });
    expect(await plain.findNode({ name: "A" })).toBeNull();
    // 表里也不存在（物理删除）
    const all = await plain.getNodes();
    expect(all.find((n: any) => n.name === "A")).toBeUndefined();
    await plain.write(async () => {
      await plain.clearRecycleBin(); // 静默
    });
  });

  test("首次 write() 时 bin 自动创建（根的子节点，id/name 按配置）", async () => {
    const manager = await createManager();
    // 一次 write 建根：ensure 在 fn 后运行，同事务内即创建 bin
    await manager.write(async () => {
      await manager.createRoot({ name: "R" } as any);
    });
    const bin = await manager.getNode(BIN_ID, { includeRecyclebin: true });
    expect(bin).toBeDefined();
    expect((bin as any).name).toBe(BIN_NAME);
    expect((bin as any).level).toBe(1); // 根孩子层
  });

  test("表中已存在同 id 行但不在根孩子层（level≠1）→ 抛配置错误", async () => {
    await createManager();
    // 全程用未启用回收站的 plain 建树并把 bin 预置于 A 下（level=2），
    // 避免 ensure-after-fn 提前在根下创建 bin
    const plain = new FlexTreeManager<TestFields>("tree", { adapter: driver });
    await plain.write(async () => {
      await plain.createRoot({ name: "R" } as any);
      const root = await plain.getRoot();
      await plain.addNodes([{ name: "A" }] as any, root, FlexNodeRelPosition.LastChild);
    });
    await plain.write(async () => {
      const a = await plain.findNode({ name: "A" });
      await plain.addNodes([{ id: BIN_ID, name: BIN_NAME }] as any, a!.id, FlexNodeRelPosition.LastChild);
    });
    // 新 manager 实例首次 write 校验失败（位置不变量）
    const manager2 = new FlexTreeManager<TestFields>("tree", {
      adapter: driver,
      recyclebin: { id: BIN_ID, name: BIN_NAME },
    });
    await expect(
      manager2.write(async () => {
        await manager2.addNodes([{ name: "X" }] as any, null, FlexNodeRelPosition.LastChild);
      }),
    ).rejects.toThrow();
  });
});

describe("回收站：deleteNode(recycle)", () => {
  let manager: FlexTreeManager<TestFields>;
  beforeEach(async () => {
    manager = await createManager();
    await buildTree(manager);
  });

  test("recycle=true：子树移入 bin，默认视角消失，includeRecyclebin=true 可见", async () => {
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
    // 默认视角：A/A1/A2/bin 全部查不到
    expect(await manager.findNode({ name: "A" })).toBeNull();
    expect(await manager.findNode({ name: "A1" })).toBeNull();
    await expect(manager.getNode(aId)).rejects.toThrow(FlexTreeNodeNotFoundError);
    const nodes = await manager.getNodes();
    expect(nodes.length).toBe(2); // R + B
    // 回收站视角：bin + A + A1 + A2 + R + B 全在
    const all = await manager.getNodes({ includeRecyclebin: true });
    expect(all.length).toBe(6);
    // 结构保持：A 仍是 A1/A2 的父节点
    const a = await manager.getNode(aId, { includeRecyclebin: true });
    const children = await manager.getChildren(a, { includeRecyclebin: true });
    expect(children.length).toBe(2);
  });

  test("recycle=true 的事件序列：node:deleted(recycled) + node:recycled", async () => {
    const events: string[] = [];
    manager.on("node:deleted", (e: any) => events.push(e.recycled ? "deleted(recycled)" : "deleted"));
    manager.on("node:recycled", () => events.push("recycled"));
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
    expect(events).toEqual(["deleted(recycled)", "recycled"]);
  });

  test("默认视角 deleteNode(站内节点) → NotFound；includeRecyclebin=true 时物理删除", async () => {
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
    const a1Id = await idOf(manager, "A1");
    await expect(
      manager.write(async () => {
        await manager.deleteNode(a1Id);
      }),
    ).rejects.toThrow(FlexTreeNodeNotFoundError);
    // 进入回收站视角：物理删除（recycle 参数无效）
    await manager.write(async () => {
      await manager.deleteNode(a1Id, { includeRecyclebin: true, recycle: true });
    });
    const all = await manager.getNodes({ includeRecyclebin: true });
    expect(all.find((n: any) => n.name === "A1")).toBeUndefined();
    expect(all.find((n: any) => n.name === "A2")).toBeDefined(); // A2 仍在
  });

  test("deleteNode(bin) ≡ 清空回收站：bin 保留、子孙删除", async () => {
    const aId = await idOf(manager, "A");
    const bId = await idOf(manager, "B");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
      await manager.deleteNode(bId, { recycle: true });
    });
    await manager.write(async () => {
      await manager.deleteNode(BIN_ID);
    });
    const all = await manager.getNodes({ includeRecyclebin: true });
    expect(all.length).toBe(2); // R + bin（bin 保留）
    const bin = await manager.getNode(BIN_ID, { includeRecyclebin: true });
    expect(bin).toBeDefined();
    expect(await manager.verify()).toBe(true);
  });

  test("未启用时 recycle=true → 直接物理删除", async () => {
    const plain = new FlexTreeManager<TestFields>("tree", { adapter: driver });
    const aId = await idOf(manager, "A");
    await plain.write(async () => {
      await plain.deleteNode(aId, { recycle: true });
    });
    const all = await plain.getNodes();
    expect(all.find((n: any) => n.name === "A")).toBeUndefined();
  });
});

describe("回收站：clearRecycleBin", () => {
  test("启用后清空：bin 保留、子树删除、不发事件、verify 通过", async () => {
    const manager = await createManager();
    await buildTree(manager);
    let cleared = 0;
    manager.on("node:cleared", () => cleared++);
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
    await manager.write(async () => {
      await manager.clearRecycleBin();
    });
    const all = await manager.getNodes({ includeRecyclebin: true });
    expect(all.length).toBe(3); // R + B + bin
    expect(cleared).toBe(0);
    expect(await manager.verify()).toBe(true);
  });

  test("未启用：静默", async () => {
    const manager = await createManager();
    await buildTree(manager);
    const plain = new FlexTreeManager<TestFields>("tree", { adapter: driver });
    await plain.write(async () => {
      await plain.clearRecycleBin();
    });
    // plain 未配置 recyclebin：不启用过滤，bin 只是普通节点 → 6 个全可见
    const all = await plain.getNodes();
    expect(all.length).toBe(6);
  });
});

describe("回收站：读接口过滤（Logical Invisibility）", () => {
  let manager: FlexTreeManager<TestFields>;
  beforeEach(async () => {
    manager = await createManager();
    await buildTree(manager);
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
  });

  test("枚举接口默认不含 bin 及其子孙；=true 返回全集", async () => {
    expect((await manager.getNodes()).length).toBe(2);
    expect((await manager.getNodes({ includeRecyclebin: true })).length).toBe(6);
    const root = await manager.getRoot();
    expect((await manager.getChildren(root)).length).toBe(1); // 只有 B
    expect((await manager.getChildren(root, { includeRecyclebin: true })).length).toBe(2); // B + bin
    expect((await manager.getDescendants(root)).length).toBe(1);
    expect((await manager.getDescendants(root, { includeRecyclebin: true })).length).toBe(5);
    expect(await manager.getDescendantCount(root)).toBe(1);
    expect(await manager.getDescendantCount(root, { includeRecyclebin: true })).toBe(5);
  });

  test("DB 端过滤验证：默认视角行数即最终行数（bin 内大量节点不影响）", async () => {
    // 再回收大量节点
    const bId = await idOf(manager, "B");
    await manager.write(async () => {
      await manager.deleteNode(bId, { recycle: true });
    });
    expect((await manager.getNodes()).length).toBe(1); // 只有 R
  });

  test("导航：bin 物理前兄弟的 getNextSibling 默认跳过 bin；=true 返回 bin", async () => {
    const bId = await idOf(manager, "B");
    // B 是 bin 的物理前兄弟（buildTree 后 bin 加在最后）
    const next = await manager.getNextSibling(bId);
    expect(next ?? undefined).toBeUndefined(); // 默认视角：bin 后无节点（getOneNode 空结果返回 null）
    const nextWithBin = await manager.getNextSibling(bId, { includeRecyclebin: true });
    expect((nextWithBin as any)?.name).toBe(BIN_NAME);
    // 反向：bin 的前一个兄弟是 B
    const prev = await manager.getPreviousSibling(BIN_ID, { includeRecyclebin: true });
    expect((prev as any)?.name).toBe("B");
  });

  test("where 组合：默认仍排除 bin 及子孙（AND 叠加）", async () => {
    const nodes = await manager.getNodes({ where: "name LIKE '%'" });
    expect(nodes.length).toBe(2);
  });

  test("toJson / toList 默认不含 bin 及其子孙", async () => {
    const json = await manager.toJson();
    expect(JSON.stringify(json)).not.toContain(BIN_NAME);
    expect(JSON.stringify(json)).not.toContain("A1");
    const jsonAll = await manager.toJson({ includeRecyclebin: true } as any);
    expect(JSON.stringify(jsonAll)).toContain(BIN_NAME);
  });

  test("根.rightValue 为物理值（含 bin 区间），verify 通过", async () => {
    const root = await manager.getRoot();
    const all = await manager.getNodes({ includeRecyclebin: true });
    const maxRight = Math.max(...all.map((n: any) => n.rightValue));
    expect((root as any).rightValue).toBe(maxRight);
    expect(await manager.verify()).toBe(true);
  });

  test("forEach 默认不进入 bin；startFrom=bin 默认视角 NotFound；=true 完整遍历", async () => {
    const visited: string[] = [];
    await manager.forEach((node) => {
      visited.push(node.name);
      return true;
    });
    expect(visited.sort()).toEqual(["B", "R"].sort());
    // startFrom 不改变视角：默认下 bin 即"不存在"→ getNode 抛 NotFound
    await expect(
      manager.forEach(() => true, { startFrom: BIN_ID }),
    ).rejects.toThrow();
    // includeRecyclebin=true：完整遍历（R B bin A A1 A2 = 6）
    const allVisits: string[] = [];
    await manager.forEach((node) => {
      allVisits.push(node.name);
      return true;
    }, { includeRecyclebin: true });
    expect(allVisits.length).toBe(6);
  });

  test("getParent(binChild, 站内视角) 返回 bin（祖先链不过滤）", async () => {
    const aId = await idOf(manager, "A");
    const aNode = await manager.getNode(aId, { includeRecyclebin: true });
    const parent = await manager.getParent(aNode);
    expect((parent as any).name).toBe(BIN_NAME);
  });

  test("getNthChild 默认视角 bin 内孩子不计入序号", async () => {
    const root = await manager.getRoot();
    const first = await manager.getNthChild(root, 1);
    expect((first as any)?.name).toBe("B");
    const firstAll = await manager.getNthChild(root, 1, { includeRecyclebin: true });
    expect((firstAll as any)?.name).toBe("B"); // B 在 bin 前
  });
});

describe("回收站：写接口门控", () => {
  let manager: FlexTreeManager<TestFields>;
  beforeEach(async () => {
    manager = await createManager();
    await buildTree(manager);
    const aId = await idOf(manager, "A");
    await manager.write(async () => {
      await manager.deleteNode(aId, { recycle: true });
    });
  });

  test("默认视角：update/moveNode/copyNode/addNodes 对站内节点（id 路径）→ NotFound", async () => {
    const aId = await idOf(manager, "A");
    const bId = await idOf(manager, "B");
    await expect(
      manager.write(async () => {
        await manager.update({ id: aId, title: "x" } as any);
      }),
    ).rejects.toThrow(FlexTreeNodeNotFoundError);
    await expect(
      manager.write(async () => {
        await manager.moveNode(aId, bId);
      }),
    ).rejects.toThrow(FlexTreeNodeNotFoundError);
    await expect(
      manager.write(async () => {
        await manager.copyNode(aId);
      }),
    ).rejects.toThrow(FlexTreeNodeNotFoundError);
    await expect(
      manager.write(async () => {
        await manager.addNodes([{ name: "X" }] as any, aId);
      }),
    ).rejects.toThrow(FlexTreeNodeNotFoundError);
  });

  test("对象即凭证：传站内节点对象（=true 读到的）→ 照常执行", async () => {
    const aNode = await manager.findNode({ name: "A" }, { includeRecyclebin: true });
    expect(aNode).toBeDefined();
    const bId = await idOf(manager, "B");
    await manager.write(async () => {
      // 对象路径放行（moveNode 恢复前置条件）
      await manager.moveNode(aNode as any, bId, { pos: FlexNodeRelPosition.LastChild });
    });
    // A 已移出 bin，默认视角重新可见
    expect(await manager.findNode({ name: "A" })).not.toBeNull();
  });

  test("手动 moveNode 进 bin（站内视角）：跃迁事件 deleted(recycled)+moved", async () => {
    const events: string[] = [];
    manager.on("node:deleted", (e: any) => events.push(e.recycled ? "deleted(recycled)" : "deleted"));
    manager.on("node:moved", () => events.push("moved"));
    const bId = await idOf(manager, "B");
    await manager.write(async () => {
      await manager.moveNode(bId, BIN_ID, {
        pos: FlexNodeRelPosition.LastChild,
        includeRecyclebin: true,
      });
    });
    expect(events).toEqual(["deleted(recycled)", "moved"]);
    expect(await manager.findNode({ name: "B" })).toBeNull();
  });

  test("站内重排：仅 moved，无 deleted（状态跃迁规则）", async () => {
    const events: string[] = [];
    manager.on("node:deleted", () => events.push("deleted"));
    manager.on("node:moved", () => events.push("moved"));
    // A1 → A2 后面：站内兄弟重排（A 与 A2 是父子关系不可移，用兄弟对）
    const a1Id = await idOf(manager, "A1");
    const a2Id = await idOf(manager, "A2");
    await manager.write(async () => {
      await manager.moveNode(a1Id, a2Id, {
        pos: FlexNodeRelPosition.NextSibling,
        includeRecyclebin: true,
      });
    });
    expect(events).toEqual(["moved"]);
    // 重排后仍在站内：默认视角不可见
    expect(await manager.findNode({ name: "A1" })).toBeNull();
  });

  test("恢复移出：仅 moved，无 deleted；默认视角重新可见", async () => {
    const events: string[] = [];
    manager.on("node:deleted", () => events.push("deleted"));
    manager.on("node:moved", () => events.push("moved"));
    const aId = await idOf(manager, "A");
    const bId = await idOf(manager, "B");
    await manager.write(async () => {
      await manager.moveNode(aId, bId, {
        pos: FlexNodeRelPosition.NextSibling,
        includeRecyclebin: true,
      });
    });
    expect(events).toEqual(["moved"]);
    expect(await manager.findNode({ name: "A" })).not.toBeNull();
  });

  test("canMoveTo 与 moveNode 视角一致", async () => {
    const aId = await idOf(manager, "A");
    const bId = await idOf(manager, "B");
    expect(await manager.canMoveTo(aId, bId)).toBe(false);
    expect(
      await manager.canMoveTo(aId, bId, { includeRecyclebin: true }),
    ).toBe(true);
  });
});

describe("回收站：bin 位置不变量", () => {
  let manager: FlexTreeManager<TestFields>;
  beforeEach(async () => {
    manager = await createManager();
    await buildTree(manager);
  });

  test("moveNode(bin, 根孩子的 sibling 位)：允许（根孩子层内重排）", async () => {
    const bId = await idOf(manager, "B");
    await manager.write(async () => {
      await manager.moveNode(BIN_ID, bId, {
        pos: FlexNodeRelPosition.PreviousSibling,
        includeRecyclebin: true,
      });
    });
    const bin = await manager.getNode(BIN_ID, { includeRecyclebin: true });
    expect((bin as any).level).toBe(1);
  });

  test("moveNode(bin, 根的 LastChild)：允许", async () => {
    const bId = await idOf(manager, "B");
    await manager.write(async () => {
      await manager.moveNode(BIN_ID, bId, {
        pos: FlexNodeRelPosition.NextSibling,
        includeRecyclebin: true,
      });
    });
    const bin = await manager.getNode(BIN_ID, { includeRecyclebin: true });
    expect((bin as any).level).toBe(1);
  });

  test("moveNode(bin, 深层节点)：抛错", async () => {
    const a1Id = await idOf(manager, "A1");
    await expect(
      manager.write(async () => {
        await manager.moveNode(BIN_ID, a1Id, {
          pos: FlexNodeRelPosition.NextSibling,
          includeRecyclebin: true,
        });
      }),
    ).rejects.toThrow(FlexTreeError);
  });

  test("bin 内 addNodes/copyNode/updateNode（站内视角）：照常", async () => {
    const bin = await manager.getNode(BIN_ID, { includeRecyclebin: true });
    await manager.write(async () => {
      await manager.addNodes([{ name: "MANUAL" }] as any, bin, {
        pos: FlexNodeRelPosition.LastChild,
        includeRecyclebin: true,
      });
    });
    const manual = await manager.findNode({ name: "MANUAL" }, { includeRecyclebin: true });
    expect(manual).not.toBeNull();
    await manager.write(async () => {
      await manager.update({ id: (manual as any).id, title: "t" } as any, { includeRecyclebin: true });
    });
  });
});
