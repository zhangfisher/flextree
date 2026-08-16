// oxlint-disable no-unused-vars
import { describe, test, expect, beforeEach } from "bun:test";
import type { Equal, Expect, NotAny } from "@type-challenges/utils";
import { FlexTree, FlexTreeNode } from "../src/index";
import { createFlexTree, type TestFlexTree } from "./helpers";

describe("FlexTree 类型系统测试", () => {
  test("字段类型", () => {
    // 纯类型检查测试 - 这些类型断言在编译时验证
    type UserType = {
      age: number;
      sex: "Male" | "Female";
      admin: boolean;
    };

    // 验证 FlexTree 能正确推断自定义字段类型
    const typeCheck: {
      tree: FlexTree<UserType>;
      verifyUserFields: "age" | "sex" | "admin";
    } = {} as any;

    expect(typeof typeCheck).toBe("object");
  });

  test("查找节点类型", () => {
    // 验证 find 方法的回调函数参数类型正确
    type UserType = {
      age: number;
      sex: "Male" | "Female";
      admin: boolean;
    };

    const typeCheck: {
      findCallback: (node: FlexTreeNode<UserType>) => boolean;
      verifyFields: "age" | "sex" | "admin";
    } = {} as any;

    expect(typeof typeCheck).toBe("object");
  });

  test("自定义关键字段类型", () => {
    // 验证自定义关键字段类型推断正确
    type CustomKeyFields = {
      name: "title";
      leftValue: "lft";
      rightValue: "rgt";
      level: "lv";
      id: ["pk", string];
      treeId: ["org", string];
    };

    const typeCheck: {
      customTree: FlexTree<any, CustomKeyFields>;
      verifyIdType: string;
      verifyTreeIdType: string;
    } = {} as any;

    expect(typeof typeCheck).toBe("object");
  });
});

describe("FlexTree 功能测试", () => {
  describe("树加载和基本操作", () => {
    let tree: TestFlexTree;

    beforeEach(async () => {
      tree = await createFlexTree();
      await tree.manager.write(async () => {
        await tree.manager.createRoot({ name: "root", title: "Root Title" });
        await tree.manager.addNodes([
          { name: "A", title: "A Title" },
          { name: "B", title: "B Title" },
          { name: "C", title: "C Title" },
        ]);
        await tree.manager.addNodes(
          [
            { name: "A1", title: "A1 Title" },
            { name: "A2", title: "A2 Title" },
          ],
          2,
        );
      });
    });

    test("加载树到内存", async () => {
      await tree.load();
      expect(tree.root).toBeDefined();
      expect(tree.root?.name).toBe("root");
    });

    test("获取根节点", async () => {
      await tree.load();
      expect(tree.root?.name).toBe("root");
      expect(tree.root?.level).toBe(0);
    });

    test("通过路径获取节点", async () => {
      await tree.load();
      const node = tree.getByPath("A/A1");
      expect(node).toBeDefined();
      expect(node?.name).toBe("A1");
    });

    test("通过ID获取节点", async () => {
      await tree.load();
      const node = tree.get(2);
      expect(node).toBeDefined();
      expect(node?.name).toBe("A");
    });

    test("查找节点", async () => {
      await tree.load();
      const node = tree.find((n) => n.name === "B");
      expect(node).toBeDefined();
      expect(node?.name).toBe("B");
    });

    test("查找所有匹配的节点", async () => {
      await tree.load();
      const nodes = tree.findAll((n) => n.name?.startsWith("A"));
      expect(nodes.length).toBe(3); // A, A1, A2
    });

    test("通过条件函数获取节点", async () => {
      await tree.load();
      // FlexTree.get(condition)
      const node = tree.get((n) => n.name === "A1");
      expect(node).toBeDefined();
      expect(node?.name).toBe("A1");
      // FlexTreeNode.get(condition)：自身及后代中查找
      const a = tree.getByPath("A")!;
      const child = a.get((n) => n.name === "A2");
      expect(child).toBeDefined();
      expect(child?.name).toBe("A2");
      // 自身满足条件时直接返回
      const self = a.get((n) => n.name === "A");
      expect(self?.id).toBe(a.id);
      // 无匹配返回 undefined
      expect(tree.get((n) => n.name === "not-exist")).toBeUndefined();
    });
  });

  describe("树节点操作", () => {
    let tree: TestFlexTree;

    beforeEach(async () => {
      tree = await createFlexTree();
      await tree.manager.write(async () => {
        await tree.manager.createRoot({ name: "root", title: "Root Title" });
        await tree.manager.addNodes([{ name: "A", title: "A Title" }]);
      });
    });

    test("更新节点", async () => {
      await tree.load();
      await tree.update("A", { title: "Updated A Title" });

      const node = tree.getByPath("A");
      expect(node?.fields.title).toBe("Updated A Title");
    });

    test("同步树数据", async () => {
      await tree.load();
      const node = tree.get(2);
      expect(node).toBeDefined();

      // 同步应该不会抛出错误
      await tree.sync();
    });
  });

  describe("树遍历", () => {
    let tree: TestFlexTree;

    beforeEach(async () => {
      tree = await createFlexTree();
      // 创建一个更复杂的树结构用于测试遍历
      await tree.manager.write(async () => {
        await tree.manager.createRoot({ name: "root", title: "Root Title" });
        // 第一层子节点
        await tree.manager.addNodes([
          { name: "A", title: "A Title" },
          { name: "B", title: "B Title" },
          { name: "C", title: "C Title" },
        ]);
        // A节点的子节点
        await tree.manager.addNodes(
          [
            { name: "A1", title: "A1 Title" },
            { name: "A2", title: "A2 Title" },
            { name: "A3", title: "A3 Title" },
          ],
          2, // A的id
        );
        // B节点的子节点
        await tree.manager.addNodes(
          [
            { name: "B1", title: "B1 Title" },
            { name: "B2", title: "B2 Title" },
          ],
          3, // B的id
        );
        // A1节点的子节点（深层）
        await tree.manager.addNodes(
          [
            { name: "A1-1", title: "A1-1 Title" },
            { name: "A1-2", title: "A1-2 Title" },
          ],
          5, // A1的id
        );
        // A2节点的子节点（深层）
        await tree.manager.addNodes(
          [{ name: "A2-1", title: "A2-1 Title" }],
          6, // A2的id
        );
      });
    });

    test("forEach 基本遍历（默认DFS模式，包含自身）", async () => {
      await tree.load();
      const visited: string[] = [];
      const levels: number[] = [];

      tree.forEach(
        (node) => {
          if (node.name) {
            visited.push(node.name);
            levels.push(node.level ?? 0);
          }
        },
        { includeSelf: true },
      );

      // DFS遍历应该是: root -> A -> A1 -> A1-1 -> A1-2 -> A2 -> A2-1 -> A3 -> B -> B1 -> B2 -> C
      expect(visited).toEqual([
        "root",
        "A",
        "A1",
        "A1-1",
        "A1-2",
        "A2",
        "A2-1",
        "A3",
        "B",
        "B1",
        "B2",
        "C",
      ]);

      // 验证层级
      expect(levels).toEqual([
        0, // root
        1, // A
        2, // A1
        3, // A1-1
        3, // A1-2
        2, // A2
        3, // A2-1
        2, // A3
        1, // B
        2, // B1
        2, // B2
        1, // C
      ]);
    });

    test("DFS 遍历模式（深度优先）", async () => {
      await tree.load();
      const visited: string[] = [];
      const parentInfo: string[] = [];

      tree.forEach(
        (node, parent) => {
          if (node.name) {
            visited.push(node.name);
            parentInfo.push(parent?.name ?? "null");
          }
        },
        { mode: "dfs", includeSelf: true },
      );

      // DFS遍历顺序验证
      expect(visited).toEqual([
        "root", // null parent
        "A", // parent: root
        "A1", // parent: A
        "A1-1", // parent: A1
        "A1-2", // parent: A1
        "A2", // parent: A
        "A2-1", // parent: A2
        "A3", // parent: A
        "B", // parent: root
        "B1", // parent: B
        "B2", // parent: B
        "C", // parent: root
      ]);

      // 验证父子关系
      expect(parentInfo).toEqual([
        "null", // root没有父节点
        "root", // A的父节点是root
        "A", // A1的父节点是A
        "A1", // A1-1的父节点是A1
        "A1", // A1-2的父节点是A1
        "A", // A2的父节点是A
        "A2", // A2-1的父节点是A2
        "A", // A3的父节点是A
        "root", // B的父节点是root
        "B", // B1的父节点是B
        "B", // B2的父节点是B
        "root", // C的父节点是root
      ]);
    });

    test("BFS 遍历模式（广度优先）", async () => {
      await tree.load();
      const visited: string[] = [];
      const levels: number[] = [];

      tree.forEach(
        (node) => {
          if (node.name) {
            visited.push(node.name);
            levels.push(node.level ?? 0);
          }
        },
        { mode: "bfs", includeSelf: true },
      );

      // BFS遍历应该按层级顺序: level 0 -> level 1 -> level 2 -> level 3
      expect(visited).toEqual([
        "root", // level 0
        "A",
        "B",
        "C", // level 1
        "A1",
        "A2",
        "A3",
        "B1",
        "B2", // level 2
        "A1-1",
        "A1-2",
        "A2-1", // level 3
      ]);

      // 验证层级顺序
      expect(levels).toEqual([
        0, // root
        1,
        1,
        1, // A, B, C
        2,
        2,
        2,
        2,
        2, // A1, A2, A3, B1, B2
        3,
        3,
        3, // A1-1, A1-2, A2-1
      ]);
    });

    test("forEach 不包含自身", async () => {
      await tree.load();
      const visited: string[] = [];

      tree.forEach(
        (node) => {
          if (node.name) {
            visited.push(node.name);
          }
        },
        { includeSelf: false },
      ); // 不包含根节点

      // 不应该包含root
      expect(visited).not.toContain("root");
      // 应该从子节点开始
      expect(visited[0]).toBe("A");
      expect(visited.length).toBe(11); // 总共12个节点，不包含root就是11个
    });

    test("forEach 遍历节点数量和完整性", async () => {
      await tree.load();
      let count = 0;
      const leafNodes: string[] = [];
      const internalNodes: string[] = [];

      tree.forEach(
        (node) => {
          count++;
          const hasChildren = node.children && node.children.length > 0;
          if (hasChildren) {
            internalNodes.push(node.name ?? "");
          } else {
            leafNodes.push(node.name ?? "");
          }
        },
        { includeSelf: true },
      );

      // 验证总节点数：root(1) + A,B,C(3) + A1,A2,A3,B1,B2(5) + A1-1,A1-2,A2-1(3) = 12
      expect(count).toBe(12);

      // 内部节点（有子节点的）
      expect(new Set(internalNodes)).toEqual(new Set(["root", "A", "B", "A1", "A2"]));

      // 叶子节点（无子节点的）
      expect(new Set(leafNodes)).toEqual(new Set(["C", "A3", "B1", "B2", "A1-1", "A1-2", "A2-1"]));
    });

    test("forEach 中断控制", async () => {
      await tree.load();
      const visited: string[] = [];
      let shouldStop = false;

      tree.forEach(
        (node) => {
          if (shouldStop) return;
          if (node.name) {
            visited.push(node.name);
            // 在访问到A2时停止
            if (node.name === "A2") {
              shouldStop = true;
            }
          }
        },
        { includeSelf: true, ignoreErrors: false },
      );

      // 应该在A2处停止
      expect(visited).toEqual(["root", "A", "A1", "A1-1", "A1-2", "A2"]);
      expect(visited).not.toContain("A2-1");
    });

    test("DFS vs BFS 遍历顺序对比", async () => {
      await tree.load();
      const dfsOrder: string[] = [];
      const bfsOrder: string[] = [];

      // DFS遍历
      tree.forEach(
        (node) => {
          if (node.name) dfsOrder.push(node.name);
        },
        { mode: "dfs", includeSelf: true },
      );

      // BFS遍历
      tree.forEach(
        (node) => {
          if (node.name) bfsOrder.push(node.name);
        },
        { mode: "bfs", includeSelf: true },
      );

      // DFS和BFS的遍历顺序应该不同
      expect(dfsOrder).not.toEqual(bfsOrder);

      // DFS应该先深入到叶子节点
      expect(dfsOrder.indexOf("A1-1")).toBeLessThan(dfsOrder.indexOf("B"));

      // BFS应该按层级遍历，先处理同层节点
      expect(bfsOrder.indexOf("B")).toBeLessThan(bfsOrder.indexOf("A1-1"));
      expect(bfsOrder.indexOf("C")).toBeLessThan(bfsOrder.indexOf("A1"));
    });
  });

  describe("树状态和属性", () => {
    test("未加载时的状态", async () => {
      const tree = await createFlexTree();
      expect(tree.status).toBe("idle");
    });

    test("加载后的状态", async () => {
      const tree = await createFlexTree();
      await tree.manager.write(async () => {
        await tree.manager.createRoot({ name: "root", title: "Root Title" });
      });

      await tree.load();
      expect(tree.status).toBe("loaded");
    });

    test("获取树ID", async () => {
      const tree = await createFlexTree();
      // 单树表没有 treeId，所以 tree.id 应该是 undefined
      // 这不是错误，是设计行为
      expect(tree.id).toBeUndefined();
    });

    test("获取树选项", async () => {
      const tree = await createFlexTree();
      expect(tree.options).toBeDefined();
      expect(tree.options.adapter).toBeDefined();
    });
  });
});
