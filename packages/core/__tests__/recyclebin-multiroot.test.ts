/**
 * 回收站 × MultiRootFlexTreeManager 集成测试
 *
 * 验证 ADR 0002 的 MultiRoot 后果项：bin 是隐藏根的子节点（用户视角 level=0），
 * 读链路的隐藏根过滤 + level 归一化 + bin 闭区间过滤三者叠加。
 */
import { describe, test, expect } from "bun:test";
import { MultiRootFlexTreeManager, FlexNodeRelPosition } from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

const BIN_ID = 999;

let driver: BunSqliteAdapter;

async function createManager(): Promise<MultiRootFlexTreeManager> {
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
    recyclebin: { id: BIN_ID, name: "__bin__" },
  });
  await mm.load();
  return mm;
}

describe("回收站 × MultiRoot", () => {
  test(".nodes 不含 bin；toJson 多根数组不含 bin 及其子孙", async () => {
    const mm = await createManager();
    await mm.write(async () => {
      await mm.addNodes([{ name: "R1" }, { name: "R2" }] as any, null, FlexNodeRelPosition.LastChild);
    });
    expect(mm.nodes.map((n: any) => n.name).sort()).toEqual(["R1", "R2"]);
    const json = JSON.stringify(await mm.toJson());
    expect(json).not.toContain("__bin__");
    expect(json).toContain("R1");
  });

  test("deleteNode(recycle) 后默认视角消失；站内视角可见；恢复后重新可见", async () => {
    const mm = await createManager();
    await mm.write(async () => {
      await mm.addNodes([{ name: "R1" }, { name: "R2" }] as any, null, FlexNodeRelPosition.LastChild);
    });
    const r1 = await mm.findNode({ name: "R1" });
    await mm.write(async () => {
      await mm.deleteNode(r1!.id, { recycle: true });
    });
    expect(await mm.findNode({ name: "R1" })).toBeNull();
    expect(mm.nodes.map((n: any) => n.name)).toEqual(["R2"]);
    expect(await mm.findNode({ name: "R1" }, { includeRecyclebin: true })).not.toBeNull();
    const json = JSON.stringify(await mm.toJson());
    expect(json).not.toContain("R1");
    // 恢复：站内视角读出 → moveNode 移到 R2 后
    const r1Node = await mm.getNode(r1!.id, { includeRecyclebin: true });
    const r2 = await mm.findNode({ name: "R2" });
    await mm.write(async () => {
      await mm.moveNode(r1Node!.id, r2!.id, {
        pos: FlexNodeRelPosition.NextSibling,
        includeRecyclebin: true,
      });
    });
    expect(await mm.findNode({ name: "R1" })).not.toBeNull();
    expect(await mm.verify()).toBe(true);
  });

  test("clearRecycleBin 透传：清空后 bin 保留", async () => {
    const mm = await createManager();
    await mm.write(async () => {
      await mm.addNodes([{ name: "R1" }] as any, null, FlexNodeRelPosition.LastChild);
    });
    const r1 = await mm.findNode({ name: "R1" });
    await mm.write(async () => {
      await mm.deleteNode(r1!.id, { recycle: true });
    });
    await mm.write(async () => {
      await mm.clearRecycleBin();
    });
    expect(await mm.findNode({ name: "R1" }, { includeRecyclebin: true })).toBeNull();
    expect(await mm.verify()).toBe(true);
  });
});
