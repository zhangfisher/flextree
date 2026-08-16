import { describe, test, expect, beforeEach } from "bun:test";
import {
  MultiRootFlexTreeManager,
  FlexTreeManager,
  HIDDEN_ROOT_NAME,
  FlexNodeRelPosition,
  FlexTreeNodeInvalidOperationError,
  FlexTreeNodeNotFoundError,
  FlexTreeError,
} from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

interface TestFields {
  title: string;
  size: number;
}

let driver: BunSqliteAdapter;

async function createMultiRootManager(): Promise<MultiRootFlexTreeManager<TestFields>> {
  FlexTreeManager.clearInstance(); // 测试间清理单例，避免 getTree 撞上残留实例的 adapter 校验
  driver = new BunSqliteAdapter();
  await driver.open();
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
    `DELETE FROM tree`,
  ]);

  const manager = new MultiRootFlexTreeManager<TestFields>("tree", {
    adapter: driver,
  });
  await manager.load();
  return manager;
}

/**
 * 预置数据：根A(子A1,A2)、根B(子B1)、根C
 */
async function createPopulatedManager(): Promise<MultiRootFlexTreeManager<TestFields>> {
  const manager = await createMultiRootManager();
  await manager.write(async () => {
    await manager.addNodes([{ id: 2, name: "A", title: "Root A" }]);
    await manager.addNodes(
      [
        { id: 3, name: "A1", title: "Child A1" },
        { id: 4, name: "A2", title: "Child A2" },
      ],
      2,
    );
    await manager.addNodes([{ id: 5, name: "B", title: "Root B" }]);
    await manager.addNodes([{ id: 6, name: "B1", title: "Child B1" }], 5);
    await manager.addNodes([{ id: 7, name: "C", title: "Root C" }]);
  });
  return manager;
}

/** 直查物理表，获取隐藏根行 */
async function getHiddenRootRow(): Promise<any> {
  return (await driver.getRows(`SELECT * FROM tree WHERE leftValue=1`))[0];
}

describe("MultiRootFlexTreeManager 多根树测试", () => {
  describe("初始化与 load", () => {
    test("空表 load 自动创建隐藏根（level=0/leftValue=1），.nodes 为空数组", async () => {
      const manager = await createMultiRootManager();
      const hiddenRoot = await getHiddenRootRow();
      expect(hiddenRoot).toBeDefined();
      expect(hiddenRoot.name).toBe(HIDDEN_ROOT_NAME);
      expect(hiddenRoot.level).toBe(0);
      expect(hiddenRoot.leftValue).toBe(1);
      expect(manager.nodes).toEqual([]);
    });

    test("重复调用 load 幂等（不重复建根、.nodes 不变）", async () => {
      const manager = await createPopulatedManager();
      const before = manager.nodes.map((n: any) => n.id);
      await manager.load();
      await manager.load();
      const roots = await driver.getRows(`SELECT * FROM tree WHERE leftValue=1`);
      expect(roots.length).toBe(1);
      expect(manager.nodes.map((n: any) => n.id)).toEqual(before);
    });

    test("传入 treeId 选项时构造函数抛 FlexTreeError", () => {
      expect(() => {
        new MultiRootFlexTreeManager<TestFields>("tree", {
          adapter: driver,
          treeId: 1,
        } as any);
      }).toThrow(FlexTreeError);
    });

    test("外部删除隐藏根后再次 load 自愈重建", async () => {
      const manager = await createPopulatedManager();
      // 外部直接删全表（模拟破坏）
      await driver.exec([`DELETE FROM tree`]);
      await manager.load();
      const hiddenRoot = await getHiddenRootRow();
      expect(hiddenRoot).toBeDefined();
      expect(hiddenRoot.name).toBe(HIDDEN_ROOT_NAME);
      expect(manager.nodes).toEqual([]);
      // 自愈后可继续增根
      await manager.write(async () => {
        await manager.addNodes([{ id: 100, name: "NewRoot" }]);
      });
      expect(manager.nodes.length).toBe(1);
      expect((manager.nodes[0] as any).name).toBe("NewRoot");
    });
  });

  describe(".nodes 根列表缓存", () => {
    test("write 内增根后 .nodes 自动刷新且同步可读", async () => {
      const manager = await createMultiRootManager();
      await manager.write(async () => {
        await manager.addNodes([{ id: 2, name: "A" }]);
        await manager.addNodes([{ id: 3, name: "B" }]);
      });
      expect(manager.nodes.length).toBe(2);
      expect((manager.nodes[0] as any).name).toBe("A");
      expect((manager.nodes[1] as any).name).toBe("B");
    });

    test("读方法调用后 .nodes 引用不变（读不刷新）", async () => {
      const manager = await createPopulatedManager();
      const nodesRef = manager.nodes;
      await manager.getNodes();
      await manager.findNodes({ name: "A" } as any);
      expect(manager.nodes).toBe(nodesRef);
    });

    test("根的 level 显示为 0、leftValue 从 2 开始", async () => {
      const manager = await createPopulatedManager();
      for (const root of manager.nodes) {
        expect((root as any).level).toBe(0);
        expect((root as any).leftValue).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("增加根与节点", () => {
    test("addNodes 无 at 新增用户根（物理 level=1）", async () => {
      const manager = await createMultiRootManager();
      await manager.write(async () => {
        await manager.addNodes([{ id: 2, name: "A" }]);
      });
      const row = (await driver.getRows(`SELECT * FROM tree WHERE id=2`))[0];
      expect(row.level).toBe(1);
      expect(manager.nodes.length).toBe(1);
    });

    test("addNodes 嵌套结构（children）无 at 新增带子树的根", async () => {
      const manager = await createMultiRootManager();
      await manager.write(async () => {
        await manager.addNodes([
          {
            id: 2,
            name: "A",
            children: [
              { id: 3, name: "A1" },
              { id: 4, name: "A2" },
            ],
          },
        ]);
      });
      expect(manager.nodes.length).toBe(1);
      const children = await manager.getChildren(2);
      expect(children.length).toBe(2);
      expect((children[0] as any).name).toBe("A1");
      expect((children[0] as any).level).toBe(1); // 归一化后 A1 为 level 1
    });

    test("addNodes(at: 根id) 在根下追加子节点", async () => {
      const manager = await createPopulatedManager();
      await manager.write(async () => {
        await manager.addNodes([{ id: 8, name: "A3" }], 2);
      });
      const children = await manager.getChildren(2);
      expect(children.length).toBe(3);
      expect((children[2] as any).name).toBe("A3");
    });

    test("addNodes(at: 根id, pos: FirstChild) 插入为首子节点", async () => {
      const manager = await createPopulatedManager();
      await manager.write(async () => {
        await manager.addNodes(
          [{ id: 8, name: "A0" }],
          { at: 2, pos: FlexNodeRelPosition.FirstChild },
        );
      });
      const children = await manager.getChildren(2);
      expect((children[0] as any).name).toBe("A0");
    });
  });

  describe("level 归一化", () => {
    test("getNodes 返回所有用户节点且 level 已 -1（根=0、子=1）", async () => {
      const manager = await createPopulatedManager();
      const nodes = await manager.getNodes();
      // 3 根 + 3 子 = 6，不含隐藏根
      expect(nodes.length).toBe(6);
      const byName = new Map(nodes.map((n: any) => [n.name, n]));
      expect((byName.get("A") as any).level).toBe(0);
      expect((byName.get("A1") as any).level).toBe(1);
      expect((byName.get("B1") as any).level).toBe(1);
      expect((byName.get("C") as any).level).toBe(0);
    });

    test("getNodes({level:1}) 只返回用户根 / {level:2} 返回根+子", async () => {
      const manager = await createPopulatedManager();
      const roots = await manager.getNodes({ level: 1 });
      expect(roots.length).toBe(3);
      expect(roots.every((n: any) => n.level === 0)).toBe(true);

      const two = await manager.getNodes({ level: 2 });
      expect(two.length).toBe(6);
    });

    test("getNode/getChildren/getDescendants/getSiblings 返回数据 level 已归一化", async () => {
      const manager = await createPopulatedManager();
      const node = await manager.getNode(3);
      expect((node as any).level).toBe(1);

      const children = await manager.getChildren(2);
      expect(children.every((n: any) => n.level === 1)).toBe(true);

      const descendants = await manager.getDescendants(2);
      expect(descendants.every((n: any) => n.level === 1)).toBe(true);

      const siblings = await manager.getSiblings(2);
      expect(siblings.every((n: any) => n.level === 0)).toBe(true);
    });

    test("findNodes({level:0}) 命中用户根（条件换算）", async () => {
      const manager = await createPopulatedManager();
      const roots = await manager.findNodes({ level: 0 } as any);
      expect(roots.length).toBe(3);
      expect(roots.every((n: any) => n.level === 0)).toBe(true);
    });

    test("forEach 回调收到归一化 level 且不包含隐藏根", async () => {
      const manager = await createPopulatedManager();
      const visited: any[] = [];
      await manager.forEach((node: any) => {
        visited.push(node);
        return true;
      });
      expect(visited.length).toBe(6);
      expect(visited.some((n) => n.name === HIDDEN_ROOT_NAME)).toBe(false);
      expect(visited.filter((n) => n.level === 0).length).toBe(3);
    });
  });

  describe("隐藏根边界", () => {
    test("getNode(隐藏根真实id) 抛 FlexTreeNodeNotFoundError", async () => {
      const manager = await createPopulatedManager();
      const hiddenRoot = await getHiddenRootRow();
      expect(manager.getNode(hiddenRoot.id)).rejects.toThrow(FlexTreeNodeNotFoundError);
    });

    test("findNodes 结果不含隐藏根（findNode({name:'__root__'}) 为 null）", async () => {
      const manager = await createPopulatedManager();
      const node = await manager.findNode({ name: HIDDEN_ROOT_NAME } as any);
      expect(node).toBeNull();
    });

    test("deleteNode(隐藏根id) 抛 FlexTreeNodeInvalidOperationError", async () => {
      const manager = await createPopulatedManager();
      const hiddenRoot = await getHiddenRootRow();
      await expect(
        manager.write(async () => {
          await manager.deleteNode(hiddenRoot.id);
        }),
      ).rejects.toThrow(FlexTreeNodeInvalidOperationError);
    });

    test("deleteNode(undefined) 抛 FlexTreeNodeInvalidOperationError", async () => {
      const manager = await createPopulatedManager();
      await expect(
        manager.write(async () => {
          await manager.deleteNode(undefined as any);
        }),
      ).rejects.toThrow(FlexTreeNodeInvalidOperationError);
    });

    test("getParent(用户根) 抛 FlexTreeNodeNotFoundError", async () => {
      const manager = await createPopulatedManager();
      await expect(manager.getParent(2)).rejects.toThrow(FlexTreeNodeNotFoundError);
    });

    test("getAncestors(用户根) 返回 []；非根节点祖先不含隐藏根", async () => {
      const manager = await createPopulatedManager();
      const rootAncestors = await manager.getAncestors(2);
      expect(rootAncestors).toEqual([]);

      const childAncestors = await manager.getAncestors(3);
      expect(childAncestors.length).toBe(1);
      expect((childAncestors[0] as any).name).toBe("A");
    });

    test("getAncestorsCount(用户根) === 0；非根 === 物理层数-1", async () => {
      const manager = await createPopulatedManager();
      expect(await manager.getAncestorsCount(2)).toBe(0);
      expect(await manager.getAncestorsCount(3)).toBe(1);
    });

    test("getChildren(null) 返回用户根列表且不含隐藏根", async () => {
      const manager = await createPopulatedManager();
      const children = await manager.getChildren(null as any);
      expect(children.length).toBe(3);
      expect(children.every((n: any) => n.level === 0)).toBe(true);
    });
  });

  describe("根间导航", () => {
    test("getSiblings(根A) 返回 [根B, 根C]（includeSelf 时含自身）", async () => {
      const manager = await createPopulatedManager();
      const siblings = await manager.getSiblings(2);
      expect(siblings.map((n: any) => n.name)).toEqual(["B", "C"]);

      const withSelf = await manager.getSiblings(2, { includeSelf: true });
      expect(withSelf.map((n: any) => n.name)).toEqual(["A", "B", "C"]);
    });

    test("getNextSibling/getPreviousSibling 跨根导航正确", async () => {
      const manager = await createPopulatedManager();
      const next = await manager.getNextSibling(2);
      expect((next as any)?.name).toBe("B");
      const prev = await manager.getPreviousSibling(5);
      expect((prev as any)?.name).toBe("A");
    });

    test("第一个根的 getPreviousSibling 与最后一个根的 getNextSibling 为空", async () => {
      const manager = await createPopulatedManager();
      expect(await manager.getPreviousSibling(2)).toBeFalsy();
      expect(await manager.getNextSibling(7)).toBeFalsy();
    });

    test("moveUpNode(第一个根) 抛 FlexTreeNodeInvalidOperationError", async () => {
      const manager = await createPopulatedManager();
      await expect(
        manager.write(async () => {
          await manager.moveUpNode(2);
        }),
      ).rejects.toThrow(FlexTreeNodeInvalidOperationError);
    });

    test("moveDownNode(最后一个根) 抛 FlexTreeNodeInvalidOperationError", async () => {
      const manager = await createPopulatedManager();
      await expect(
        manager.write(async () => {
          await manager.moveDownNode(7);
        }),
      ).rejects.toThrow(FlexTreeNodeInvalidOperationError);
    });
  });

  describe("跨根移动与复制", () => {
    test("moveNode 将根A的子节点移到根B下（跨根挂载）", async () => {
      const manager = await createPopulatedManager();
      await manager.write(async () => {
        await manager.moveNode(3, 5, FlexNodeRelPosition.LastChild);
      });
      const bChildren = await manager.getChildren(5);
      expect(bChildren.map((n: any) => n.name)).toEqual(["B1", "A1"]);
      expect((bChildren[1] as any).level).toBe(1);
      await manager.verify();
    });

    test("moveNode 将根B 的子节点移到根A 的 NextSibling（变为新根）", async () => {
      const manager = await createPopulatedManager();
      await manager.write(async () => {
        await manager.moveNode(6, 2, FlexNodeRelPosition.NextSibling);
      });
      expect(manager.nodes.map((n: any) => n.name)).toEqual(["A", "B1", "B", "C"]);
      expect((await manager.getNextSibling(2) as any)?.name).toBe("B1");
      await manager.verify();
    });

    test("moveNode 将整棵根A（含子树）移到根B 下变成根B 的子树", async () => {
      const manager = await createPopulatedManager();
      await manager.write(async () => {
        await manager.moveNode(2, 5, FlexNodeRelPosition.LastChild);
      });
      expect(manager.nodes.map((n: any) => n.name)).toEqual(["B", "C"]);
      const bChildren = await manager.getChildren(5);
      expect(bChildren.map((n: any) => n.name)).toEqual(["B1", "A"]);
      expect((bChildren[1] as any).level).toBe(1);
      await manager.verify();
    });

    test("canMoveTo 跨根移动判定（禁止移到自己的后代）", async () => {
      const manager = await createPopulatedManager();
      expect(await manager.canMoveTo(2, 3)).toBe(false); // A 不能移到自己的子 A1 下
      expect(await manager.canMoveTo(3, 5)).toBe(true); // A1 可以移到 B 下
    });

    test("copyNode(根, {to: 某根, pos: NextSibling}) 复制出新根", async () => {
      const manager = await createPopulatedManager();
      let copyRoot: any;
      await manager.write(async () => {
        copyRoot = await manager.copyNode(2, {
          to: 7,
          pos: FlexNodeRelPosition.NextSibling,
        });
      });
      expect(copyRoot.level).toBe(0);
      expect(manager.nodes.map((n: any) => n.name)).toEqual(["A", "B", "C", "A"]);
      await manager.verify();
    });

    test("copyNode 子树到另一根下，返回副本根 level 已归一化", async () => {
      const manager = await createPopulatedManager();
      let copyRoot: any;
      await manager.write(async () => {
        copyRoot = await manager.copyNode(3, { to: 5, pos: FlexNodeRelPosition.LastChild });
      });
      expect(copyRoot.level).toBe(1);
      expect((copyRoot as any).name).toBe("A1");
      await manager.verify();
    });
  });

  describe("删除与清空", () => {
    test("deleteNode(用户根) 删除整棵子树，其余根坐标自动回缩，.nodes 刷新", async () => {
      const manager = await createPopulatedManager();
      await manager.write(async () => {
        await manager.deleteNode(2);
      });
      expect(manager.nodes.map((n: any) => n.name)).toEqual(["B", "C"]);
      expect((await manager.getNodes()).length).toBe(3); // B、B1、C
      await manager.verify();
    });

    test("clear 后表内仅剩重建的隐藏根，.nodes 为空，后续可继续增根", async () => {
      const manager = await createPopulatedManager();
      await manager.write(async () => {
        await manager.clear();
      });
      const rows = await driver.getRows(`SELECT * FROM tree`);
      expect(rows.length).toBe(1);
      expect(rows[0].name).toBe(HIDDEN_ROOT_NAME);
      expect(rows[0].leftValue).toBe(1);
      expect(manager.nodes).toEqual([]);

      await manager.write(async () => {
        await manager.addNodes([{ id: 50, name: "Fresh" }]);
      });
      expect(manager.nodes.length).toBe(1);
      await manager.verify();
    });
  });

  describe("事件", () => {
    test("node:added 事件经 mm 转发", async () => {
      const manager = await createMultiRootManager();
      let payload: any = null;
      manager.on("node:added", (p: any) => {
        payload = p;
      });
      await manager.write(async () => {
        await manager.addNodes([{ id: 2, name: "A" }]);
      });
      expect(payload).not.toBeNull();
      expect(payload.nodes.length).toBe(1);
    });

    test("node:deleted / node:updated / node:moved / node:cleared 均转发", async () => {
      const manager = await createPopulatedManager();
      const fired: string[] = [];
      manager.on("node:deleted", () => fired.push("deleted"));
      manager.on("node:updated", () => fired.push("updated"));
      manager.on("node:moved", () => fired.push("moved"));
      manager.on("node:cleared", () => fired.push("cleared"));

      await manager.write(async () => {
        await manager.moveNode(3, 4, FlexNodeRelPosition.PreviousSibling);
      });
      await manager.write(async () => {
        await manager.update({ id: 3, title: "X" } as any);
      });
      await manager.write(async () => {
        await manager.deleteNode(7);
      });
      await manager.write(async () => {
        await manager.clear();
      });
      expect(fired).toEqual(["moved", "updated", "deleted", "cleared"]);
    });

    test("write:before/write:after 由 mm 发出且包裹操作", async () => {
      const manager = await createPopulatedManager();
      const order: string[] = [];
      manager.on("write:before", () => order.push("before"));
      manager.on("write:after", () => order.push("after"));
      manager.on("node:added", () => order.push("added"));
      await manager.write(async () => {
        await manager.addNodes([{ id: 99, name: "X" }]);
      });
      expect(order).toEqual(["before", "added", "after"]);
    });
  });

  describe("toJson / toList 多根导出", () => {
    test("toJson 返回多根嵌套数组（长度=根数，结构与子节点正确）", async () => {
      const manager = await createPopulatedManager();
      const json = (await manager.toJson()) as any[];
      expect(json.length).toBe(3);
      expect(json[0].name).toBe("A");
      expect(json[0].children.map((c: any) => c.name)).toEqual(["A1", "A2"]);
      expect(json[1].name).toBe("B");
      expect(json[1].children.length).toBe(1);
      expect(json[2].name).toBe("C");
      expect(json[2].children).toBeUndefined();
    });

    test("toJson({includeKeyFields:true}) 的 level 已归一化（根=0）", async () => {
      const manager = await createPopulatedManager();
      const json = (await manager.toJson({ includeKeyFields: true })) as any[];
      expect(json[0].level).toBe(0);
      expect(json[0].children[0].level).toBe(1);
    });

    test("toJson({level:2}) 限定导出两层（根+子）", async () => {
      const manager = await createPopulatedManager();
      const json = (await manager.toJson({ level: 2 })) as any[];
      expect(json[0].children.length).toBe(2);
      expect(json[0].children[0].children).toBeUndefined();
    });

    test("toJson({childrenField:'items'}) 自定义子字段（level 修正递归生效）", async () => {
      const manager = await createPopulatedManager();
      const json = (await manager.toJson({
        childrenField: "items",
        includeKeyFields: true,
      })) as any[];
      expect(json[0].items.length).toBe(2);
      expect(json[0].items[0].level).toBe(1);
      expect(json[0].children).toBeUndefined();
    });

    test("toList 返回平面列表且用户根的 pid=0（不泄漏隐藏根 id）", async () => {
      const manager = await createPopulatedManager();
      const list = (await manager.toList()) as any[];
      expect(list.length).toBe(6);
      const roots = list.filter((n: any) => ["A", "B", "C"].includes(n.name));
      expect(roots.every((n: any) => n.pid === 0)).toBe(true);
      const hiddenRoot = await getHiddenRootRow();
      expect(list.every((n: any) => n.pid !== hiddenRoot.id)).toBe(true);
    });

    test("toList({includeKeyFields:true}) level 已归一化", async () => {
      const manager = await createPopulatedManager();
      const list = (await manager.toList({ includeKeyFields: true })) as any[];
      const byName = new Map(list.map((n: any) => [n.name, n]));
      expect((byName.get("A") as any).level).toBe(0);
      expect((byName.get("A1") as any).level).toBe(1);
    });
  });

  describe("update / verify / 单例", () => {
    test("update 修改自定义字段透传生效", async () => {
      const manager = await createPopulatedManager();
      await manager.write(async () => {
        await manager.update({ id: 3, title: "New Title", size: 42 } as any);
      });
      const node = await manager.getNode(3);
      expect((node as any).title).toBe("New Title");
      expect((node as any).size).toBe(42);
    });

    test("verify() 在正常多根数据上返回 true", async () => {
      const manager = await createPopulatedManager();
      expect(await manager.verify()).toBe(true);
    });

    test("getInstance 同 tableName 返回同一实例，clearInstance 可清除", async () => {
      await createPopulatedManager();
      const a = MultiRootFlexTreeManager.getInstance<TestFields>("tree", {
        adapter: driver,
      });
      const b = MultiRootFlexTreeManager.getInstance<TestFields>("tree", {
        adapter: driver,
      });
      expect(a).toBe(b);
      MultiRootFlexTreeManager.clearInstance("tree");
      const c = MultiRootFlexTreeManager.getInstance<TestFields>("tree", {
        adapter: driver,
      });
      expect(c).not.toBe(a);
    });
  });
});
