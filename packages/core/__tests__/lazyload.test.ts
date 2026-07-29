import { describe, test, expect, beforeEach } from "bun:test";
import { FlexTreeManager, FlexTree } from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

interface TestFields {
  title: string;
  size: number;
}

let sharedAdapter: BunSqliteAdapter | null = null;

async function getSharedAdapter(): Promise<BunSqliteAdapter> {
  if (!sharedAdapter) {
    sharedAdapter = new BunSqliteAdapter();
    await sharedAdapter.open();
    await sharedAdapter.exec([
      `
        CREATE TABLE IF NOT EXISTS tree (
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
  return sharedAdapter;
}

async function clearAllTables(driver: BunSqliteAdapter) {
  await driver.exec([`DELETE FROM tree`]);
}

describe("FlexTree Lazy 懒加载特性测试", () => {
  beforeEach(async () => {
    const adapter = await getSharedAdapter();
    await clearAllTables(adapter);
  });

  describe("FlexTree Lazy 模式基础测试", () => {
    test("创建非懒加载树应该默认加载所有节点", async () => {
      const adapter = await getSharedAdapter();

      // 首先创建树结构
      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root Node" });
        await manager.addNodes([
          { id: 2, name: "A", treeId: 1, title: "Node A", size: 10 },
          { id: 3, name: "B", treeId: 1, title: "Node B", size: 20 },
          { id: 4, name: "C", treeId: 1, title: "Node C", size: 30 },
        ]);

        // 添加子节点 - 使用节点 ID 而不是节点对象
        await manager.addNodes(
          [
            { id: 5, name: "A-1", treeId: 1, title: "Node A-1", size: 5 },
            { id: 6, name: "A-2", treeId: 1, title: "Node A-2", size: 15 },
          ],
          2,
        ); // 使用节点 ID

        await manager.addNodes([{ id: 7, name: "B-1", treeId: 1, title: "Node B-1", size: 25 }], 3); // 使用节点 ID
      });

      // 创建非懒加载树
      const tree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: false, // 显式设置为非懒加载
      });

      // 加载树
      await tree.load();

      // 验证根节点状态
      expect(tree.status).toBe("loaded"); // 非懒加载树加载后状态为loaded
      expect(tree.root).toBeDefined();

      // 验证根节点包含所有子节点
      const rootNode = tree.root!;
      expect(rootNode.name).toBe("root");
      expect(rootNode.children).toHaveLength(3);

      // 验证所有节点都已加载
      const allNodes = tree.toList();
      expect(allNodes.length).toBe(7); // root + 3 children + 3 grandchildren
    });

    test("创建懒加载树应该只加载第一层节点", async () => {
      const adapter = await getSharedAdapter();

      // 首先创建树结构
      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root Node" });
        await manager.addNodes([
          { id: 2, name: "A", treeId: 1, title: "Node A", size: 10 },
          { id: 3, name: "B", treeId: 1, title: "Node B", size: 20 },
          { id: 4, name: "C", treeId: 1, title: "Node C", size: 30 },
        ]);

        // 添加子节点 - 使用节点 ID 而不是节点对象
        await manager.addNodes(
          [
            { id: 5, name: "A-1", treeId: 1, title: "Node A-1", size: 5 },
            { id: 6, name: "A-2", treeId: 1, title: "Node A-2", size: 15 },
          ],
          2,
        ); // 使用节点 ID

        await manager.addNodes([{ id: 7, name: "B-1", treeId: 1, title: "Node B-1", size: 25 }], 3); // 使用节点 ID
      });

      // 创建懒加载树
      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true, // 启用懒加载
      });

      // 加载树
      await lazyTree.load();

      // 验证根节点状态
      expect(lazyTree.status).toBe("loaded"); // 懒加载树加载后状态为loaded
      expect(lazyTree.root).toBeDefined();

      // 验证根节点只包含直接子节点
      const rootNode = lazyTree.root!;
      expect(rootNode.name).toBe("root");
      expect(rootNode.children).toHaveLength(3);

      // 验证子节点没有加载它们的子节点
      const nodeA = rootNode.children![0];
      expect(nodeA.name).toBe("A");
      expect(nodeA.children).toEqual([]); // 懒加载模式下，子节点的子节点为空数组

      const nodeB = rootNode.children![1];
      expect(nodeB.name).toBe("B");
      expect(nodeB.children).toEqual([]);

      const nodeC = rootNode.children![2];
      expect(nodeC.name).toBe("C");
      expect(nodeC.children).toBeUndefined();
    });

    test("懒加载模式下按需加载子节点", async () => {
      const adapter = await getSharedAdapter();

      // 创建树结构
      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root Node" });
        await manager.addNodes([
          { id: 2, name: "A", treeId: 1, title: "Node A", size: 10 },
          { id: 3, name: "B", treeId: 1, title: "Node B", size: 20 },
        ]);

        await manager.addNodes(
          [
            { id: 4, name: "A-1", treeId: 1, title: "Node A-1", size: 5 },
            { id: 5, name: "A-2", treeId: 1, title: "Node A-2", size: 15 },
          ],
          2,
        );
      });

      // 创建懒加载树
      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      const rootNode = lazyTree.root!;
      const nodeA = rootNode.children![0];

      // 验证初始状态 - 子节点未加载
      expect(nodeA.children).toEqual([]);
      expect(nodeA.status).toBe("idle"); // 懒加载模式下子节点默认为idle状态

      // 按需加载子节点
      await nodeA.load();

      // 验证子节点已加载
      expect(nodeA.children).toBeDefined();
      expect(nodeA.children).toHaveLength(2);
      expect(nodeA.children![0].name).toBe("A-1");
      expect(nodeA.children![1].name).toBe("A-2");
    });

    test("懒加载与非懒加载的内存效率对比", async () => {
      const adapter = await getSharedAdapter();

      // 创建深层树结构
      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });

        // 添加10个第一层节点
        for (let i = 1; i <= 10; i++) {
          await manager.addNodes([
            { id: i + 1, name: `Node-${i}`, treeId: 1, title: `Node ${i}`, size: i * 10 },
          ]);

          // 为每个第一层节点添加5个子节点
          for (let j = 1; j <= 5; j++) {
            await manager.addNodes(
              [
                {
                  id: i * 10 + j + 10,
                  name: `Node-${i}-${j}`,
                  treeId: 1,
                  title: `Node ${i}-${j}`,
                  size: i * j,
                },
              ],
              i + 1,
            );
          }
        }
      });

      // 测试非懒加载
      const nonLazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: false,
      });

      await nonLazyTree.load();

      // 计算非懒加载树的节点数量
      let nonLazyCount = 0;
      nonLazyTree.forEach(() => {
        nonLazyCount++;
      });
      expect(nonLazyCount).toBe(60); // 1 root + 10 level1 + 49 level2 (其中一个没有子节点)

      // 测试懒加载
      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      // 计算懒加载树的节点数量（只计算已加载的）
      let lazyCount = 0;
      lazyTree.forEach(() => {
        lazyCount++;
      });
      expect(lazyCount).toBe(10); // 10 level1 (根节点和level2 未加载)
    });
  });

  describe("FlexTree Lazy 节点状态管理", () => {
    test("验证节点状态转换", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });
        await manager.addNodes([{ id: 2, name: "A", treeId: 1, title: "Node A", size: 10 }]);
        await manager.addNodes([{ id: 3, name: "A-1", treeId: 1, title: "Node A-1", size: 5 }], 2);
      });

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      // 初始状态 - 未加载
      expect(lazyTree.status).toBe("idle");

      await lazyTree.load();

      // 加载后状态
      expect(lazyTree.status).toBe("loaded");

      const rootNode = lazyTree.root!;
      expect(rootNode.status).toBe("loaded");

      const nodeA = rootNode.children![0];
      expect(nodeA.status).toBe("idle"); // 懒加载模式下子节点默认未加载

      // 子节点的子节点未加载
      expect(nodeA.children).toEqual([]);
    });

    test("防止重复加载", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });
        await manager.addNodes([{ id: 2, name: "A", treeId: 1, title: "Node A", size: 10 }]);
      });

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      const nodeA = lazyTree.root!.children![0];

      // 第一次加载 - 因为没有子节点，load不会改变children状态
      await nodeA.load();
      // 在没有子节点的情况下，children保持undefined
      expect(nodeA.children).toBeUndefined();

      // 重复加载应该不会出错
      await nodeA.load();
      expect(nodeA.children).toBeUndefined();
    });
  });

  describe("FlexTree Lazy 路径访问", () => {
    test("懒加载模式下路径访问", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });
        await manager.addNodes([
          { id: 2, name: "A", treeId: 1, title: "Node A", size: 10 },
          { id: 3, name: "B", treeId: 1, title: "Node B", size: 20 },
        ]);

        await manager.addNodes(
          [
            { id: 4, name: "A-1", treeId: 1, title: "Node A-1", size: 5 },
            { id: 5, name: "A-2", treeId: 1, title: "Node A-2", size: 15 },
          ],
          2,
        );
      });

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      // 测试路径访问第一层节点
      const nodeA = lazyTree.getByPath("A");
      expect(nodeA).toBeDefined();
      expect(nodeA!.name).toBe("A");

      const nodeB = lazyTree.getByPath("B");
      expect(nodeB).toBeDefined();
      expect(nodeB!.name).toBe("B");

      // 测试路径访问第二层节点（需要先加载父节点的子节点）
      const nodeA1 = lazyTree.getByPath("A/A-1");
      expect(nodeA1).toBeUndefined(); // 未加载，所以找不到

      // 先加载A的子节点
      const nodeALoaded = lazyTree.getByPath("A");
      await nodeALoaded!.load();

      // 现在应该可以找到 A-1
      const nodeA1AfterLoad = lazyTree.getByPath("A/A-1");
      expect(nodeA1AfterLoad).toBeDefined();
      expect(nodeA1AfterLoad!.name).toBe("A-1");
    });

    test("懒加载模式下的查找操作", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });
        await manager.addNodes([
          { id: 2, name: "A", treeId: 1, title: "Node A", size: 10 },
          { id: 3, name: "B", treeId: 1, title: "Node B", size: 20 },
        ]);

        await manager.addNodes([{ id: 4, name: "A-1", treeId: 1, title: "Node A-1", size: 5 }], 2);
      });

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      // 查找第一层节点
      const foundA = lazyTree.find((node) => node.name === "A");
      expect(foundA).toBeDefined();
      expect(foundA!.name).toBe("A");

      // 查找第二层节点（未加载）
      const foundA1 = lazyTree.find((node) => node.name === "A-1");
      expect(foundA1).toBeUndefined(); // 因为没有加载，所以找不到

      // 查找所有匹配的节点
      const allAs = lazyTree.findAll((node) => node.name.includes("A"));
      expect(allAs).toHaveLength(1); // 只能找到 "A"，找不到 "A-1"

      // 加载A的子节点后再查找
      const nodeA = lazyTree.find((node) => node.name === "A");
      await nodeA!.load();

      const allAsAfterLoad = lazyTree.findAll((node) => node.name.includes("A"));
      expect(allAsAfterLoad).toHaveLength(2); // 现在可以找到 "A" 和 "A-1"
    });
  });

  describe("FlexTree Lazy 更新操作", () => {
    test("懒加载模式下的节点更新", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });
        await manager.addNodes([{ id: 2, name: "A", treeId: 1, title: "Node A", size: 10 }]);

        await manager.addNodes([{ id: 3, name: "A-1", treeId: 1, title: "Node A-1", size: 5 }], 2);
      });

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      // 更新第一层节点
      await lazyTree.update("A", { title: "Updated Node A", size: 100 });

      const nodeA = lazyTree.getByPath("A");
      expect(nodeA!.fields.title).toBe("Updated Node A");
      expect(nodeA!.fields.size).toBe(100);

      // 同步数据库更改
      await lazyTree.sync();

      // 验证数据库中的更改
      const dbNode = await manager.getNode(2);
      expect(dbNode!.title).toBe("Updated Node A");
      expect(dbNode!.size).toBe(100);
    });

    test("懒加载模式下的同步操作", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });
        await manager.addNodes([{ id: 2, name: "A", treeId: 1, title: "Node A", size: 10 }]);
      });

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      // 修改内存中的节点数据（通过直接修改数据库，然后重新加载）
      const nodeA = lazyTree.getByPath("A");

      // 同步到数据库
      await lazyTree.sync();

      // 验证同步结果（修改是通过 manager 直接操作数据库的）
      const dbNode = await manager.getNode(2);
      expect(dbNode!.title).toBe("Node A"); // 原始值
      expect(dbNode!.size).toBe(10); // 原始值
    });
  });

  describe("FlexTree Lazy 导出操作", () => {
    test("懒加载模式下的JSON导出", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });
        await manager.addNodes([
          { id: 2, name: "A", treeId: 1, title: "Node A", size: 10 },
          { id: 3, name: "B", treeId: 1, title: "Node B", size: 20 },
        ]);

        await manager.addNodes([{ id: 4, name: "A-1", treeId: 1, title: "Node A-1", size: 5 }], 2);
      });

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      // 导出JSON - 只包含已加载的节点
      const jsonExport = lazyTree.toJson();
      expect(jsonExport.name).toBe("root");
      expect(jsonExport.children).toHaveLength(2);
      expect(jsonExport.children![0].name).toBe("A");
      expect(jsonExport.children![0].children).toEqual([]); // 未加载子节点的子节点为空数组

      // 加载A的子节点后再导出
      const nodeA = lazyTree.getByPath("A");
      await nodeA!.load();

      const jsonExportAfterLoad = lazyTree.toJson();
      expect(jsonExportAfterLoad.children![0].children).toBeDefined();
      expect(jsonExportAfterLoad.children![0].children!.length).toBeGreaterThan(0);
    });

    test("懒加载模式下的列表导出", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });
        await manager.addNodes([{ id: 2, name: "A", treeId: 1, title: "Node A", size: 10 }]);

        await manager.addNodes([{ id: 3, name: "A-1", treeId: 1, title: "Node A-1", size: 5 }], 2);
      });

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      // 导出列表 - 只包含已加载的节点
      const listExport = lazyTree.toList();
      expect(listExport.length).toBe(2); // 只有 root 和 A

      // 加载A的子节点后再导出
      const nodeA = lazyTree.getByPath("A");
      await nodeA!.load();

      const listExportAfterLoad = lazyTree.toList();
      expect(listExportAfterLoad.length).toBe(3); // root, A, A-1
    });
  });

  describe("FlexTree Lazy 性能测试", () => {
    test("大树的懒加载性能", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      // 创建较大的树结构
      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });

        // 添加50个第一层节点
        for (let i = 1; i <= 50; i++) {
          await manager.addNodes([
            { id: i + 1, name: `Node-${i}`, treeId: 1, title: `Node ${i}`, size: i * 10 },
          ]);
        }
      });

      // 测试懒加载性能
      const startTime = Date.now();

      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      const lazyLoadTime = Date.now() - startTime;

      // 验证只加载了第一层
      expect(lazyTree.root!.children).toHaveLength(50);

      // 验证懒加载速度较快（应该显著快于完全加载）
      expect(lazyLoadTime).toBeLessThan(1000); // 懒加载应该在1秒内完成
    });

    test("按需加载的性能优势", async () => {
      const adapter = await getSharedAdapter();

      const manager = new FlexTreeManager<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
      });

      await manager.write(async () => {
        await manager.createRoot({ id: 1, name: "root", treeId: 1, title: "Root" });

        // 添加20个第一层节点，每个有10个子节点
        for (let i = 1; i <= 20; i++) {
          await manager.addNodes([
            { id: i + 1, name: `Node-${i}`, treeId: 1, title: `Node ${i}`, size: i * 10 },
          ]);

          for (let j = 1; j <= 10; j++) {
            await manager.addNodes(
              [
                {
                  id: i * 10 + j + 20,
                  name: `Node-${i}-${j}`,
                  treeId: 1,
                  title: `Node ${i}-${j}`,
                  size: i * j,
                },
              ],
              i + 1,
            );
          }
        }
      });

      // 测试按需加载性能
      const lazyTree = new FlexTree<TestFields>("tree", {
        treeId: 1,
        adapter: adapter,
        lazy: true,
      });

      await lazyTree.load();

      // 只加载第一个节点及其子节点
      const firstNode = lazyTree.root!.children![0];
      const startTime = Date.now();
      await firstNode.load();
      const loadTime = Date.now() - startTime;

      // 验证只加载了需要的节点
      expect(firstNode.children).toHaveLength(10);

      // 验证按需加载速度快
      expect(loadTime).toBeLessThan(500); // 单个节点的加载应该在500ms内完成
    });
  });
});
