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

    describe("节点关系在多树环境中的正确性", () => {
      test("节点关系查询限制在单棵树内", async () => {
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
