// sqljs 适配器 + FlexTreeManager 集成冒烟测试（bun test，串行执行）
import { describe, test, expect, beforeEach } from "bun:test";
import initSqlJs from "sql.js";
import { FlexTreeManager, FlexNodeRelPosition } from "flextree";
import FlexTreeSqljsAdapter, { FlexTreeSqljsPersistError } from "../src";

let SQL: Awaited<ReturnType<typeof initSqlJs>>;

beforeEach(async () => {
  SQL = await initSqlJs();
});

const CREATE_TABLE = `
  CREATE TABLE tree (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(60),
      treeId INTEGER,
      level INTEGER,
      leftValue INTEGER,
      rightValue INTEGER
  );
`;

async function createTree(options?: ConstructorParameters<typeof FlexTreeSqljsAdapter>[1]) {
  const db = new SQL.Database();
  const adapter = new FlexTreeSqljsAdapter(db, options);
  const tree = new FlexTreeManager("tree", { adapter, singleton: false });
  await adapter.exec(CREATE_TABLE);
  // createRoot 也是写操作：onPersist 抛错的用例在建根阶段就会 reject，须吞掉继续
  await tree
    .write(async (t) => {
      await t.createRoot({ name: "root" });
    })
    .catch(() => {});
  const root = await tree.getRoot();
  return { tree, adapter, rootId: root.id as number };
}

describe("FlexTreeManager + sqljs 适配器集成", () => {
  test("建树与读树", async () => {
    const { tree, rootId } = await createTree();
    const root = await tree.getNode(rootId);
    expect(root).not.toBeNull();
    expect(root.name).toBe("root");
    expect(root.leftValue).toBe(1);
    expect(root.rightValue).toBe(2);
    expect(root.level).toBe(0);
  });

  test("增删改完整链路", async () => {
    const { tree, rootId } = await createTree();
    await tree.write(async (t) => {
      await t.addNodes([{ name: "a" }, { name: "b" }], rootId, FlexNodeRelPosition.LastChild);
    });
    let children = await tree.getChildren(rootId);
    expect(children).toHaveLength(2);
    expect(children[0].name).toBe("a");

    await tree.write(async (t) => {
      await t.deleteNode(children[0]);
    });
    children = await tree.getChildren(rootId);
    expect(children).toHaveLength(1);

    await tree.write(async (t) => {
      await t.update({ id: children[0].id, name: "b2" });
    });
    const updated = await tree.getChildren(rootId);
    expect(updated[0].name).toBe("b2");
  });

  test("write 失败自动回滚（树结构不变）", async () => {
    const { tree, rootId } = await createTree();
    const before = await tree.getChildren(rootId);
    await tree
      .write(async (t) => {
        await t.addNodes([{ name: "x" }], rootId, FlexNodeRelPosition.LastChild);
        throw new Error("boom");
      })
      .catch(() => {});
    const after = await tree.getChildren(rootId);
    expect(after).toEqual(before);
  });

  test("write 内操作经 onPersist 持久化钩子，快照可恢复", async () => {
    let persistCount = 0;
    let snapshotBytes = 0;
    const { tree, adapter, rootId } = await createTree({
      onPersist: (db) => {
        persistCount++;
        snapshotBytes = db.export().byteLength;
      },
    });
    await tree.write(async (t) => {
      await t.addNodes([{ name: "a" }], rootId, FlexNodeRelPosition.LastChild);
    });
    expect(persistCount).toBeGreaterThanOrEqual(1);
    expect(snapshotBytes).toBeGreaterThan(0);
    // 快照恢复出同样的树
    const restored = new SQL.Database(adapter.db.export());
    const adapter2 = new FlexTreeSqljsAdapter(restored);
    const tree2 = new FlexTreeManager("tree", { adapter: adapter2, singleton: false });
    const children = await tree2.getChildren(rootId);
    expect(children.map((c: any) => c.name)).toEqual(["a"]);
  });

  test("onPersist 抛错上抛为 FlexTreeSqljsPersistError 且内存已提交", async () => {
    const { tree, rootId } = await createTree({
      onPersist: () => {
        throw new Error("QuotaExceeded");
      },
    });
    let caught: unknown;
    await tree
      .write(async (t) => {
        await t.addNodes([{ name: "a" }], rootId, FlexNodeRelPosition.LastChild);
      })
      .catch((e) => (caught = e));
    expect(caught).toBeInstanceOf(FlexTreeSqljsPersistError);
    // 内存已提交：数据可读
    const children = await tree.getChildren(rootId);
    expect(children.map((c: any) => c.name)).toEqual(["a"]);
  });

  test("验证树结构（verify 返回 true）", async () => {
    const { tree, rootId } = await createTree();
    await tree.write(async (t) => {
      await t.addNodes([{ name: "a" }], rootId, FlexNodeRelPosition.LastChild);
    });
    const a = (await tree.getChildren(rootId))[0];
    await tree.write(async (t) => {
      await t.addNodes([{ name: "a1" }], a.id, FlexNodeRelPosition.LastChild);
    });
    expect(await tree.verify()).toBe(true);
  });
});
