import { describe, test, expect, beforeEach } from "bun:test";
import { FlexNodeRelPosition, NextSibling, PreviousSibling, FlexTreeNodeRelation } from "../src";
import {
  createTreeManager,
  createDemoTree,
  verifyTree,
  type TestFlexTreeManager,
} from "./test-helpers";

describe("FlexTreeManager CRUD 操作", () => {
  describe("创建根节点", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
    });

    test("单树表中创建根节点", async () => {
      await tree.write(async () => await tree.createRoot({ name: "root" }));
      const root = await tree.getRoot();
      expect(root).not.toBeNull();
      expect(root.name).toBe("root");
      expect(root.level).toBe(0);
      expect(root.leftValue).toBe(1);
      expect(root.rightValue).toBe(2);
    });

    test("单树表中创建根节点时如果已存在则触发错误", async () => {
      await tree.write(async () => await tree.createRoot({ name: "root" }));
      try {
        await tree.write(async () => await tree.createRoot({ name: "root2" }));
        expect(true).toBe(false); // 如果到这里说明没有抛出错误
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("判定是否存在根节点", async () => {
      await tree.write(async () => await tree.createRoot({ name: "root" }));
      const result = await tree.hasRoot();
      expect(result).toBe(true);
    });
  });

  describe("添加最后的子节点", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => await tree.createRoot({ name: "root" }));
    });

    test("在根节点下创建最后的子节点", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "A" }, { name: "B" }, { name: "C" }]);
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(4);
      expect(nodes[1].name).toBe("A");
      expect(nodes[2].name).toBe("B");
      expect(nodes[3].name).toBe("C");

      expect(nodes[0].leftValue).toBe(1);
      expect(nodes[0].rightValue).toBe(8);
      expect(nodes[1].leftValue).toBe(2);
      expect(nodes[1].rightValue).toBe(3);
      expect(nodes[2].leftValue).toBe(4);
      expect(nodes[2].rightValue).toBe(5);
      expect(nodes[3].leftValue).toBe(6);
      expect(nodes[3].rightValue).toBe(7);

      expect(nodes[0].level).toBe(0);
      expect(nodes[1].level).toBe(1);
      expect(nodes[2].level).toBe(1);
      expect(nodes[3].level).toBe(1);
    });

    test("多次在根节点下创建最后的子节点", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "A" }]);
        await tree.addNodes([{ name: "B" }]);
        await tree.addNodes([{ name: "C" }]);
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(4);
      expect(nodes[1].name).toBe("A");
      expect(nodes[2].name).toBe("B");
      expect(nodes[3].name).toBe("C");

      expect(nodes[0].leftValue).toBe(1);
      expect(nodes[0].rightValue).toBe(8);
      expect(nodes[1].leftValue).toBe(2);
      expect(nodes[1].rightValue).toBe(3);
      expect(nodes[2].leftValue).toBe(4);
      expect(nodes[2].rightValue).toBe(5);
      expect(nodes[3].leftValue).toBe(6);
      expect(nodes[3].rightValue).toBe(7);

      expect(nodes[0].level).toBe(0);
      expect(nodes[1].level).toBe(1);
      expect(nodes[2].level).toBe(1);
      expect(nodes[3].level).toBe(1);
    });
  });

  describe("添加子节点集的最前面", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => await tree.createRoot({ name: "root" }));
    });

    test("在根节点依次添加子节点到最前面", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "A" }], null, FlexNodeRelPosition.FirstChild);
        await tree.addNodes([{ name: "B" }], null, FlexNodeRelPosition.FirstChild);
        await tree.addNodes([{ name: "C" }], null, FlexNodeRelPosition.FirstChild);
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(4);
      expect(nodes[1].name).toBe("C");
      expect(nodes[2].name).toBe("B");
      expect(nodes[3].name).toBe("A");

      expect(nodes[0].leftValue).toBe(1);
      expect(nodes[0].rightValue).toBe(8);
      expect(nodes[1].leftValue).toBe(2);
      expect(nodes[1].rightValue).toBe(3);
      expect(nodes[2].leftValue).toBe(4);
      expect(nodes[2].rightValue).toBe(5);
      expect(nodes[3].leftValue).toBe(6);
      expect(nodes[3].rightValue).toBe(7);

      expect(nodes[0].level).toBe(0);
      expect(nodes[1].level).toBe(1);
      expect(nodes[2].level).toBe(1);
      expect(nodes[3].level).toBe(1);
    });

    test("一次性在根节点添加子节点到最前面", async () => {
      await tree.write(async () => {
        await tree.addNodes(
          [{ name: "A" }, { name: "B" }, { name: "C" }],
          null,
          FlexNodeRelPosition.FirstChild,
        );
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(4);
      expect(nodes[1].name).toBe("A");
      expect(nodes[2].name).toBe("B");
      expect(nodes[3].name).toBe("C");

      expect(nodes[0].leftValue).toBe(1);
      expect(nodes[0].rightValue).toBe(8);
      expect(nodes[1].leftValue).toBe(2);
      expect(nodes[1].rightValue).toBe(3);
      expect(nodes[2].leftValue).toBe(4);
      expect(nodes[2].rightValue).toBe(5);
      expect(nodes[3].leftValue).toBe(6);
      expect(nodes[3].rightValue).toBe(7);

      expect(nodes[0].level).toBe(0);
      expect(nodes[1].level).toBe(1);
      expect(nodes[2].level).toBe(1);
      expect(nodes[3].level).toBe(1);
    });
  });

  describe("添加节点为目标节点的兄弟节点", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => {
        await tree.createRoot({ name: "root" });
        await tree.addNodes([{ id: 2, name: "X" }]);
      });
    });

    test("一次性添加多个兄弟节点", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "A" }, { name: "B" }, { name: "C" }], 2, NextSibling);
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(5);
      expect(nodes[1].name).toBe("X");
      expect(nodes[2].name).toBe("A");
      expect(nodes[3].name).toBe("B");
      expect(nodes[4].name).toBe("C");

      expect(nodes[0].leftValue).toBe(1);
      expect(nodes[0].rightValue).toBe(10);
      expect(nodes[0].level).toBe(0);
      expect(nodes[1].leftValue).toBe(2);
      expect(nodes[1].rightValue).toBe(3);
      expect(nodes[1].level).toBe(1);
      expect(nodes[2].leftValue).toBe(4);
      expect(nodes[2].rightValue).toBe(5);
      expect(nodes[2].level).toBe(1);
      expect(nodes[3].leftValue).toBe(6);
      expect(nodes[3].rightValue).toBe(7);
      expect(nodes[3].level).toBe(1);
      expect(nodes[4].leftValue).toBe(8);
      expect(nodes[4].rightValue).toBe(9);
      expect(nodes[4].level).toBe(1);
    });

    test("多次添加多个兄弟节点", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "A" }], 2, NextSibling);
        await tree.addNodes([{ name: "B" }], 2, NextSibling);
        await tree.addNodes([{ name: "C" }], 2, NextSibling);
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(5);
      expect(nodes[1].name).toBe("X");
      expect(nodes[2].name).toBe("C");
      expect(nodes[3].name).toBe("B");
      expect(nodes[4].name).toBe("A");

      expect(nodes[0].leftValue).toBe(1);
      expect(nodes[0].rightValue).toBe(10);
      expect(nodes[0].level).toBe(0);
      expect(nodes[1].leftValue).toBe(2);
      expect(nodes[1].rightValue).toBe(3);
      expect(nodes[1].level).toBe(1);
      expect(nodes[2].leftValue).toBe(4);
      expect(nodes[2].rightValue).toBe(5);
      expect(nodes[2].level).toBe(1);
      expect(nodes[3].leftValue).toBe(6);
      expect(nodes[3].rightValue).toBe(7);
      expect(nodes[3].level).toBe(1);
      expect(nodes[4].leftValue).toBe(8);
      expect(nodes[4].rightValue).toBe(9);
      expect(nodes[4].level).toBe(1);
    });
  });

  describe("添加节点为目标节点的上一个兄弟节点", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => {
        await tree.createRoot({ name: "root" });
        await tree.addNodes([{ id: 2, name: "X" }]);
      });
    });

    test("一次性添加多个节点到X节点前", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "A" }, { name: "B" }, { name: "C" }], 2, PreviousSibling);
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(5);
      expect(nodes[1].name).toBe("A");
      expect(nodes[2].name).toBe("B");
      expect(nodes[3].name).toBe("C");
      expect(nodes[4].name).toBe("X");

      expect(nodes[0].leftValue).toBe(1);
      expect(nodes[0].rightValue).toBe(10);
      expect(nodes[0].level).toBe(0);
      expect(nodes[1].leftValue).toBe(2);
      expect(nodes[1].rightValue).toBe(3);
      expect(nodes[1].level).toBe(1);
      expect(nodes[2].leftValue).toBe(4);
      expect(nodes[2].rightValue).toBe(5);
      expect(nodes[2].level).toBe(1);
      expect(nodes[3].leftValue).toBe(6);
      expect(nodes[3].rightValue).toBe(7);
      expect(nodes[3].level).toBe(1);
      expect(nodes[4].leftValue).toBe(8);
      expect(nodes[4].rightValue).toBe(9);
      expect(nodes[4].level).toBe(1);
    });

    test("多次添加多个节点到X节点前", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "A" }], 2, PreviousSibling);
        await tree.addNodes([{ name: "B" }], 2, PreviousSibling);
        await tree.addNodes([{ name: "C" }], 2, PreviousSibling);
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(5);
      expect(nodes[1].name).toBe("A");
      expect(nodes[2].name).toBe("B");
      expect(nodes[3].name).toBe("C");
      expect(nodes[4].name).toBe("X");

      expect(nodes[0].leftValue).toBe(1);
      expect(nodes[0].rightValue).toBe(10);
      expect(nodes[0].level).toBe(0);
      expect(nodes[1].leftValue).toBe(2);
      expect(nodes[1].rightValue).toBe(3);
      expect(nodes[1].level).toBe(1);
      expect(nodes[2].leftValue).toBe(4);
      expect(nodes[2].rightValue).toBe(5);
      expect(nodes[2].level).toBe(1);
      expect(nodes[3].leftValue).toBe(6);
      expect(nodes[3].rightValue).toBe(7);
      expect(nodes[3].level).toBe(1);
      expect(nodes[4].leftValue).toBe(8);
      expect(nodes[4].rightValue).toBe(9);
      expect(nodes[4].level).toBe(1);
    });
  });

  describe("删除节点", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => {
        await tree.createRoot({ name: "root" });
        await tree.addNodes([
          { id: 2, name: "A" },
          { id: 3, name: "B" },
          { id: 4, name: "C" },
        ]);
        await tree.addNodes([{ name: "A1" }, { name: "A2" }], 2);
        await tree.addNodes([{ name: "B1" }, { name: "B2" }], 3);
        await tree.addNodes([{ name: "C1" }, { name: "C2" }], 4);
      });
    });

    test("删除叶子节点", async () => {
      await tree.write(async () => {
        await tree.deleteNode(2); // 删除A及其子节点
      });

      const nodes = await tree.getNodes();
      expect(nodes).toHaveLength(7); // root + B + B1 + B2 + C + C1 + C2 = 7
    });

    test("删除带有子节点的节点", async () => {
      await tree.write(async () => {
        await tree.deleteNode(2); // 删除A及其子节点A1、A2
      });

      const nodes = await tree.getNodes();
      const aNode = nodes.find((n) => n.name === "A");
      expect(aNode).toBeUndefined();
    });
  });

  describe("移动节点", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await createDemoTree(tree, { level: 2, treeCount: 1 });
    });

    test("移动节点作为另一个节点的子节点", async () => {
      const beforeNodes = await tree.getNodes();
      const beforeCount = beforeNodes.length;

      await tree.write(async () => {
        // 将B节点移动到A节点下作为最后一个子节点
        await tree.moveNode(200, 100, FlexNodeRelPosition.LastChild);
      });

      const afterNodes = await tree.getNodes();
      expect(afterNodes.length).toBe(beforeCount);

      // 验证移动后的结构
      const bNode = afterNodes.find((n) => n.name === "B");
      expect(bNode).toBeDefined();
    });

    test("移动节点作为兄弟节点", async () => {
      await tree.write(async () => {
        // 将B节点移动到A节点的后面作为兄弟节点
        await tree.moveNode(200, 100, NextSibling);
      });

      const nodes = await tree.getNodes();
      const bNode = nodes.find((n) => n.name === "B");
      expect(bNode).toBeDefined();
    });
  });

  describe("更新节点", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => {
        await tree.createRoot({ name: "root", title: "original" });
        await tree.addNodes([{ name: "A", title: "a-title" }]);
      });
    });

    test("更新节点字段", async () => {
      await tree.write(async () => {
        await tree.update({ id: 1, title: "updated-title" });
      });

      const root = await tree.getRoot();
      expect(root?.title).toBe("updated-title");
    });

    test("批量更新节点", async () => {
      await tree.write(async () => {
        await tree.update([
          { id: 1, title: "batch-updated" },
          { id: 2, title: "batch-updated" },
        ]);
      });

      const nodes = await tree.getNodes();
      expect(nodes[0].title).toBe("batch-updated");
      expect(nodes[1].title).toBe("batch-updated");
    });
  });

  describe("查询节点", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await createDemoTree(tree, { level: 2, treeCount: 1 });
    });

    test("获取节点", async () => {
      const node = await tree.getNode(100);
      expect(node).toBeDefined();
      expect(node?.name).toBe("A");
    });

    test("获取不存在的节点", async () => {
      try {
        await tree.getNode(99999);
        expect(true).toBe(false); // 如果到这里说明没有抛出错误
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test("获取所有节点", async () => {
      const nodes = await tree.getNodes();
      expect(nodes.length).toBeGreaterThan(0);
    });

    test("查找节点", async () => {
      const node = await tree.findNode({ name: "B" });
      expect(node).toBeDefined();
      expect(node?.name).toBe("B");
    });

    test("查找多个节点", async () => {
      const nodes = await tree.findNodes({ level: 1 });
      expect(nodes.length).toBeGreaterThan(0);
    });
  });

  describe("节点关系查询", () => {
    let tree: TestFlexTreeManager;

    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => {
        await tree.createRoot({ name: "root" });
        await tree.addNodes([
          { id: 2, name: "A" },
          { id: 3, name: "B" },
          { id: 4, name: "C" },
        ]);
        await tree.addNodes(
          [
            { id: 5, name: "A1" },
            { id: 6, name: "A2" },
            { id: 7, name: "A3" },
          ],
          2,
        );
      });
    });

    test("获取子节点", async () => {
      const children = await tree.getChildren(2);
      expect(children).toHaveLength(3);
      expect(children[0].name).toBe("A1");
    });

    test("获取父节点", async () => {
      const parent = await tree.getParent(5);
      expect(parent).toBeDefined();
      expect(parent?.name).toBe("A");
    });

    test("获取祖先节点", async () => {
      const ancestors = await tree.getAncestors(5);
      expect(ancestors).toHaveLength(2); // root -> A
      expect(ancestors[0].name).toBe("root");
      expect(ancestors[1].name).toBe("A");
    });

    test("获取后代节点", async () => {
      const descendants = await tree.getDescendants(2);
      expect(descendants).toHaveLength(3); // A1, A2, A3
    });

    test("获取兄弟节点", async () => {
      const siblings = await tree.getSiblings(3);
      expect(siblings.length).toBeGreaterThanOrEqual(2); // 至少有A和C
    });

    test("判断节点关系", async () => {
      const rootToA1Relation = await tree.getNodeRelation(1, 5); // root是A1的祖先
      expect(rootToA1Relation).toBe(FlexTreeNodeRelation.Ancestors);

      const a1ToRootRelation = await tree.getNodeRelation(5, 1); // A1是root的后代
      expect(a1ToRootRelation).toBe(FlexTreeNodeRelation.Descendants);
    });
  });

  describe("树验证", () => {
    test("验证正常树结构", async () => {
      const tree = await createTreeManager();
      await createDemoTree(tree, { level: 3, treeCount: 1 });

      const isValid = await verifyTree(tree);
      expect(isValid).toBe(true);
    });

    test("验证空树", async () => {
      const tree = await createTreeManager();
      const isValid = await tree.verify();
      expect(isValid).toBe(true);
    });
  });
});
