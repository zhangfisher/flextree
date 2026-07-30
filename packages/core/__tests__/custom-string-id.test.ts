import { describe, test, expect, beforeEach } from "bun:test";
import { FlexTreeManager, FlexTree, NextSibling } from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

// 测试接口：包含字符串标识字段的扩展数据
interface StringIdFields {
  size: number;
  category: string;
  uuid: string; // 业务层的字符串ID
  metadata?: string;
}

// 字符串 TreeID 的自定义字段映射
type StringTreeIdKeyFields = {
  name: "title";
  treeId: ["forest_id", string];
  leftValue: "lft";
  rightValue: "rgt";
};

type StringTreeIdManager = FlexTreeManager<StringIdFields, StringTreeIdKeyFields>;
type StringTreeIdFlexTree = FlexTree<StringIdFields, StringTreeIdKeyFields>;

// 创建支持字符串 TreeID 的数据库表
async function createStringTreeIdTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS string_forest (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60),
            forest_id TEXT,
            level INTEGER,
            lft INTEGER,
            rgt INTEGER,
            size INTEGER,
            category VARCHAR(60),
            uuid TEXT,
            metadata VARCHAR(255)
        );
        `,
  ]);
}

async function createStringTreeIdMultiTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS string_forest (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60),
            forest_id TEXT,
            level INTEGER,
            lft INTEGER,
            rgt INTEGER,
            size INTEGER,
            category VARCHAR(60),
            uuid TEXT,
            metadata VARCHAR(255),
            UNIQUE(forest_id, lft)
        );
        `,
  ]);
}

async function clearStringTreeIdTable(driver: BunSqliteAdapter) {
  await driver.exec([`DELETE FROM string_forest`]);
}

async function createStringTreeIdManager(treeId?: string): Promise<StringTreeIdManager> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();

  if (treeId) {
    await createStringTreeIdMultiTreeTable(sqliteAdapter);
  } else {
    await createStringTreeIdTable(sqliteAdapter);
  }

  await clearStringTreeIdTable(sqliteAdapter);

  const manager = new FlexTreeManager<StringIdFields, StringTreeIdKeyFields>("string_forest", {
    treeId: treeId,
    adapter: sqliteAdapter,
    fields: {
      name: "title",
      treeId: "forest_id",
      leftValue: "lft",
      rightValue: "rgt",
    },
  }) as StringTreeIdManager;

  return manager;
}

async function createStringTreeIdFlexTree(treeId?: string): Promise<StringTreeIdFlexTree> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();

  if (treeId) {
    await createStringTreeIdMultiTreeTable(sqliteAdapter);
  } else {
    await createStringTreeIdTable(sqliteAdapter);
  }

  await clearStringTreeIdTable(sqliteAdapter);

  const tree = new FlexTree<StringIdFields, StringTreeIdKeyFields>("string_forest", {
    treeId: treeId,
    adapter: sqliteAdapter,
    fields: {
      name: "title",
      treeId: "forest_id",
      leftValue: "lft",
      rightValue: "rgt",
    },
  }) as StringTreeIdFlexTree;

  return tree;
}

// 混合类型测试：数值ID + 字符串TreeID（已在上面的StringTreeIdKeyFields中体现）
// 再添加一个：数值ID + 数值TreeID的对照测试
interface NumericIdFields {
  data: string;
  value: number;
}

type NumericTreeIdKeyFields = {
  name: "name";
  treeId: ["tree_id", number];
  leftValue: "leftValue";
  rightValue: "rightValue";
};

type NumericTreeIdManager = FlexTreeManager<NumericIdFields, NumericTreeIdKeyFields>;

async function createNumericTreeIdTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS numeric_forest (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),
            tree_id INTEGER,
            level INTEGER,
            leftValue INTEGER,
            rightValue INTEGER,
            data VARCHAR(60),
            value INTEGER
        );
        `,
  ]);
}

async function clearNumericTreeIdTable(driver: BunSqliteAdapter) {
  await driver.exec([`DELETE FROM numeric_forest`]);
}

async function createNumericTreeIdManager(treeId?: number): Promise<NumericTreeIdManager> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  await createNumericTreeIdTable(sqliteAdapter);
  await clearNumericTreeIdTable(sqliteAdapter);

  const manager = new FlexTreeManager<NumericIdFields, NumericTreeIdKeyFields>("numeric_forest", {
    treeId: treeId,
    adapter: sqliteAdapter,
    fields: {
      name: "name",
      treeId: "tree_id",
      leftValue: "leftValue",
      rightValue: "rightValue",
    },
  }) as NumericTreeIdManager;

  return manager;
}

describe("字符串 TreeID 和自定义字符串标识字段测试", () => {
  describe("字符串 TreeID 基础功能", () => {
    describe("创建根节点", () => {
      let tree: StringTreeIdManager;

      beforeEach(async () => {
        tree = await createStringTreeIdManager();
      });

      test("创建根节点使用字符串标识字段", async () => {
        await tree.write(async () => {
          await tree.createRoot({
            title: "root",
            uuid: "root-uuid-001",
            category: "root-category",
            size: 100,
            metadata: "root metadata",
          });
        });

        const root = await tree.getRoot();
        expect(root).not.toBeNull();
        expect(root.title).toBe("root");
        expect(root.uuid).toBe("root-uuid-001");
        expect(root.category).toBe("root-category");
        expect(root.size).toBe(100);
        expect(root.metadata).toBe("root metadata");
        expect(root.level).toBe(0);
        expect(root.lft).toBe(1);
        expect(root.rgt).toBe(2);
      });

      test("创建根节点使用 UUID 格式", async () => {
        const uuid = "550e8400-e29b-41d4-a716-446655440000";

        await tree.write(async () => {
          await tree.createRoot({
            title: "root-uuid",
            uuid: uuid,
            category: "uuid-cat",
            size: 50,
          });
        });

        const root = await tree.getRoot();
        expect(root).not.toBeNull();
        expect(root.uuid).toBe(uuid);
        expect(root.title).toBe("root-uuid");
      });
    });

    describe("添加子节点", () => {
      let tree: StringTreeIdManager;

      beforeEach(async () => {
        tree = await createStringTreeIdManager();
        await tree.write(async () => {
          await tree.createRoot({
            title: "root",
            uuid: "root-main",
            category: "root-cat",
            size: 0,
          });
        });
      });

      test("添加子节点使用字符串标识字段", async () => {
        await tree.write(async () => {
          await tree.addNodes([
            { uuid: "node-a-001", title: "A", category: "cat-a", size: 10 },
            { uuid: "node-b-002", title: "B", category: "cat-b", size: 20 },
            { uuid: "node-c-003", title: "C", category: "cat-c", size: 30 },
          ]);
        });

        const nodes = await tree.getNodes();
        expect(nodes).toHaveLength(4);

        const nodeA = nodes.find((n) => n.uuid === "node-a-001");
        expect(nodeA).toBeDefined();
        expect(nodeA.title).toBe("A");
        expect(nodeA.category).toBe("cat-a");
        expect(nodeA.size).toBe(10);

        const nodeB = nodes.find((n) => n.uuid === "node-b-002");
        expect(nodeB).toBeDefined();
        expect(nodeB.title).toBe("B");

        expect(nodes[0].lft).toBe(1);
        expect(nodes[0].rgt).toBe(8);
      });

      test("通过数值ID查询带有字符串标识的节点", async () => {
        await tree.write(async () => {
          await tree.addNodes([
            { uuid: "child-1", title: "Child1", category: "cat1", size: 5 },
            { uuid: "child-2", title: "Child2", category: "cat2", size: 10 },
          ]);
        });

        // 通过数值ID查询（由于是自增ID）
        const nodes = await tree.getNodes();
        const child1 = nodes.find((n) => n.uuid === "child-1");
        expect(child1).toBeDefined();
        expect(child1.title).toBe("Child1");

        // 也可以通过数值ID直接查询
        const child1ById = await tree.getNode(child1.id);
        expect(child1ById).toBeDefined();
        expect(child1ById.uuid).toBe("child-1");
      });
    });

    describe("更新节点", () => {
      let tree: StringTreeIdManager;

      beforeEach(async () => {
        tree = await createStringTreeIdManager();
        await tree.write(async () => {
          await tree.createRoot({
            title: "original",
            uuid: "update-test",
            category: "original-cat",
            size: 0,
          });
          await tree.addNodes([{ uuid: "child-a", title: "A", category: "cat-a", size: 10 }]);
        });
      });

      test("通过数值ID更新节点的字符串标识字段", async () => {
        const nodes = await tree.getNodes();
        const rootNode = nodes[0];

        await tree.write(async () => {
          await tree.update({
            id: rootNode.id,
            category: "updated-cat",
            size: 99,
            metadata: "updated metadata",
          });
        });

        const updatedNode = await tree.getNode(rootNode.id);
        expect(updatedNode).toBeDefined();
        expect(updatedNode.category).toBe("updated-cat");
        expect(updatedNode.size).toBe(99);
        expect(updatedNode.title).toBe("original"); // 原有字段保持不变
        expect(updatedNode.uuid).toBe("update-test"); // uuid保持不变
      });
    });

    describe("删除节点", () => {
      let tree: StringTreeIdManager;

      beforeEach(async () => {
        tree = await createStringTreeIdManager();
        await tree.write(async () => {
          await tree.createRoot({ title: "root", uuid: "del-root" });
          await tree.addNodes([
            { uuid: "del-a", title: "A", category: "cat-a", size: 10 },
            { uuid: "del-b", title: "B", category: "cat-b", size: 20 },
          ]);
          const nodeA = (await tree.getNodes()).find((n) => n.uuid === "del-a");
          if (nodeA) {
            await tree.addNodes(
              [{ uuid: "del-a1", title: "A1", category: "cat-a1", size: 5 }],
              nodeA.id,
            );
          }
        });
      });

      test("通过数值ID删除带有字符串标识的节点", async () => {
        const nodes = await tree.getNodes();
        const nodeA = nodes.find((n) => n.uuid === "del-a");
        expect(nodeA).toBeDefined();

        await tree.write(async () => {
          await tree.deleteNode(nodeA!.id);
        });

        const remainingNodes = await tree.getNodes();
        expect(remainingNodes).toHaveLength(2); // root + B
        expect(remainingNodes.find((n) => n.title === "A")).toBeUndefined();
        expect(remainingNodes.find((n) => n.title === "A1")).toBeUndefined();
      });
    });

    describe("节点关系查询", () => {
      let tree: StringTreeIdManager;

      beforeEach(async () => {
        tree = await createStringTreeIdManager();
        await tree.write(async () => {
          await tree.createRoot({ title: "root", uuid: "rel-root" });
          await tree.addNodes([
            { uuid: "rel-parent", title: "Parent", category: "parent-cat", size: 10 },
          ]);
          const parentNode = (await tree.getNodes()).find((n) => n.uuid === "rel-parent");
          if (parentNode) {
            await tree.addNodes(
              [{ uuid: "rel-child", title: "Child", category: "child-cat", size: 5 }],
              parentNode.id,
            );
          }
        });
      });

      test("获取子节点", async () => {
        const nodes = await tree.getNodes();
        const parentNode = nodes.find((n) => n.uuid === "rel-parent");
        expect(parentNode).toBeDefined();

        const children = await tree.getChildren(parentNode!.id);
        expect(children).toHaveLength(1);
        expect(children[0].title).toBe("Child");
        expect(children[0].uuid).toBe("rel-child");
        expect(children[0].category).toBe("child-cat");
      });

      test("获取后代节点", async () => {
        const nodes = await tree.getNodes();
        const parentNode = nodes.find((n) => n.uuid === "rel-parent");
        expect(parentNode).toBeDefined();

        const descendants = await tree.getDescendants(parentNode!.id);
        expect(descendants).toHaveLength(1);
        expect(descendants[0].title).toBe("Child");
        expect(descendants[0].uuid).toBe("rel-child");
      });

      test("获取祖先节点", async () => {
        const nodes = await tree.getNodes();
        const childNode = nodes.find((n) => n.uuid === "rel-child");
        expect(childNode).toBeDefined();

        const ancestors = await tree.getAncestors(childNode!.id);
        expect(ancestors).toHaveLength(2);
        expect(ancestors[0].uuid).toBe("rel-root"); // 根节点（leftValue最小）
        expect(ancestors[1].uuid).toBe("rel-parent"); // 直接父节点（leftValue较大）
      });
    });
  });

  describe("字符串 TreeID 多树管理", () => {
    describe("多树独立性", () => {
      let tree1: StringTreeIdManager;
      let tree2: StringTreeIdManager;

      beforeEach(async () => {
        // 创建两棵不同的树
        tree1 = await createStringTreeIdManager("forest-001");
        tree2 = await createStringTreeIdManager("forest-002");

        await tree1.write(async () => {
          await tree1.createRoot({
            title: "Forest1 Root",
            uuid: "f1-root",
          });
          await tree1.addNodes([
            { uuid: "f1-a", title: "F1-A", category: "f1", size: 10 },
            { uuid: "f1-b", title: "F1-B", category: "f1", size: 20 },
          ]);
        });

        await tree2.write(async () => {
          await tree2.createRoot({
            title: "Forest2 Root",
            uuid: "f2-root",
          });
          await tree2.addNodes([
            { uuid: "f2-x", title: "F2-X", category: "f2", size: 30 },
            { uuid: "f2-y", title: "F2-Y", category: "f2", size: 40 },
          ]);
        });
      });

      test("两棵树互不影响", async () => {
        const tree1Nodes = await tree1.getNodes();
        const tree2Nodes = await tree2.getNodes();

        expect(tree1Nodes).toHaveLength(3);
        expect(tree2Nodes).toHaveLength(3);

        expect(tree1Nodes.every((n) => n.forest_id === "forest-001")).toBe(true);
        expect(tree2Nodes.every((n) => n.forest_id === "forest-002")).toBe(true);

        expect(tree1Nodes.some((n) => n.uuid === "f1-a")).toBe(true);
        expect(tree2Nodes.some((n) => n.uuid === "f2-x")).toBe(true);
      });

      test("在同一数值ID下不同树中的节点独立", async () => {
        // 不同树中的节点可能有相同的数值ID，但有不同的字符串标识
        const tree1NodeA = (await tree1.getNodes()).find((n) => n.uuid === "f1-a");
        const tree2NodeX = (await tree2.getNodes()).find((n) => n.uuid === "f2-x");

        expect(tree1NodeA).toBeDefined();
        expect(tree2NodeX).toBeDefined();

        // 验证它们在不同的树中
        expect(tree1NodeA!.forest_id).toBe("forest-001");
        expect(tree2NodeX!.forest_id).toBe("forest-002");
      });

      test("在指定树中添加节点不影响其他树", async () => {
        await tree1.write(async () => {
          await tree1.addNodes([{ uuid: "f1-new", title: "F1-New", category: "f1", size: 99 }]);
        });

        const tree1Nodes = await tree1.getNodes();
        const tree2Nodes = await tree2.getNodes();

        expect(tree1Nodes).toHaveLength(4);
        expect(tree2Nodes).toHaveLength(3); // 不受影响
      });
    });

    describe("使用业务含义的字符串 TreeID", () => {
      let companyTree: StringTreeIdManager;
      let departmentTree: StringTreeIdManager;

      beforeEach(async () => {
        companyTree = await createStringTreeIdManager("company-org");
        departmentTree = await createStringTreeIdManager("department-org");

        await companyTree.write(async () => {
          await companyTree.createRoot({
            title: "CEO",
            uuid: "ceo-node",
            category: "executive",
            size: 1,
          });
          await companyTree.addNodes([
            { uuid: "cto", title: "CTO", category: "executive", size: 2 },
            { uuid: "cfo", title: "CFO", category: "executive", size: 1 },
          ]);
        });

        await departmentTree.write(async () => {
          await departmentTree.createRoot({
            title: "Departments",
            uuid: "dept-root",
            category: "dept",
            size: 0,
          });
        });
      });

      test("使用业务含义的字符串 TreeID 管理不同组织结构", async () => {
        const companyNodes = await companyTree.getNodes();
        const departmentNodes = await departmentTree.getNodes();

        expect(companyNodes.every((n) => n.forest_id === "company-org")).toBe(true);
        expect(departmentNodes.every((n) => n.forest_id === "department-org")).toBe(true);

        expect(companyNodes.length).toBeGreaterThan(1);
        expect(departmentNodes.length).toBe(1);

        // 验证公司组织结构
        expect(companyNodes.some((n) => n.title === "CEO")).toBe(true);
        expect(companyNodes.some((n) => n.title === "CTO")).toBe(true);
        expect(companyNodes.some((n) => n.title === "CFO")).toBe(true);
      });
    });
  });

  describe("数值 TreeID 对照测试", () => {
    describe("数值 TreeID 基础功能", () => {
      let manager: NumericTreeIdManager;

      beforeEach(async () => {
        manager = await createNumericTreeIdManager(100);

        await manager.write(async () => {
          await manager.createRoot({
            name: "Root",
            data: "root-data",
            value: 0,
          });
          await manager.addNodes([
            { name: "Node A", data: "data-a", value: 10 },
            { name: "Node B", data: "data-b", value: 20 },
          ]);
        });
      });

      test("使用数值ID查询节点", async () => {
        const nodes = await manager.getNodes();
        const nodeA = nodes.find((n) => n.name === "Node A");
        expect(nodeA).toBeDefined();
        expect(nodeA!.name).toBe("Node A");
        expect(nodeA!.data).toBe("data-a");
        expect(nodeA!.tree_id).toBe(100);
      });

      test("数值 TreeID 正确设置", async () => {
        const nodes = await manager.getNodes();
        expect(nodes.every((n) => n.tree_id === 100)).toBe(true);
      });

      test("更新节点数据", async () => {
        const nodes = await manager.getNodes();
        const nodeA = nodes.find((n) => n.name === "Node A");
        expect(nodeA).toBeDefined();

        await manager.write(async () => {
          await manager.update({
            id: nodeA!.id,
            data: "updated-data",
            value: 99,
          });
        });

        const updatedNode = await manager.getNode(nodeA!.id);
        expect(updatedNode).toBeDefined();
        expect(updatedNode!.data).toBe("updated-data");
        expect(updatedNode!.value).toBe(99);
        expect(updatedNode!.name).toBe("Node A"); // 名称保持不变
      });
    });

    describe("数值 TreeID 多树管理", () => {
      let tree1: NumericTreeIdManager;
      let tree2: NumericTreeIdManager;

      beforeEach(async () => {
        tree1 = await createNumericTreeIdManager(1);
        tree2 = await createNumericTreeIdManager(2);

        await tree1.write(async () => {
          await tree1.createRoot({ name: "Tree1 Root", data: "t1", value: 0 });
          await tree1.addNodes([
            { name: "T1-A", data: "t1-a", value: 10 },
            { name: "T1-B", data: "t1-b", value: 20 },
          ]);
        });

        await tree2.write(async () => {
          await tree2.createRoot({ name: "Tree2 Root", data: "t2", value: 0 });
          await tree2.addNodes([
            { name: "T2-X", data: "t2-x", value: 30 },
            { name: "T2-Y", data: "t2-y", value: 40 },
          ]);
        });
      });

      test("数值 TreeID 多树独立性", async () => {
        const tree1Nodes = await tree1.getNodes();
        const tree2Nodes = await tree2.getNodes();

        expect(tree1Nodes).toHaveLength(3);
        expect(tree2Nodes).toHaveLength(3);

        expect(tree1Nodes.every((n) => n.tree_id === 1)).toBe(true);
        expect(tree2Nodes.every((n) => n.tree_id === 2)).toBe(true);
      });
    });
  });

  describe("字符串标识字段边界情况测试", () => {
    test("处理特殊字符的字符串标识", async () => {
      const tree = await createStringTreeIdManager();

      await tree.write(async () => {
        await tree.createRoot({
          title: "Special ID",
          uuid: "id-with-special-@#$%",
          category: "special",
          size: 1,
        });
      });

      const root = await tree.getRoot();
      expect(root).toBeDefined();
      expect(root.uuid).toBe("id-with-special-@#$%");
    });

    test("处理长字符串标识", async () => {
      const tree = await createStringTreeIdManager();
      const longUuid = "a".repeat(500); // 500字符的ID

      await tree.write(async () => {
        await tree.createRoot({
          title: "Long UUID",
          uuid: longUuid,
          category: "long",
          size: 1,
        });
      });

      const root = await tree.getRoot();
      expect(root).toBeDefined();
      expect(root.uuid).toBe(longUuid);
    });

    test("处理 Unicode 字符标识", async () => {
      const tree = await createStringTreeIdManager();

      await tree.write(async () => {
        await tree.createRoot({
          title: "Unicode ID",
          uuid: "节点-中文-🌳-λ-α",
          category: "unicode",
          size: 1,
        });
      });

      const root = await tree.getRoot();
      expect(root).toBeDefined();
      expect(root.uuid).toBe("节点-中文-🌳-λ-α");
    });

    test("处理相同字符串标识的查询", async () => {
      const tree = await createStringTreeIdManager();

      await tree.write(async () => {
        await tree.createRoot({ title: "Root", uuid: "same-uuid" });
        await tree.addNodes([
          { uuid: "child-1", title: "Child1" },
          { uuid: "child-2", title: "Child2" },
        ]);
      });

      const nodes = await tree.getNodes();
      const child1 = nodes.find((n) => n.uuid === "child-1");
      const child2 = nodes.find((n) => n.uuid === "child-2");

      expect(child1).toBeDefined();
      expect(child2).toBeDefined();
      expect(child1!.uuid).not.toBe(child2!.uuid);
    });

    test("字符串标识在节点移动中的保持性", async () => {
      const tree = await createStringTreeIdManager();

      await tree.write(async () => {
        await tree.createRoot({ title: "Root", uuid: "move-root" });
        await tree.addNodes([
          { uuid: "move-a", title: "A" },
          { uuid: "move-b", title: "B" },
        ]);
      });

      const nodesBefore = await tree.getNodes();
      const nodeABefore = nodesBefore.find((n) => n.uuid === "move-a");
      expect(nodeABefore).toBeDefined();

      // 移动节点
      await tree.write(async () => {
        const nodes = await tree.getNodes();
        const nodeA = nodes.find((n) => n.uuid === "move-a");
        const nodeB = nodes.find((n) => n.uuid === "move-b");
        if (nodeA && nodeB) {
          await tree.moveNode(nodeA.id, nodeB.id, NextSibling);
        }
      });

      const nodesAfter = await tree.getNodes();
      const nodeAAfter = nodesAfter.find((n) => n.uuid === "move-a");
      expect(nodeAAfter).toBeDefined();
      expect(nodeAAfter!.uuid).toBe("move-a"); // uuid在移动后保持不变
    });
  });

  describe("FlexTree 字符串标识字段测试", () => {
    describe("树加载和操作", () => {
      let tree: StringTreeIdFlexTree;

      beforeEach(async () => {
        tree = await createStringTreeIdFlexTree();

        await tree.manager.write(async () => {
          await tree.manager.createRoot({
            title: "Root",
            uuid: "flextree-root",
            category: "root-cat",
            size: 100,
          });
          await tree.manager.addNodes([
            { uuid: "flextree-a", title: "A", category: "cat-a", size: 50 },
            { uuid: "flextree-b", title: "B", category: "cat-b", size: 60 },
          ]);
          const nodeA = (await tree.manager.getNodes()).find((n) => n.uuid === "flextree-a");
          if (nodeA) {
            await tree.manager.addNodes(
              [{ uuid: "flextree-a1", title: "A1", category: "cat-a1", size: 5 }],
              nodeA.id,
            );
          }
        });
      });

      test("加载树使用字符串标识字段", async () => {
        await tree.load();

        expect(tree.root).toBeDefined();
        expect(tree.root?.fields.uuid).toBe("flextree-root");
        expect(tree.root?.fields.title).toBe("Root");
        expect(tree.root?.fields.category).toBe("root-cat");
      });

      test("通过路径获取节点", async () => {
        await tree.load();

        const node = tree.getByPath("/A", { byField: "title" });
        expect(node).toBeDefined();
        expect(node?.fields.uuid).toBe("flextree-a");
        expect(node?.fields.title).toBe("A");
        expect(node?.fields.category).toBe("cat-a");
      });

      test("通过数值ID获取节点", async () => {
        await tree.load();

        const nodes = await tree.manager.getNodes();
        const nodeA = nodes.find((n) => n.uuid === "flextree-a");
        expect(nodeA).toBeDefined();

        const node = tree.get(nodeA!.id);
        expect(node).toBeDefined();
        expect(node?.fields.uuid).toBe("flextree-a");
        expect(node?.fields.title).toBe("A");
      });

      test("查找节点使用字符串标识字段", async () => {
        await tree.load();

        const node = tree.find((n) => n.fields.category === "cat-b");
        expect(node).toBeDefined();
        expect(node?.fields.uuid).toBe("flextree-b");
        expect(node?.fields.title).toBe("B");
      });

      test("更新节点使用字符串标识字段", async () => {
        await tree.load();

        const nodes = await tree.manager.getNodes();
        const nodeA = nodes.find((n) => n.uuid === "flextree-a");
        expect(nodeA).toBeDefined();

        const node = tree.get(nodeA!.id);
        expect(node).toBeDefined();
        await node?.update({
          category: "updated-cat",
          size: 99,
        });

        await tree.load();
        const updatedNode = tree.get(nodeA!.id);
        expect(updatedNode?.fields.category).toBe("updated-cat");
        expect(updatedNode?.fields.size).toBe(99);
        expect(updatedNode?.fields.uuid).toBe("flextree-a"); // uuid保持不变
      });
    });

    describe("树导出使用字符串标识字段", () => {
      let tree: StringTreeIdFlexTree;

      beforeEach(async () => {
        tree = await createStringTreeIdFlexTree();

        await tree.manager.write(async () => {
          await tree.manager.createRoot({
            title: "Root",
            uuid: "export-root",
            category: "root-cat",
            size: 100,
          });
          await tree.manager.addNodes([
            { uuid: "export-a", title: "A", category: "cat-a", size: 50 },
            { uuid: "export-b", title: "B", category: "cat-b", size: 60 },
          ]);
        });
        await tree.load();
      });

      test("JSON导出包含字符串标识字段", () => {
        const json = tree.toJson({
          fields: [],
        }) as any;

        expect(json).toBeDefined();
        expect(json.uuid).toBe("export-root");
        expect(json.title).toBe("Root");
        expect(json.category).toBe("root-cat");
        expect(json.children?.[0].uuid).toBe("export-a");
        expect(json.children?.[0].title).toBe("A");
      });

      test("List导出包含字符串标识字段", () => {
        const list = tree.toList({
          fields: [],
        }) as any[];

        expect(list).toBeDefined();
        expect(list.length).toBe(3);
        expect(list[0].uuid).toBe("export-root");
        expect(list[0].title).toBe("Root");
        expect(list[1].uuid).toBe("export-a");
        expect(list[2].uuid).toBe("export-b");
      });
    });
  });

  describe("性能和大量数据测试", () => {
    test("大量带字符串标识的节点操作", async () => {
      const tree = await createStringTreeIdManager();

      await tree.write(async () => {
        await tree.createRoot({
          title: "Root",
          uuid: "batch-root",
        });

        // 批量添加100个节点
        const nodes = Array.from({ length: 100 }, (_, i) => ({
          uuid: `batch-node-${i}`,
          title: `Node ${i}`,
          category: `cat-${i % 10}`,
          size: i,
        }));

        await tree.addNodes(nodes);
      });

      const allNodes = await tree.getNodes();
      expect(allNodes).toHaveLength(101); // root + 100 nodes

      // 验证可以正确获取每个节点
      for (let i = 0; i < 100; i++) {
        const node = allNodes.find((n) => n.uuid === `batch-node-${i}`);
        expect(node).toBeDefined();
        expect(node!.title).toBe(`Node ${i}`);
      }
    });

    test("字符串标识在复杂树结构中的正确性", async () => {
      const tree = await createStringTreeIdManager();

      await tree.write(async () => {
        await tree.createRoot({ title: "Root", uuid: "complex-root" });

        // 创建复杂的多层结构
        await tree.addNodes([
          { uuid: "level1-1", title: "L1-1" },
          { uuid: "level1-2", title: "L1-2" },
        ]);

        const l1_1 = (await tree.getNodes()).find((n) => n.uuid === "level1-1");
        if (l1_1) {
          await tree.addNodes(
            [
              { uuid: "level2-1", title: "L2-1" },
              { uuid: "level2-2", title: "L2-2" },
            ],
            l1_1.id,
          );

          const l2_1 = (await tree.getNodes()).find((n) => n.uuid === "level2-1");
          if (l2_1) {
            await tree.addNodes([{ uuid: "level3-1", title: "L3-1" }], l2_1.id);
          }
        }
      });

      const nodes = await tree.getNodes();
      expect(nodes.length).toBeGreaterThan(5);

      // 验证层级关系
      const root = nodes.find((n) => n.uuid === "complex-root");
      expect(root?.level).toBe(0);

      const level2_1 = nodes.find((n) => n.uuid === "level2-1");
      expect(level2_1?.level).toBe(2);

      const level3_1 = nodes.find((n) => n.uuid === "level3-1");
      expect(level3_1?.level).toBe(3);
    });
  });

  describe("字符串 TreeID 边界情况", () => {
    test("使用特殊字符作为 TreeID", async () => {
      const tree = await createStringTreeIdManager("tree-with-special-@#$%");

      await tree.write(async () => {
        await tree.createRoot({
          title: "Root",
          uuid: "special-tree-root",
        });
        await tree.addNodes([{ uuid: "child-1", title: "Child1" }]);
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(2);
      expect(nodes.every((n) => n.forest_id === "tree-with-special-@#$%")).toBe(true);
    });

    test("使用长字符串作为 TreeID", async () => {
      const longTreeId = "forest-id-" + "a".repeat(200);
      const tree = await createStringTreeIdManager(longTreeId);

      await tree.write(async () => {
        await tree.createRoot({
          title: "Root",
          uuid: "long-tree-root",
        });
      });

      const root = await tree.getRoot();
      expect(root?.forest_id).toBe(longTreeId);
    });
  });
});
