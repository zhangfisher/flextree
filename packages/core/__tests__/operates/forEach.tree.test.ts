// oxlint-disable no-unused-vars
/**
 * FlexTreeManager forEach 遍历功能测试
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DemoFlexTreeManager } from "../helpers";
import { createDemoTree, createTreeManager } from "../helpers";

describe("FlexTreeManager.forEach 遍历功能", () => {
  let tree: DemoFlexTreeManager;

  beforeEach(async () => {
    tree = await createTreeManager();
    await createDemoTree(tree);
  });

  afterEach(async () => {
    // 清理
  });

  describe("基本遍历功能", () => {
    test("DFS 模式遍历", async () => {
      const visited: string[] = [];
      const childrenCounts: number[] = [];

      await tree.forEach(
        (node, children) => {
          visited.push(node.name);
          childrenCounts.push(children.length);
          return true;
        },
        { mode: "dfs" },
      );

      expect(visited.length).toBeGreaterThan(0);
      expect(childrenCounts.length).toBe(visited.length);
      // DFS 访问第一个节点应该是根节点
      expect(visited[0]).toBe("root");
    });

    test("BFS 模式遍历", async () => {
      const visited: string[] = [];

      await tree.forEach(
        (node, children) => {
          visited.push(node.name);
          return true;
        },
        { mode: "bfs" },
      );

      expect(visited.length).toBeGreaterThan(0);
      // BFS 访问第一个节点应该是根节点
      expect(visited[0]).toBe("root");
      // BFS 访问第二个和第三个节点应该是根节点的直接子节点
      expect(visited[1]).toMatch(/^[A-F]$/); // 应该是 A-F 中的一个
    });

    test("callback 返回 false 中断遍历", async () => {
      let count = 0;
      const maxCount = 5;

      await tree.forEach(
        (node, children) => {
          count++;
          return count < maxCount;
        },
        { mode: "dfs" },
      );

      expect(count).toBe(maxCount);
    });

    test("callback 返回 true 继续遍历", async () => {
      let count = 0;

      await tree.forEach(
        (node, children) => {
          count++;
          return true;
        },
        { mode: "dfs" },
      );

      expect(count).toBeGreaterThan(10); // demoTree 有很多节点
    });
  });

  describe("层级限制", () => {
    test("maxLevel 限制遍历深度", async () => {
      const visitedLevels: number[] = [];

      await tree.forEach(
        (node, children) => {
          visitedLevels.push(node.level);
          return true;
        },
        { mode: "dfs", maxLevel: 1 },
      );

      // 验证只访问了层级 0 和 1 的节点
      const maxLevel = Math.max(...visitedLevels);
      expect(maxLevel).toBeLessThanOrEqual(1);
    });

    test("maxLevel = 0 只访问根节点", async () => {
      const visited: string[] = [];

      await tree.forEach(
        (node, children) => {
          visited.push(node.name);
          return true;
        },
        { mode: "dfs", maxLevel: 0 },
      );

      expect(visited).toEqual(["root"]);
    });

    test("maxLevel = 2 访问三层节点", async () => {
      const visitedLevels: number[] = [];

      await tree.forEach(
        (node, children) => {
          visitedLevels.push(node.level);
          return true;
        },
        { mode: "dfs", maxLevel: 2 },
      );

      // 验证访问了层级 0, 1, 2 的节点
      const uniqueLevels = [...new Set(visitedLevels)].sort((a, b) => a - b);
      expect(uniqueLevels).toEqual([0, 1, 2]);
    });
  });

  describe("指定起始节点", () => {
    test("从指定节点开始遍历", async () => {
      const nodes = await tree.getNodes();
      const nodeA = nodes.find((n) => n.name === "A")!;
      const visited: string[] = [];

      await tree.forEach(
        (node) => {
          visited.push(node.name);
          return true;
        },
        { startFrom: nodeA, mode: "dfs" },
      );

      // 第一个访问的应该是节点 A
      expect(visited[0]).toBe("A");
      // 不应该访问根节点（除非在 A 的祖先路径中）
      expect(visited.includes("root")).toBe(false);
    });

    test("从指定节点ID开始遍历", async () => {
      const nodes = await tree.getNodes();
      const nodeB = nodes.find((n) => n.name === "B")!;
      const visited: string[] = [];

      await tree.forEach(
        (node, children) => {
          visited.push(node.name);
          return true;
        },
        { startFrom: nodeB.id, mode: "bfs" },
      );

      // 第一个访问的应该是节点 B
      expect(visited[0]).toBe("B");
    });

    test("从不存在的节点ID开始应该抛出错误", async () => {
      await expect(
        tree.forEach(
          (node, children) => {
            return true;
          },
          { startFrom: 99999, mode: "dfs" },
        ),
      ).rejects.toThrow();
    });
  });

  describe("includeStartNode 选项", () => {
    test("includeStartNode = false 不包含起始节点", async () => {
      const visited: string[] = [];

      await tree.forEach(
        (node, children) => {
          visited.push(node.name);
          return true;
        },
        { mode: "dfs", includeStartNode: false },
      );

      // 不应该包含根节点
      expect(visited.includes("root")).toBe(false);
      // 应该包含根节点的子节点
      expect(visited.some((name) => name.match(/^[A-F]$/))).toBe(true);
    });

    test("includeStartNode = true 包含起始节点（默认）", async () => {
      const visited: string[] = [];

      await tree.forEach(
        (node, children) => {
          visited.push(node.name);
          return true;
        },
        { mode: "dfs", includeStartNode: true },
      );

      // 应该包含根节点
      expect(visited[0]).toBe("root");
    });
  });

  describe("子节点信息", () => {
    test("callback 应该接收正确的子节点数组", async () => {
      const rootChildren: string[] = [];

      await tree.forEach(
        (node, children) => {
          if (node.name === "root") {
            // 验证根节点有 6 个子节点 (A-F)
            expect(children.length).toBe(6);
            rootChildren.push(...children.map((c) => c.name));
          }
          return true;
        },
        { mode: "dfs" },
      );

      expect(rootChildren).toContain("A");
      expect(rootChildren).toContain("B");
      expect(rootChildren).toContain("C");
      expect(rootChildren).toContain("D");
      expect(rootChildren).toContain("E");
      expect(rootChildren).toContain("F");
    });

    test("叶子节点的子节点数组应该为空", async () => {
      let leafNodeFound = false;

      await tree.forEach(
        (node, children) => {
          // 检查是否有叶子节点（没有子节点的节点）
          if (children.length === 0) {
            leafNodeFound = true;
          }
          return true;
        },
        { mode: "dfs" },
      );

      // demoTree 应该有叶子节点
      expect(leafNodeFound).toBe(true);
    });
  });

  describe("边界情况", () => {
    test("空树遍历应该抛出错误", async () => {
      const emptyTree = await createTreeManager();

      await expect(
        emptyTree.forEach((node, children) => {
          return true;
        }),
      ).rejects.toThrow("树中没有根节点");
    });

    test("只有根节点的树", async () => {
      const singleRootTree = await createTreeManager();
      await singleRootTree.write(async () => {
        await singleRootTree.createRoot({
          id: 1,
          name: "root",
          treeId: 1,
          title: "root-title",
          size: 100,
        });
      });

      const visited: string[] = [];

      await singleRootTree.forEach(
        (node, children) => {
          visited.push(node.name);
          expect(children.length).toBe(0); // 根节点没有子节点
          return true;
        },
        { mode: "dfs" },
      );

      expect(visited).toEqual(["root"]);
    });

    test("两级树的遍历", async () => {
      const twoLevelTree = await createTreeManager();
      await twoLevelTree.write(async () => {
        await twoLevelTree.createRoot({
          id: 1,
          name: "root",
          treeId: 1,
          title: "root-title",
          size: 100,
        });

        await twoLevelTree.addNodes([
          {
            id: 2,
            name: "child1",
            treeId: 1,
            title: "child1-title",
            size: 50,
          },
          {
            id: 3,
            name: "child2",
            treeId: 1,
            title: "child2-title",
            size: 60,
          },
        ]);
      });

      const visited: string[] = [];
      const childrenCounts: number[] = [];

      await twoLevelTree.forEach(
        (node, children) => {
          visited.push(node.name);
          childrenCounts.push(children.length);
          return true;
        },
        { mode: "dfs" },
      );

      expect(visited.length).toBe(3);
      expect(visited).toEqual(["root", "child1", "child2"]);
      expect(childrenCounts).toEqual([2, 0, 0]); // root有2个子节点，child1和child2没有
    });
  });

  describe("复杂场景", () => {
    test("查找特定节点", async () => {
      let foundNode = null;
      const targetName = "A-1-2";

      await tree.forEach(
        (node, children) => {
          if (node.name === targetName) {
            foundNode = node;
            return false; // 找到后中断
          }
          return true;
        },
        { mode: "bfs" },
      );

      expect(foundNode).not.toBeNull();
      expect(foundNode.name).toBe(targetName);
    });

    test("统计每层节点数", async () => {
      const levelCounts: Record<number, number> = {};

      await tree.forEach(
        (node, children) => {
          const level = node.level;
          levelCounts[level] = (levelCounts[level] || 0) + 1;
          return true;
        },
        { mode: "bfs" },
      );

      // 验证第0层（根节点）只有1个节点
      expect(levelCounts[0]).toBe(1);
      // 验证第1层有6个节点 (A-F)
      expect(levelCounts[1]).toBe(6);
      // 验证其他层也有节点
      expect(Object.keys(levelCounts).length).toBeGreaterThan(2);
    });

    test("计算所有节点的总子节点数", async () => {
      let totalChildren = 0;
      let nodeCount = 0;

      await tree.forEach(
        (node, children) => {
          totalChildren += children.length;
          nodeCount++;
          return true;
        },
        { mode: "dfs" },
      );

      // 总子节点数应该等于节点数减1（每个节点除了根节点都是某个节点的子节点）
      expect(totalChildren).toBe(nodeCount - 1);
    });
  });

  describe("性能测试", () => {
    test("DFS 和 BFS 应该访问相同数量的节点", async () => {
      let dfsCount = 0;
      let bfsCount = 0;

      await tree.forEach(
        (node, children) => {
          dfsCount++;
          return true;
        },
        { mode: "dfs" },
      );

      await tree.forEach(
        (node, children) => {
          bfsCount++;
          return true;
        },
        { mode: "bfs" },
      );

      expect(dfsCount).toBe(bfsCount);
    });

    test("DFS 和 BFS 访问的节点集合应该相同", async () => {
      const dfsNodes = new Set<string>();
      const bfsNodes = new Set<string>();

      await tree.forEach(
        (node, children) => {
          dfsNodes.add(node.name);
          return true;
        },
        { mode: "dfs" },
      );

      await tree.forEach(
        (node, children) => {
          bfsNodes.add(node.name);
          return true;
        },
        { mode: "bfs" },
      );

      expect(dfsNodes.size).toBe(bfsNodes.size);
      for (const nodeName of dfsNodes) {
        expect(bfsNodes.has(nodeName)).toBe(true);
      }
    });
  });
});
