import { describe, test, expect } from "bun:test";
import { FlexTreeManager, FlexTree, FlexNodeRelPosition } from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

interface TestFields {
  title: string;
  size: number;
}

async function createMultiTreeTable(driver: BunSqliteAdapter) {
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
            size INTEGER,
            UNIQUE(treeId, leftValue)
        );
        `,
  ]);
}

async function clearAllTables(driver: BunSqliteAdapter) {
  await driver.exec([`DELETE FROM tree`]);
}

async function createMultiTreeManager(treeId: number): Promise<FlexTreeManager<TestFields>> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  await createMultiTreeTable(sqliteAdapter);
  await clearAllTables(sqliteAdapter);

  const manager = new FlexTreeManager<TestFields>("tree", {
    treeId,
    adapter: sqliteAdapter,
  });

  return manager;
}

async function createMultiTreeFlexTree(treeId: number): Promise<FlexTree<TestFields>> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  await createMultiTreeTable(sqliteAdapter);
  await clearAllTables(sqliteAdapter);

  const tree = new FlexTree<TestFields>("tree", {
    treeId,
    adapter: sqliteAdapter,
  });

  return tree;
}

/**
 * 创建共享同一物理表（同一 adapter）的多树 manager 对
 *
 * 跨树移动要求两棵树在同一张表中；每个 manager 各自 new（不走单例），
 * 但 adapter 必须共享（BunSqliteAdapter 默认 :memory:，独立实例即独立库）
 */
async function createSharedMultiTreeManagers(): Promise<
  [FlexTreeManager<TestFields>, FlexTreeManager<TestFields>]
> {
  const adapter = new BunSqliteAdapter();
  await adapter.open();
  await createMultiTreeTable(adapter);
  await clearAllTables(adapter);

  const tree1 = new FlexTreeManager<TestFields>("tree", { treeId: 1, adapter });
  const tree2 = new FlexTreeManager<TestFields>("tree", { treeId: 2, adapter });
  return [tree1, tree2];
}

describe("单表多树场景测试", () => {
  describe("FlexTreeManager 多树操作", () => {
    describe("创建独立的树", () => {
      test("在同一表中创建两棵独立的树", async () => {
        // 创建树1
        const tree1 = await createMultiTreeManager(1);
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "tree1-root", treeId: 1, title: "Tree 1 Root" });
          await tree1.addNodes([
            { id: 2, name: "A", treeId: 1, title: "Tree 1 - A" },
            { id: 3, name: "B", treeId: 1, title: "Tree 1 - B" },
          ]);
        });

        // 创建树2
        const tree2 = await createMultiTreeManager(2);
        await tree2.write(async () => {
          await tree2.createRoot({ id: 1, name: "tree2-root", treeId: 2, title: "Tree 2 Root" });
          await tree2.addNodes([
            { id: 2, name: "C", treeId: 2, title: "Tree 2 - C" },
            { id: 3, name: "D", treeId: 2, title: "Tree 2 - D" },
          ]);
        });

        // 验证树1
        const tree1Root = await tree1.getRoot();
        expect(tree1Root).toBeDefined();
        expect(tree1Root?.name).toBe("tree1-root");
        expect(tree1Root?.treeId).toBe(1);

        const tree1Nodes = await tree1.getNodes();
        expect(tree1Nodes).toHaveLength(3);
        expect(tree1Nodes.every((n) => n.treeId === 1)).toBe(true);

        // 验证树2
        const tree2Root = await tree2.getRoot();
        expect(tree2Root).toBeDefined();
        expect(tree2Root?.name).toBe("tree2-root");
        expect(tree2Root?.treeId).toBe(2);

        const tree2Nodes = await tree2.getNodes();
        expect(tree2Nodes).toHaveLength(3);
        expect(tree2Nodes.every((n) => n.treeId === 2)).toBe(true);
      });

      test("在同一表中创建多棵树", async () => {
        const trees: FlexTreeManager<TestFields>[] = [];

        // 创建5棵树
        for (let i = 1; i <= 5; i++) {
          const tree = await createMultiTreeManager(i);
          await tree.write(async () => {
            await tree.createRoot({
              id: 1,
              name: `tree${i}-root`,
              treeId: i,
              title: `Tree ${i} Root`,
            });
            await tree.addNodes([
              { id: 2, name: `Node-${i}-A`, treeId: i, title: `Tree ${i} - A` },
              { id: 3, name: `Node-${i}-B`, treeId: i, title: `Tree ${i} - B` },
            ]);
          });
          trees.push(tree);
        }

        // 验证每棵树
        for (let i = 0; i < trees.length; i++) {
          const tree = trees[i];
          const treeId = i + 1;

          const root = await tree.getRoot();
          expect(root?.treeId).toBe(treeId);
          expect(root?.name).toBe(`tree${treeId}-root`);

          const nodes = await tree.getNodes();
          expect(nodes).toHaveLength(3);
          expect(nodes.every((n) => n.treeId === treeId)).toBe(true);
        }
      });
    });

    describe("独立树操作", () => {
      test("独立操作不同的树", async () => {
        const tree1 = await createMultiTreeManager(1);
        const tree2 = await createMultiTreeManager(2);

        // 初始化两棵树
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1, title: "Root 1" });
        });

        await tree2.write(async () => {
          await tree2.createRoot({ id: 1, name: "root2", treeId: 2, title: "Root 2" });
        });

        // 在树1中添加节点
        await tree1.write(async () => {
          await tree1.addNodes([
            { id: 2, name: "A", treeId: 1, title: "Tree 1 - A" },
            { id: 3, name: "B", treeId: 1, title: "Tree 1 - B" },
          ]);
        });

        // 在树2中添加节点
        await tree2.write(async () => {
          await tree2.addNodes([
            { id: 2, name: "C", treeId: 2, title: "Tree 2 - C" },
            { id: 3, name: "D", treeId: 2, title: "Tree 2 - D" },
          ]);
        });

        // 在树1中删除节点
        await tree1.write(async () => {
          await tree1.deleteNode(2);
        });

        // 验证树1
        const tree1Nodes = await tree1.getNodes();
        expect(tree1Nodes).toHaveLength(2); // root1 + B
        expect(tree1Nodes.every((n) => n.treeId === 1)).toBe(true);

        // 验证树2（不受影响）
        const tree2Nodes = await tree2.getNodes();
        expect(tree2Nodes).toHaveLength(3); // root2 + C + D
        expect(tree2Nodes.every((n) => n.treeId === 2)).toBe(true);
      });

      test("在不同树中移动节点", async () => {
        const tree1 = await createMultiTreeManager(1);
        const tree2 = await createMultiTreeManager(2);

        // 初始化两棵树
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1, title: "Root 1" });
          await tree1.addNodes([
            { id: 2, name: "A", treeId: 1, title: "Tree 1 - A" },
            { id: 3, name: "B", treeId: 1, title: "Tree 1 - B" },
          ]);
        });

        await tree2.write(async () => {
          await tree2.createRoot({ id: 1, name: "root2", treeId: 2, title: "Root 2" });
          await tree2.addNodes([{ id: 2, name: "C", treeId: 2, title: "Tree 2 - C" }]);
        });

        // 在树1中移动节点 - 将B移动到A的下一个位置
        await tree1.write(async () => {
          await tree1.moveNode(3, 2, FlexNodeRelPosition.NextSibling);
        });

        // 验证树1的节点顺序已改变
        const tree1Nodes = await tree1.getNodes();
        expect(tree1Nodes[0].name).toBe("root1");
        expect(tree1Nodes[1].name).toBe("A");
        expect(tree1Nodes[2].name).toBe("B");

        // 验证树2不受影响
        const tree2Nodes = await tree2.getNodes();
        expect(tree2Nodes[1].name).toBe("C");
      });
    });

    describe("跨树查询和验证", () => {
      test("不同树的节点ID可以相同", async () => {
        const tree1 = await createMultiTreeManager(1);
        const tree2 = await createMultiTreeManager(2);

        // 在两棵树中创建相同ID的节点
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 100, name: "Node-100-Tree1", treeId: 1 }]);
        });

        await tree2.write(async () => {
          await tree2.createRoot({ id: 1, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 100, name: "Node-100-Tree2", treeId: 2 }]);
        });

        // 验证两棵树都有相同ID的节点，但内容不同
        const tree1Node = await tree1.getNode(100);
        const tree2Node = await tree2.getNode(100);

        expect(tree1Node?.id).toBe(100);
        expect(tree2Node?.id).toBe(100);
        expect(tree1Node?.name).toBe("Node-100-Tree1");
        expect(tree2Node?.name).toBe("Node-100-Tree2");
        expect(tree1Node?.treeId).toBe(1);
        expect(tree2Node?.treeId).toBe(2);
      });

      test("分别验证不同树的完整性", async () => {
        const tree1 = await createMultiTreeManager(1);
        const tree2 = await createMultiTreeManager(2);

        // 创建复杂的树结构
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([
            { id: 2, name: "A", treeId: 1 },
            { id: 3, name: "B", treeId: 1 },
          ]);
          await tree1.addNodes([{ id: 4, name: "A1", treeId: 1 }], 2);
        });

        await tree2.write(async () => {
          await tree2.createRoot({ id: 1, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 2, name: "C", treeId: 2 }]);
          await tree2.addNodes([{ id: 3, name: "C1", treeId: 2 }], 2);
        });

        // 验证每棵树
        const tree1Valid = await tree1.verify();
        const tree2Valid = await tree2.verify();

        expect(tree1Valid).toBe(true);
        expect(tree2Valid).toBe(true);
      });

      test("查询不会跨树", async () => {
        const tree1 = await createMultiTreeManager(1);
        const tree2 = await createMultiTreeManager(2);

        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([
            { id: 2, name: "A", treeId: 1 },
            { id: 3, name: "B", treeId: 1 },
          ]);
        });

        await tree2.write(async () => {
          await tree2.createRoot({ id: 1, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 2, name: "C", treeId: 2 }]);
        });

        // 在树1中查询
        const tree1Nodes = await tree1.getNodes();
        expect(tree1Nodes).toHaveLength(3);
        expect(tree1Nodes.every((n) => n.treeId === 1)).toBe(true);

        // 在树2中查询
        const tree2Nodes = await tree2.getNodes();
        expect(tree2Nodes).toHaveLength(2);
        expect(tree2Nodes.every((n) => n.treeId === 2)).toBe(true);

        // 查找操作也不会跨树
        const tree1FindResult = await tree1.findNode({ name: "C" });
        expect(tree1FindResult).toBeNull(); // C在树2中，不在树1中

        const tree2FindResult = await tree2.findNode({ name: "A" });
        expect(tree2FindResult).toBeNull(); // A在树1中，不在树2中
      });
    });

    describe("跨树移动节点（moveNode options.treeId）", () => {
      test("跨树移动为 LastChild：子树整体迁移且两树完整", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();

        // 树1: root1 - A(A1,A2), B；树2: root2 - C
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes(
            [
              { id: 2, name: "A", treeId: 1 },
              { id: 3, name: "B", treeId: 1 },
            ],
            1,
            FlexNodeRelPosition.LastChild,
          );
          await tree1.addNodes(
            [
              { id: 4, name: "A1", treeId: 1 },
              { id: 5, name: "A2", treeId: 1 },
            ],
            2,
          );
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 11, name: "C", treeId: 2 }], 10);
        });

        await tree1.write(async () => {
          // A 连同 A1/A2 跨树移动为 C 的最后一个子节点
          await tree1.moveNode(2, 11, { treeId: 2, pos: FlexNodeRelPosition.LastChild });
        });

        // 树2：root2 - C - A(A1,A2)，子树归属与层级正确
        const tree2Nodes = await tree2.getNodes();
        expect(tree2Nodes).toHaveLength(5);
        const moved = tree2Nodes.find((n) => n.id === 2)!;
        expect(moved.treeId).toBe(2);
        expect(moved.name).toBe("A");
        const a1 = tree2Nodes.find((n) => n.id === 4)!;
        const a2 = tree2Nodes.find((n) => n.id === 5)!;
        expect(a1.treeId).toBe(2);
        expect(a2.treeId).toBe(2);
        // A 的层级：C(level1) 的子节点 = level2；后代随 delta 平移
        expect(moved.level).toBe(2);
        expect(a1.level).toBe(3);
        expect(a2.level).toBe(3);

        // 树1：root1 - B，完整且节点数正确
        const tree1Nodes = await tree1.getNodes();
        expect(tree1Nodes).toHaveLength(2);
        expect(tree1Nodes.every((n) => n.treeId === 1)).toBe(true);

        // 两树均通过完整性验证（隐含 UNIQUE(treeId,leftValue) 无撞车）
        expect(await tree1.verify()).toBe(true);
        expect(await tree2.verify()).toBe(true);
      });

      test("跨树移动为 FirstChild / NextSibling / PreviousSibling 均正确", async () => {
        for (const pos of [
          FlexNodeRelPosition.FirstChild,
          FlexNodeRelPosition.NextSibling,
          FlexNodeRelPosition.PreviousSibling,
        ]) {
          const [tree1, tree2] = await createSharedMultiTreeManagers();
          // 树1: root1 - A(A1)；树2: root2 - C(C1), D
          await tree1.write(async () => {
            await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
            await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
            await tree1.addNodes([{ id: 3, name: "A1", treeId: 1 }], 2);
          });
          await tree2.write(async () => {
            await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
            await tree2.addNodes(
              [
                { id: 11, name: "C", treeId: 2 },
                { id: 12, name: "D", treeId: 2 },
              ],
              10,
            );
            await tree2.addNodes([{ id: 13, name: "C1", treeId: 2 }], 11);
          });

          await tree1.write(async () => {
            await tree1.moveNode(2, 11, { treeId: 2, pos });
          });

          // 两树均完整（结构验证覆盖坐标连续性/嵌套正确性）
          expect(await tree1.verify()).toBe(true);
          expect(await tree2.verify()).toBe(true);

          // 子树（A+A1）整体迁移，归属改写（树2原有 root2/C/C1/D 共 4 节点）
          const tree2Nodes = await tree2.getNodes();
          expect(tree2Nodes).toHaveLength(6);
          const moved = tree2Nodes.find((n) => n.id === 2)!;
          const child = tree2Nodes.find((n) => n.id === 3)!;
          expect(moved.treeId).toBe(2);
          expect(child.treeId).toBe(2);
          // 位置语义断言
          if (pos === FlexNodeRelPosition.FirstChild) {
            expect(moved.level).toBe(2); // C 的第一子
            expect(moved.leftValue).toBeLessThan(
              tree2Nodes.find((n) => n.id === 13)!.leftValue,
            );
          } else if (pos === FlexNodeRelPosition.NextSibling) {
            expect(moved.level).toBe(1); // C 的下一兄弟
            expect(moved.leftValue).toBeGreaterThan(
              tree2Nodes.find((n) => n.id === 11)!.rightValue,
            );
          } else {
            expect(moved.level).toBe(1); // C 的上一兄弟
            expect(moved.leftValue).toBeLessThan(
              tree2Nodes.find((n) => n.id === 11)!.leftValue,
            );
          }
        }
      });

      test("跨树移动：目标节点按 treeId+id 读取，id 主键全表唯一无需消歧", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        // 单表多树的 id 是表主键、全表唯一，不存在跨树同 id；
        // 跨树查询仍须限定目标树（getNodeData 的 {__TREE_ID__} 只查当前树会漏查）
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 11, name: "C", treeId: 2 }], 10);
        });

        // canMoveTo 跨树预检按 treeId+id 读取目标节点
        expect(await tree1.canMoveTo(2, 11, { treeId: 2 })).toBe(true);

        await tree1.write(async () => {
          await tree1.moveNode(2, 11, { treeId: 2, pos: FlexNodeRelPosition.LastChild });
        });
        expect(await tree1.verify()).toBe(true);
        expect(await tree2.verify()).toBe(true);
        const tree2Nodes = await tree2.getNodes();
        expect(tree2Nodes).toHaveLength(3);
        const moved = tree2Nodes.find((n) => n.name === "A")!;
        expect(moved.treeId).toBe(2);
      });

      test("跨树移动根节点：整树并入目标树，原树被删除", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        // 树1: root1 - A(A1)；树2: root2 - C
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
          await tree1.addNodes([{ id: 3, name: "A1", treeId: 1 }], 2);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 11, name: "C", treeId: 2 }], 10);
        });

        // 预检：移根跨树是允许的
        expect(await tree1.canMoveTo(1, 11, { treeId: 2 })).toBe(true);

        await tree1.write(async () => {
          // 整棵树1（root1+A+A1）并入树2，作为 C 的最后一个子节点
          await tree1.moveNode(1, 11, { treeId: 2, pos: FlexNodeRelPosition.LastChild });
        });

        // 树1 已被删除：无节点、无根
        const tree1Nodes = await tree1.getNodes();
        expect(tree1Nodes).toHaveLength(0);
        expect(await tree1.getRoot()).toBeNull();

        // 树2 完整：root2 - C - root1(level2) - A(level3) - A1(level4)
        const tree2Nodes = await tree2.getNodes();
        expect(tree2Nodes).toHaveLength(5);
        expect(await tree2.verify()).toBe(true);
        const movedRoot = tree2Nodes.find((n) => n.id === 1)!;
        expect(movedRoot.treeId).toBe(2);
        expect(movedRoot.level).toBe(2);
        const movedA = tree2Nodes.find((n) => n.id === 2)!;
        const movedA1 = tree2Nodes.find((n) => n.id === 3)!;
        expect(movedA.treeId).toBe(2);
        expect(movedA.level).toBe(3);
        expect(movedA1.treeId).toBe(2);
        expect(movedA1.level).toBe(4);

        // 树1 的 manager 已失效：读操作得到空结果（不抛错但无数据），
        // 写操作因树已无根而失败
        await expect(tree1.getNodes()).resolves.toHaveLength(0);
        await expect(
          tree1.write(async () => {
            await tree1.addNodes([{ id: 99, name: "X", treeId: 1 }], 1);
          }),
        ).rejects.toThrow(); // 节点 id=1 已不在树1，getNodeData 抛 NotFound
      });

      test("跨树移动根节点到目标根的兄弟位被拒绝", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 11, name: "C", treeId: 2 }], 10);
        });

        // toNode 是目标树根节点时，NextSibling / PreviousSibling 均被拒绝
        await tree1.write(async () => {
          await expect(
            tree1.moveNode(1, 10, { treeId: 2, pos: FlexNodeRelPosition.NextSibling }),
          ).rejects.toThrow("Root node can not have next and previous sibling node");
          await expect(
            tree1.moveNode(2, 10, { treeId: 2, pos: FlexNodeRelPosition.PreviousSibling }),
          ).rejects.toThrow("Root node can not have next and previous sibling node");
        });
        // 两树结构均未被破坏
        expect(await tree1.verify()).toBe(true);
        expect(await tree2.verify()).toBe(true);
      });

      test("目标为根节点时 sibling 位被拒绝（跨树同规则）", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
        });

        await tree1.write(async () => {
          await expect(
            tree1.moveNode(2, 10, { treeId: 2, pos: FlexNodeRelPosition.NextSibling }),
          ).rejects.toThrow("Root node can not have next and previous sibling node");
        });
      });

      test("目标树中不存在 toNode 时抛错", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
        });

        await tree1.write(async () => {
          await expect(
            tree1.moveNode(2, 999, { treeId: 2 }),
          ).rejects.toThrow("Destination node not found in tree<2>");
        });
      });

      test("方向约束：不能把其他树的节点移入当前树", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 11, name: "C", treeId: 2 }], 10);
        });

        // tree1 的 manager 上，节点 11（属树2）不可作为移动源——
        // getNodeData 的 {__TREE_ID__} 过滤查不到，抛 NotFound
        await tree1.write(async () => {
          await expect(
            tree1.moveNode(11, 2, { treeId: 1 }),
          ).rejects.toThrow();
        });
        // 两树均未被破坏
        expect(await tree1.verify()).toBe(true);
        expect(await tree2.verify()).toBe(true);
        const tree2Nodes = await tree2.getNodes();
        expect(tree2Nodes).toHaveLength(2);
        expect(tree2Nodes.every((n) => n.treeId === 2)).toBe(true);
      });

      test("跨树移动触发 node:deleted + node:moved 两个事件（源树视角）", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 11, name: "C", treeId: 2 }], 10);
        });

        const events: string[] = [];
        let deletedPayload: any = null;
        let movedPayload: any = null;
        tree1.on("node:deleted", (e: any) => {
          events.push("node:deleted");
          deletedPayload = e;
        });
        tree1.on("node:moved", (e: any) => {
          events.push("node:moved");
          movedPayload = e;
        });

        await tree1.write(async () => {
          await tree1.moveNode(2, 11, { treeId: 2 });
        });

        // 先 deleted（源树视角节点被移离）后 moved
        expect(events).toEqual(["node:deleted", "node:moved"]);
        expect(deletedPayload.tree).toBe(1);
        expect(movedPayload.toTree).toBe(2);

        // 同树移动只发 moved，不发 deleted
        const sameTreeEvents: string[] = [];
        tree2.on("node:moved", () => sameTreeEvents.push("node:moved"));
        tree2.on("node:deleted", () => sameTreeEvents.push("node:deleted"));
        await tree2.write(async () => {
          await tree2.moveNode(2, 11); // id=2 此时已属树2，同树移动
        });
        expect(sameTreeEvents).toEqual(["node:moved"]);
      });

      test("treeId 等于当前树时视为同树移动", async () => {
        const [tree1] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes(
            [
              { id: 2, name: "A", treeId: 1 },
              { id: 3, name: "B", treeId: 1 },
            ],
            1,
          );
        });

        // treeId: 1 === this.treeId，等同普通同树移动
        await tree1.write(async () => {
          await tree1.moveNode(2, 3, { treeId: 1, pos: FlexNodeRelPosition.NextSibling });
        });
        expect(await tree1.verify()).toBe(true);
        const nodes = await tree1.getNodes();
        expect(nodes).toHaveLength(3);
        const a = nodes.find((n) => n.id === 2)!;
        expect(a.leftValue).toBeGreaterThan(nodes.find((n) => n.id === 3)!.rightValue);
      });

      test("单树模式提供 treeId 抛错", async () => {
        // 单树表（无 treeId 语义）
        const adapter = new BunSqliteAdapter();
        await adapter.open();
        await adapter.exec([
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
        ]);
        const tree = new FlexTreeManager<TestFields>("tree", { adapter });
        await tree.write(async () => {
          await tree.createRoot({ id: 1, name: "root" });
          await tree.addNodes(
            [
              { id: 2, name: "A" },
              { id: 3, name: "B" },
            ],
            1,
          );
        });

        await tree.write(async () => {
          await expect(tree.moveNode(2, 3, { treeId: 99 })).rejects.toThrow(
            "treeId option requires multi-tree table",
          );
        });
      });

      test("跨树迁出为新树：toNode 缺省 + treeId 提供时 node 成为新树根", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        // 树1: root1 - A(A1,A2), B；树2 已存在
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes(
            [
              { id: 2, name: "A", treeId: 1 },
              { id: 3, name: "B", treeId: 1 },
            ],
            1,
          );
          await tree1.addNodes(
            [
              { id: 4, name: "A1", treeId: 1 },
              { id: 5, name: "A2", treeId: 1 },
            ],
            2,
          );
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
        });

        await tree1.write(async () => {
          // A 连同 A1/A2 迁出为 treeId=3 的新树（pos 传了也无效）
          await tree1.moveNode(2, undefined, { treeId: 3, pos: FlexNodeRelPosition.LastChild });
        });

        // 源树：root1 - B，完整
        expect(await tree1.verify()).toBe(true);
        const tree1Nodes = await tree1.getNodes();
        expect(tree1Nodes).toHaveLength(2);

        // 新树3：A 为根（level=0, leftValue=1），A1/A2 为子节点
        const newTree = new FlexTreeManager<TestFields>("tree", {
          treeId: 3,
          adapter: (tree1 as any).adapter,
        });
        expect(await newTree.verify()).toBe(true);
        const newTreeNodes = await newTree.getNodes();
        expect(newTreeNodes).toHaveLength(3);
        const newRoot = newTreeNodes.find((n) => n.id === 2)!;
        expect(newRoot.treeId).toBe(3);
        expect(newRoot.level).toBe(0);
        expect(newRoot.leftValue).toBe(1);
        const na1 = newTreeNodes.find((n) => n.id === 4)!;
        const na2 = newTreeNodes.find((n) => n.id === 5)!;
        expect(na1.treeId).toBe(3);
        expect(na1.level).toBe(1);
        expect(na2.treeId).toBe(3);
        expect(na2.level).toBe(1);
        // A1 在 A2 前（子树内部次序保持）
        expect(na1.leftValue).toBeLessThan(na2.leftValue);
      });

      test("迁出为新树时目标 treeId 已存在则抛错", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
        });

        // treeId=2 已有树，迁出被拒绝
        await tree1.write(async () => {
          await expect(
            tree1.moveNode(2, undefined, { treeId: 2 }),
          ).rejects.toThrow("Tree<2> already exists");
        });
        // 两树均未被破坏
        expect(await tree1.verify()).toBe(true);
        expect(await tree2.verify()).toBe(true);
      });

      test("node:moved 事件携带 toTree", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 11, name: "C", treeId: 2 }], 10);
        });

        let payload: any = null;
        tree1.on("node:moved", (e: any) => {
          payload = e;
        });
        await tree1.write(async () => {
          await tree1.moveNode(2, 11, { treeId: 2 });
        });
        expect(payload).not.toBeNull();
        expect(payload.tree).toBe(1);
        expect(payload.toTree).toBe(2);

        // 同树移动时 toTree === tree
        let samePayload: any = null;
        tree2.on("node:moved", (e: any) => {
          samePayload = e;
        });
        await tree2.write(async () => {
          await tree2.moveNode(2, 11, { treeId: 2 }); // 此时 id=2 已属树2，同树移动
        });
        expect(samePayload.toTree).toBe(2);
        expect(samePayload.tree).toBe(2);
      });

      test("canMoveTo 跨树预检", async () => {
        const [tree1, tree2] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }], 1);
        });
        await tree2.write(async () => {
          await tree2.createRoot({ id: 10, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 11, name: "C", treeId: 2 }], 10);
        });

        // 普通节点跨树移动：允许
        expect(await tree1.canMoveTo(2, 11, { treeId: 2 })).toBe(true);
        // 根节点跨树移动：也允许（整树并入目标树，等效删除原树）
        expect(await tree1.canMoveTo(1, 11, { treeId: 2 })).toBe(true);
        // 目标不存在：抛错（预检与执行同构）
        await expect(tree1.canMoveTo(2, 999, { treeId: 2 })).rejects.toThrow(
          "Destination node not found",
        );
      });

      test("旧位置参数风格仍可用（联合类型兼容）", async () => {
        const [tree1] = await createSharedMultiTreeManagers();
        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes(
            [
              { id: 2, name: "A", treeId: 1 },
              { id: 3, name: "B", treeId: 1 },
            ],
            1,
          );
        });

        // 第三参数直接传枚举（旧 API）
        await tree1.write(async () => {
          await tree1.moveNode(2, 3, FlexNodeRelPosition.PreviousSibling);
        });
        expect(await tree1.verify()).toBe(true);
        const nodes = await tree1.getNodes();
        const a = nodes.find((n) => n.id === 2)!;
        const b = nodes.find((n) => n.id === 3)!;
        expect(a.leftValue).toBeLessThan(b.leftValue);
      });
    });

    describe("节点关系在多树环境中的正确性", () => {      test("节点关系查询限制在单棵树内", async () => {
        const tree1 = await createMultiTreeManager(1);
        const tree2 = await createMultiTreeManager(2);

        await tree1.write(async () => {
          await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }]);
          await tree1.addNodes([{ id: 3, name: "A1", treeId: 1 }], 2);
        });

        await tree2.write(async () => {
          await tree2.createRoot({ id: 1, name: "root2", treeId: 2 });
          await tree2.addNodes([{ id: 2, name: "B", treeId: 2 }]);
        });

        // 在树1中查询关系
        const tree1Parent = await tree1.getParent(3);
        expect(tree1Parent).toBeDefined();
        expect(tree1Parent?.name).toBe("A");
        expect(tree1Parent?.treeId).toBe(1);

        const tree1Children = await tree1.getChildren(2);
        expect(tree1Children).toHaveLength(1);
        expect(tree1Children[0].name).toBe("A1");
        expect(tree1Children[0].treeId).toBe(1);

        // 在树2中查询关系
        const tree2Children = await tree2.getChildren(1);
        expect(tree2Children).toHaveLength(1);
        expect(tree2Children[0].name).toBe("B");
        expect(tree2Children[0].treeId).toBe(2);
      });
    });
  });

  describe("FlexTree 多树环境", () => {
    describe("多树的 FlexTree 操作", () => {
      test("加载不同的树", async () => {
        const tree1 = await createMultiTreeFlexTree(1);
        const tree2 = await createMultiTreeFlexTree(2);

        // 初始化两棵树
        await tree1.manager.write(async () => {
          await tree1.manager.createRoot({ id: 1, name: "root1", treeId: 1, title: "Tree 1" });
          await tree1.manager.addNodes([{ id: 2, name: "A", treeId: 1, title: "Node A" }]);
        });

        await tree2.manager.write(async () => {
          await tree2.manager.createRoot({ id: 101, name: "root2", treeId: 2, title: "Tree 2" });
          await tree2.manager.addNodes([{ id: 102, name: "B", treeId: 2, title: "Node B" }]);
        });

        // 加载树1
        await tree1.load();
        expect(tree1.root?.name).toBe("root1");
        expect(tree1.root?.treeId).toBe(1);

        // 加载树2
        await tree2.load();
        expect(tree2.root?.name).toBe("root2");
        expect(tree2.root?.treeId).toBe(2);
      });

      test("在不同树中通过路径访问节点", async () => {
        const tree1 = await createMultiTreeFlexTree(1);
        const tree2 = await createMultiTreeFlexTree(2);

        // 初始化树1
        await tree1.manager.write(async () => {
          await tree1.manager.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.manager.addNodes([{ id: 2, name: "A", treeId: 1 }]);
          await tree1.manager.addNodes([{ id: 3, name: "A1", treeId: 1 }], 2);
        });

        // 初始化树2
        await tree2.manager.write(async () => {
          await tree2.manager.createRoot({ id: 101, name: "root2", treeId: 2 });
          await tree2.manager.addNodes([{ id: 102, name: "B", treeId: 2 }]);
        });

        await tree1.load();
        await tree2.load();

        // 在树1中访问节点 - 使用相对路径
        const tree1Node = tree1.getByPath("A");
        expect(tree1Node?.name).toBe("A");
        expect(tree1Node?.treeId).toBe(1);

        // 在树2中访问节点 - 使用相对路径
        const tree2Node = tree2.getByPath("B");
        expect(tree2Node?.name).toBe("B");
        expect(tree2Node?.treeId).toBe(2);
      });

      test("在不同树中查找节点", async () => {
        const tree1 = await createMultiTreeFlexTree(1);
        const tree2 = await createMultiTreeFlexTree(2);

        // 初始化树1
        await tree1.manager.write(async () => {
          await tree1.manager.createRoot({ id: 1, name: "root1", treeId: 1, title: "Tree1" });
          await tree1.manager.addNodes([
            { id: 2, name: "A", treeId: 1, title: "Node A" },
            { id: 3, name: "B", treeId: 1, title: "Node B" },
          ]);
        });

        // 初始化树2
        await tree2.manager.write(async () => {
          await tree2.manager.createRoot({ id: 101, name: "root2", treeId: 2, title: "Tree2" });
          await tree2.manager.addNodes([
            { id: 102, name: "C", treeId: 2, title: "Node C" },
            { id: 103, name: "D", treeId: 2, title: "Node D" },
          ]);
        });

        await tree1.load();
        await tree2.load();

        // 在树1中查找 - 使用name字段
        const tree1FindResult = tree1.find((n) => n.name === "A");
        expect(tree1FindResult).toBeDefined();
        expect(tree1FindResult?.name).toBe("A");

        // 在树2中查找 - 使用name字段
        const tree2FindResult = tree2.find((n) => n.name === "C");
        expect(tree2FindResult).toBeDefined();
        expect(tree2FindResult?.name).toBe("C");

        // 确保查找不跨树
        const tree1NotFound = tree1.find((n) => n.name === "C");
        expect(tree1NotFound).toBeUndefined();

        const tree2NotFound = tree2.find((n) => n.name === "A");
        expect(tree2NotFound).toBeUndefined();
      });
    });

    describe("多树导出和同步", () => {
      test("导出不同的树", async () => {
        const tree1 = await createMultiTreeFlexTree(1);
        const tree2 = await createMultiTreeFlexTree(2);

        // 初始化树1
        await tree1.manager.write(async () => {
          await tree1.manager.createRoot({ id: 1, name: "root1", treeId: 1, title: "Tree 1" });
          await tree1.manager.addNodes([
            { id: 2, name: "A", treeId: 1, title: "Node A1" },
            { id: 3, name: "B", treeId: 1, title: "Node B1" },
          ]);
        });

        // 初始化树2
        await tree2.manager.write(async () => {
          await tree2.manager.createRoot({ id: 1, name: "root2", treeId: 2, title: "Tree 2" });
          await tree2.manager.addNodes([
            { id: 2, name: "C", treeId: 2, title: "Node C2" },
            { id: 3, name: "D", treeId: 2, title: "Node D2" },
          ]);
        });

        await tree1.load();
        await tree2.load();

        // 导出树1
        const tree1Json = tree1.toJson();
        expect(tree1Json?.title).toBe("Tree 1");
        expect(tree1Json?.children?.length).toBe(2);
        expect(tree1Json?.children?.[0].title).toBe("Node A1");

        // 导出树2
        const tree2Json = tree2.toJson();
        expect(tree2Json?.title).toBe("Tree 2");
        expect(tree2Json?.children?.length).toBe(2);
        expect(tree2Json?.children?.[0].title).toBe("Node C2");
      });

      test("List 导出不同树", async () => {
        const tree1 = await createMultiTreeFlexTree(1);
        const tree2 = await createMultiTreeFlexTree(2);

        // 初始化两棵树
        await tree1.manager.write(async () => {
          await tree1.manager.createRoot({ id: 1, name: "root1", treeId: 1 });
          await tree1.manager.addNodes([{ id: 2, name: "A", treeId: 1 }]);
        });

        await tree2.manager.write(async () => {
          await tree2.manager.createRoot({ id: 1, name: "root2", treeId: 2 });
          await tree2.manager.addNodes([{ id: 2, name: "B", treeId: 2 }]);
        });

        await tree1.load();
        await tree2.load();

        // 导出树1
        const tree1List = tree1.toList();
        expect(tree1List.length).toBe(2);
        expect(tree1List[0].name).toBe("root1");
        expect(tree1List[1].name).toBe("A");

        // 导出树2
        const tree2List = tree2.toList();
        expect(tree2List.length).toBe(2);
        expect(tree2List[0].name).toBe("root2");
        expect(tree2List[1].name).toBe("B");
      });
    });
  });

  describe("多树边界情况", () => {
    test("大量树的压力测试", async () => {
      const treeCount = 10;
      const trees: FlexTreeManager<TestFields>[] = [];

      // 创建多棵树
      for (let i = 1; i <= treeCount; i++) {
        const tree = await createMultiTreeManager(i);
        await tree.write(async () => {
          await tree.createRoot({
            id: 1,
            name: `tree${i}-root`,
            treeId: i,
            title: `Tree ${i}`,
          });
          await tree.addNodes([
            { id: 2, name: `Node-${i}-A`, treeId: i },
            { id: 3, name: `Node-${i}-B`, treeId: i },
          ]);
        });
        trees.push(tree);
      }

      // 验证每棵树
      for (let i = 0; i < trees.length; i++) {
        const tree = trees[i];
        const treeId = i + 1;

        const root = await tree.getRoot();
        expect(root?.treeId).toBe(treeId);

        const nodes = await tree.getNodes();
        expect(nodes.every((n) => n.treeId === treeId)).toBe(true);

        const isValid = await tree.verify();
        expect(isValid).toBe(true);
      }
    });

    test("空树和非空树共存", async () => {
      // 创建一个有节点的树
      const tree1 = await createMultiTreeManager(1);
      await tree1.write(async () => {
        await tree1.createRoot({ id: 1, name: "root1", treeId: 1 });
        await tree1.addNodes([{ id: 2, name: "A", treeId: 1 }]);
      });

      // 创建一个空树
      const tree2 = await createMultiTreeManager(2);
      // 不添加任何节点

      // 验证树1有内容
      const tree1Nodes = await tree1.getNodes();
      expect(tree1Nodes.length).toBeGreaterThan(0);

      // 验证树2为空
      const tree2Root = await tree2.getRoot();
      expect(tree2Root).toBeNull();

      const tree2Nodes = await tree2.getNodes();
      expect(tree2Nodes).toHaveLength(0);

      // 空树验证应该通过
      const tree2Valid = await tree2.verify();
      expect(tree2Valid).toBe(true);
    });

    test("不同树使用相同的节点名称", async () => {
      const tree1 = await createMultiTreeManager(1);
      const tree2 = await createMultiTreeManager(2);

      // 在两棵树中创建相同结构的节点
      await tree1.write(async () => {
        await tree1.createRoot({ id: 1, name: "root", treeId: 1, title: "Tree 1" });
        await tree1.addNodes([{ id: 2, name: "common", treeId: 1, title: "Common in Tree 1" }]);
      });

      await tree2.write(async () => {
        await tree2.createRoot({ id: 1, name: "root", treeId: 2, title: "Tree 2" });
        await tree2.addNodes([{ id: 2, name: "common", treeId: 2, title: "Common in Tree 2" }]);
      });

      // 验证两棵树的节点名称相同但内容不同
      const tree1Node = await tree1.getNode(2);
      const tree2Node = await tree2.getNode(2);

      expect(tree1Node?.name).toBe("common");
      expect(tree2Node?.name).toBe("common");
      expect(tree1Node?.title).toBe("Common in Tree 1");
      expect(tree2Node?.title).toBe("Common in Tree 2");
      expect(tree1Node?.treeId).toBe(1);
      expect(tree2Node?.treeId).toBe(2);
    });
  });
});
