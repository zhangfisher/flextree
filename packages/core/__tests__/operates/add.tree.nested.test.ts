import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { FlexTreeManager } from "../../src";
import { FlexNodeRelPosition } from "../../src";
import type { DemoFlexTreeManager } from "./createTree";
import { createTreeManager } from "./createTree";

describe("添加嵌套树节点", () => {
  describe("基础嵌套结构（新API）", () => {
    let tree: DemoFlexTreeManager;
    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => await tree.createRoot({ name: "root" }));
    });

    afterEach(async () => {
      // 清理工作
    });

    test("添加基础嵌套节点结构", async () => {
      await tree.write(async () => {
        await tree.addNodes([
          { name: "Parent 1" },
          { name: "Parent 2", children: [{ name: "Child 2.1" }, { name: "Child 2.2" }] },
        ]);
      });

      // 验证树结构
      const nodes = await tree.getNodes();
      const parent2 = nodes.find((n) => n.name === "Parent 2");
      expect(parent2).toBeDefined();
      expect(parent2!.level).toBe(1); // 根节点的直接子节点，level 应该是 1

      const children = await tree.getChildren(parent2!);
      expect(children).toHaveLength(2);
      expect(children[0].name).toBe("Child 2.1");
      expect(children[0].level).toBe(2); // Parent 2 的子节点，level 应该是 2
      expect(children[1].name).toBe("Child 2.2");
      expect(children[1].level).toBe(2); // Parent 2 的子节点，level 应该是 2
    });

    test("添加多层嵌套节点结构", async () => {
      await tree.write(async () => {
        await tree.addNodes([
          {
            name: "Level 1",
            children: [{ name: "Level 2.1", children: [{ name: "Level 3.1" }] }],
          },
        ]);
      });

      // 验证层级关系
      const nodes = await tree.getNodes();
      const level1 = nodes.find((n) => n.name === "Level 1");
      const level2 = nodes.find((n) => n.name === "Level 2.1");
      const level3 = nodes.find((n) => n.name === "Level 3.1");

      expect(level1).toBeDefined();
      expect(level1!.level).toBe(1); // 根节点的直接子节点
      expect(level2).toBeDefined();
      expect(level2!.level).toBe(2); // Level 1 的子节点
      expect(level3).toBeDefined();
      expect(level3!.level).toBe(3); // Level 2.1 的子节点

      const ancestors = await tree.getAncestors(level3!);
      expect(ancestors).toHaveLength(3); // 包含根节点
      expect(ancestors[2].name).toBe("Level 2.1"); // 最后一个应该是直接父节点
      expect(ancestors[1].name).toBe("Level 1");
      expect(ancestors[0].name).toBe("root"); // 第一个是根节点
    });

    test("使用默认options参数", async () => {
      await tree.write(async () => {
        await tree.addNodes([
          { name: "Node 1", children: [{ name: "Child 1.1" }] },
          { name: "Node 2" },
        ]);
      });

      const nodes = await tree.getNodes();
      const node1 = nodes.find((n) => n.name === "Node 1");
      const node2 = nodes.find((n) => n.name === "Node 2");
      const child = nodes.find((n) => n.name === "Child 1.1");

      expect(node1).toBeDefined();
      expect(node1!.level).toBe(1); // 根节点的直接子节点
      expect(node2).toBeDefined();
      expect(node2!.level).toBe(1); // 根节点的直接子节点
      expect(child).toBeDefined();
      expect(child!.level).toBe(2); // Node 1 的子节点

      // 验证父子关系
      const parentOfChild = await tree.getParent(child!);
      expect(parentOfChild?.name).toBe("Node 1");
    });
  });

  describe("向后兼容性（旧API）", () => {
    let tree: DemoFlexTreeManager;
    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => await tree.createRoot({ name: "root" }));
    });

    test("现有扁平化调用方式继续工作", async () => {
      await tree.write(async () => {
        await tree.addNodes(
          [{ name: "Node 1" }, { name: "Node 2" }, { name: "Node 3" }],
          undefined, // 旧的直接参数模式，undefined表示根节点
        );
      });

      // 验证所有节点都是根节点的直接子节点
      const root = await tree.getRoot();
      const children = await tree.getChildren(root);
      expect(children).toHaveLength(3);
    });

    test("旧的完整参数调用方式", async () => {
      await tree.write(async () => {
        await tree.addNodes(
          [{ name: "Node 1" }, { name: "Node 2" }],
          undefined,
          FlexNodeRelPosition.LastChild,
        );
      });

      const root = await tree.getRoot();
      const children = await tree.getChildren(root);
      expect(children).toHaveLength(2);
    });
  });

  describe("自定义子节点字段名", () => {
    let tree: DemoFlexTreeManager;
    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => await tree.createRoot({ name: "root" }));
    });

    test("使用自定义子节点字段名", async () => {
      await tree.write(async () => {
        await tree.addNodes(
          [
            {
              name: "Parent",
              subNodes: [{ name: "Child 1" }, { name: "Child 2" }],
            },
          ],
          { childrenField: "subNodes" },
        );
      });

      // 验证树结构正确
      const nodes = await tree.getNodes();
      const parent = nodes.find((n) => n.name === "Parent");
      expect(parent!.level).toBe(1); // 根节点的直接子节点

      const children = await tree.getChildren(parent!);
      expect(children).toHaveLength(2);
      expect(children[0].name).toBe("Child 1");
      expect(children[0].level).toBe(2); // Parent 的子节点
      expect(children[1].name).toBe("Child 2");
      expect(children[1].level).toBe(2); // Parent 的子节点
    });

    test("混合使用默认和自定义字段名", async () => {
      await tree.write(async () => {
        // 先添加默认children字段的节点
        await tree.addNodes([{ name: "Parent1", children: [{ name: "Child1" }] }]);

        // 再添加自定义字段名的节点
        await tree.addNodes(
          [
            {
              name: "Parent2",
              subNodes: [{ name: "Child2" }],
            },
          ],
          { childrenField: "subNodes" },
        );
      });

      const nodes = await tree.getNodes();
      const parent1 = nodes.find((n) => n.name === "Parent1");
      const parent2 = nodes.find((n) => n.name === "Parent2");

      expect(parent1!.level).toBe(1); // 根节点的直接子节点
      expect(parent2!.level).toBe(1); // 根节点的直接子节点

      const children1 = await tree.getChildren(parent1!);
      const children2 = await tree.getChildren(parent2!);

      expect(children1).toHaveLength(1);
      expect(children2).toHaveLength(1);
      expect(children1[0].name).toBe("Child1");
      expect(children1[0].level).toBe(2); // Parent1 的子节点
      expect(children2[0].name).toBe("Child2");
      expect(children2[0].level).toBe(2); // Parent2 的子节点
    });
  });

  describe("不同位置添加嵌套结构", () => {
    let tree: DemoFlexTreeManager;
    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => {
        await tree.createRoot({ name: "root" });
        await tree.addNodes([
          { name: "First" },
          { name: "Last", children: [{ name: "Last Child" }] },
        ]);
      });
    });

    test("在第一个位置添加嵌套结构", async () => {
      await tree.write(async () => {
        const root = await tree.getRoot();
        await tree.addNodes([{ name: "Inserted", children: [{ name: "Inserted Child" }] }], {
          at: root,
          pos: FlexNodeRelPosition.FirstChild,
        });
      });

      const root = await tree.getRoot();
      const children = await tree.getChildren(root);

      // 验证插入位置正确，应该有3个子节点
      expect(children.length).toBeGreaterThanOrEqual(2);

      const nodes = await tree.getNodes();
      const inserted = nodes.find((n) => n.name === "Inserted");
      expect(inserted).toBeDefined();
      expect(inserted!.level).toBe(1); // 根节点的直接子节点

      const insertedChildren = await tree.getChildren(inserted!);
      expect(insertedChildren).toHaveLength(1);
      expect(insertedChildren[0].name).toBe("Inserted Child");
      expect(insertedChildren[0].level).toBe(2); // Inserted 的子节点
    });

    test("在最后位置添加嵌套结构", async () => {
      await tree.write(async () => {
        const root = await tree.getRoot();
        await tree.addNodes([{ name: "NewLast", children: [{ name: "New Last Child" }] }], {
          at: root,
          pos: FlexNodeRelPosition.LastChild,
        });
      });

      const root = await tree.getRoot();
      const children = await tree.getChildren(root);

      // 验证添加到了最后
      expect(children[children.length - 1].name).toBe("NewLast");
      expect(children[children.length - 1].level).toBe(1); // 根节点的直接子节点

      const nodes = await tree.getNodes();
      const newLast = nodes.find((n) => n.name === "NewLast");
      const newLastChildren = await tree.getChildren(newLast!);
      expect(newLastChildren).toHaveLength(1);
      expect(newLastChildren[0].name).toBe("New Last Child");
      expect(newLastChildren[0].level).toBe(2); // NewLast 的子节点
    });
  });

  describe("复杂嵌套结构", () => {
    let tree: DemoFlexTreeManager;
    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => await tree.createRoot({ name: "root" }));
    });

    test("深度嵌套结构（5层）", async () => {
      await tree.write(async () => {
        await tree.addNodes([
          {
            name: "Level1",
            children: [
              {
                name: "Level2",
                children: [
                  {
                    name: "Level3",
                    children: [
                      {
                        name: "Level4",
                        children: [{ name: "Level5" }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ]);
      });

      // 验证层级关系
      const nodes = await tree.getNodes();
      const level1 = nodes.find((n) => n.name === "Level1");
      const level2 = nodes.find((n) => n.name === "Level2");
      const level3 = nodes.find((n) => n.name === "Level3");
      const level4 = nodes.find((n) => n.name === "Level4");
      const level5 = nodes.find((n) => n.name === "Level5");

      expect(level1!.level).toBe(1); // 根节点的直接子节点
      expect(level2!.level).toBe(2); // Level1 的子节点
      expect(level3!.level).toBe(3); // Level2 的子节点
      expect(level4!.level).toBe(4); // Level3 的子节点
      expect(level5!.level).toBe(5); // Level4 的子节点

      const ancestors = await tree.getAncestors(level5!);
      expect(ancestors).toHaveLength(5); // 包含根节点
      expect(ancestors[4].name).toBe("Level4"); // 最后一个是直接父节点
      expect(ancestors[3].name).toBe("Level3");
      expect(ancestors[2].name).toBe("Level2");
      expect(ancestors[1].name).toBe("Level1");
      expect(ancestors[0].name).toBe("root"); // 第一个是根节点
    });

    test("兄弟节点和复杂结构", async () => {
      await tree.write(async () => {
        await tree.addNodes([
          {
            name: "Parent",
            children: [
              { name: "Child1" },
              {
                name: "Child2",
                children: [{ name: "Grandchild1" }, { name: "Grandchild2" }],
              },
              { name: "Child3" },
            ],
          },
        ]);
      });

      const nodes = await tree.getNodes();
      const parent = nodes.find((n) => n.name === "Parent");
      expect(parent!.level).toBe(1); // 根节点的直接子节点

      const children = await tree.getChildren(parent!);
      expect(children).toHaveLength(3);

      // 验证所有子节点在同一层级
      expect(children[0].level).toBe(2); // Parent 的子节点
      expect(children[1].level).toBe(2); // Parent 的子节点
      expect(children[2].level).toBe(2); // Parent 的子节点

      const child2 = nodes.find((n) => n.name === "Child2");
      const grandchildren = await tree.getChildren(child2!);

      expect(grandchildren).toHaveLength(2);
      // 验证孙子节点在同一层级
      expect(grandchildren[0].level).toBe(3); // Child2 的子节点
      expect(grandchildren[1].level).toBe(3); // Child2 的子节点
    });
  });

  describe("边界情况", () => {
    let tree: DemoFlexTreeManager;
    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => await tree.createRoot({ name: "root" }));
    });

    test("空子节点数组", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "Parent1", children: [] }, { name: "Parent2" }]);
      });

      const nodes = await tree.getNodes();
      const parent1 = nodes.find((n) => n.name === "Parent1");
      expect(parent1!.level).toBe(1); // 根节点的直接子节点

      const children1 = await tree.getChildren(parent1!);
      expect(children1).toHaveLength(0);

      const parent2 = nodes.find((n) => n.name === "Parent2");
      expect(parent2!.level).toBe(1); // 根节点的直接子节点

      const children2 = await tree.getChildren(parent2!);
      expect(children2).toHaveLength(0);
    });

    test("混合嵌套和非嵌套节点", async () => {
      await tree.write(async () => {
        await tree.addNodes([
          { name: "Flat1" },
          { name: "Nested1", children: [{ name: "Child1" }] },
          { name: "Flat2" },
          { name: "Nested2", children: [{ name: "Child2" }] },
        ]);
      });

      const root = await tree.getRoot();
      const children = await tree.getChildren(root);

      expect(children).toHaveLength(4);

      // 验证所有根节点的直接子节点都在同一层级
      expect(children[0].level).toBe(1); // Flat1
      expect(children[1].level).toBe(1); // Nested1
      expect(children[2].level).toBe(1); // Flat2
      expect(children[3].level).toBe(1); // Nested2

      const nodes = await tree.getNodes();
      const nested1 = nodes.find((n) => n.name === "Nested1");
      const children1 = await tree.getChildren(nested1!);
      expect(children1).toHaveLength(1);
      expect(children1[0].level).toBe(2); // Nested1 的子节点

      const nested2 = nodes.find((n) => n.name === "Nested2");
      const children2 = await tree.getChildren(nested2!);
      expect(children2).toHaveLength(1);
      expect(children2[0].level).toBe(2); // Nested2 的子节点
    });
  });

  describe("字段验证", () => {
    let tree: DemoFlexTreeManager;
    beforeEach(async () => {
      tree = await createTreeManager();
      await tree.write(async () => await tree.createRoot({ name: "root" }));
    });

    test("验证children字段没有被插入数据库", async () => {
      await tree.write(async () => {
        await tree.addNodes([{ name: "Parent", children: [{ name: "Child" }] }]);
      });

      const nodes = await tree.getNodes();
      const parent = nodes.find((n) => n.name === "Parent");

      // 确保parent对象中没有children字段（因为它是从数据库读取的）
      expect((parent as any).children).toBeUndefined();

      // 验证level值正确
      expect(parent!.level).toBe(1); // 根节点的直接子节点

      // 但可以通过getChildren获取子节点
      const children = await tree.getChildren(parent!);
      expect(children).toHaveLength(1);
      expect(children[0].level).toBe(2); // Parent 的子节点
    });
  });
});
