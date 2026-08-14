/**
 * 复制树节点测试
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { FirstChild, LastChild, NextSibling, PreviousSibling } from "../../src";
import type { DemoFlexTreeManager } from "../helpers";
import { createDemoTree, createTreeManager, verifyTree } from "../helpers";

describe("复制树节点", () => {
  let tree: DemoFlexTreeManager;
  let nodes: any[];
  let root: any;
  let a: any, a1: any;
  let b: any;

  beforeEach(async () => {
    tree = await createTreeManager();
    await createDemoTree(tree);
    nodes = await tree.getNodes();
    root = nodes.find((n) => n.name === "root")!;
    a = nodes.find((n) => n.name === "A")!;
    a1 = nodes.find((n) => n.name === "A-1")!;
    b = nodes.find((n) => n.name === "B")!;
  });

  describe("默认参数复制", () => {
    test("默认复制为源节点的下一个兄弟（含后代）", async () => {
      const beforeCount = nodes.length;
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id);
      });
      // 副本根位于 A 之后
      expect(copyRoot.name).toBe("A");
      expect(copyRoot.level).toBe(a.level);
      expect(copyRoot.leftValue).toBe(a.rightValue + 1);
      // 副本与源除 id 外字段相同
      expect(copyRoot.title).toBe(a.title);
      expect(copyRoot.id).not.toBe(a.id);
      // 后代一并复制（A 的子树宽度完整复制）
      const after = await tree.getNodes();
      expect(after.length - beforeCount).toBe(
        nodes.filter(
          (n) =>
            n.leftValue >= a.leftValue && n.rightValue <= a.rightValue,
        ).length,
      );
      await verifyTree(tree);
    });

    test("副本子树保持结构：左右值与源子树平移同构", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id);
      });
      // 用复制前的 nodes 圈定源子树（after 中源与副本同名同结构，无法区分）
      const srcSubtree = nodes
        .filter((n) => n.leftValue >= a.leftValue && n.rightValue <= a.rightValue)
        .sort((x, y) => x.leftValue - y.leftValue);
      const copySubtree = await tree.getDescendants(copyRoot.id);
      expect(copySubtree.length).toBe(srcSubtree.length - 1); // 不含副本根自身
      // 副本根的宽度与源一致
      expect(copyRoot.rightValue - copyRoot.leftValue).toBe(
        a.rightValue - a.leftValue,
      );
      await verifyTree(tree);
    });
  });

  describe("四种相对位置", () => {
    test("NextSibling：副本在 to 节点之后", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { to: b.id, pos: NextSibling });
      });
      expect(copyRoot.level).toBe(b.level);
      expect(copyRoot.leftValue).toBe(b.rightValue + 1);
      await verifyTree(tree);
    });

    test("PreviousSibling：副本在 to 节点之前", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { to: b.id, pos: PreviousSibling });
      });
      expect(copyRoot.level).toBe(b.level);
      const after = await tree.getNodes();
      const bAfter = after.find((n: any) => n.id === b.id)!;
      // 副本紧邻 b（腾挪后）的左侧
      expect(copyRoot.rightValue).toBe(bAfter.leftValue - 1);
      await verifyTree(tree);
    });

    test("LastChild：副本为 to 节点的最后一个子节点", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { to: b.id, pos: LastChild });
      });
      expect(copyRoot.level).toBe(b.level + 1);
      // 副本占据 B 原右值位置，B 的右值被推开
      const after = await tree.getNodes();
      const bAfter = after.find((n: any) => n.id === b.id)!;
      expect(copyRoot.rightValue).toBe(bAfter.rightValue - 1);
      expect(copyRoot.level).toBe(bAfter.level + 1);
      await verifyTree(tree);
    });

    test("FirstChild：副本为 to 节点的第一个子节点", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { to: b.id, pos: FirstChild });
      });
      expect(copyRoot.level).toBe(b.level + 1);
      expect(copyRoot.leftValue).toBe(b.leftValue + 1);
      await verifyTree(tree);
    });
  });

  describe("includeDescendants=false", () => {
    test("仅复制节点本身，副本为叶子", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { includeDescendants: false });
      });
      expect(copyRoot.rightValue - copyRoot.leftValue).toBe(1); // 叶子
      expect(copyRoot.level).toBe(a.level);
      const children = await tree.getChildren(copyRoot.id);
      expect(children.length).toBe(0);
      await verifyTree(tree);
    });
  });

  describe("to 缺省 + child 位（复制为源节点自身的孩子）", () => {
    test("FirstChild + to 缺省：副本成为源节点的第一个子节点", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { pos: FirstChild });
      });
      expect(copyRoot.level).toBe(a.level + 1);
      expect(copyRoot.leftValue).toBe(a.leftValue + 1);
      const children = await tree.getChildren(a.id);
      // 副本根成为 A 的第一个孩子
      expect(children[0].id).toBe(copyRoot.id);
      await verifyTree(tree);
    });

    test("LastChild + to 缺省：副本成为源节点的最后一个子节点", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { pos: LastChild });
      });
      expect(copyRoot.level).toBe(a.level + 1);
      const children = await tree.getChildren(a.id);
      expect(children[children.length - 1].id).toBe(copyRoot.id);
      await verifyTree(tree);
    });
  });

  describe("非法操作", () => {
    test("复制到自身后代节点之下抛错", async () => {
      await expect(
        tree.write(async () => {
          await tree.copyNode(a.id, { to: a1.id, pos: NextSibling });
        }),
      ).rejects.toThrow();
      await verifyTree(tree);
    });

    test("落点为根节点且 pos 为 sibling 位抛错", async () => {
      await expect(
        tree.write(async () => {
          await tree.copyNode(a.id, { to: root.id, pos: NextSibling });
        }),
      ).rejects.toThrow();
      await verifyTree(tree);
    });

    test("write 外调用抛错", async () => {
      await expect(tree.copyNode(a.id)).rejects.toThrow();
    });
  });

  describe("跨树复制", () => {
    test("复制到另一棵树：treeId 采用落点的树", async () => {
      // createTreeManager(N) 每次清空物理表，跨树复制需要两树共存于同一物理表，
      // 故复用 tree1 的 adapter 创建 tree2 的 manager
      const tree1 = await createTreeManager(1);
      await createDemoTree(tree1, { treeCount: 1 });
      const n1 = await tree1.getNodes();
      const a1Node = n1.find((n: any) => n.name === "A")!;

      const tree2 = new (tree1.constructor as any)("tree", {
        treeId: 2,
        adapter: tree1.adapter,
      });
      await tree2.write(async () => {
        await tree2.createRoot({ id: 5000, name: "root2", treeId: 2, title: "r2", size: 1 });
        await tree2.addNodes([{ id: 5100, name: "B2", treeId: 2, title: "b2", size: 1 }]);
      });
      const n2 = await tree2.getNodes();
      const b2Node = n2.find((n: any) => n.name === "B2")!;

      let copyRoot: any;
      await tree2.write(async () => {
        copyRoot = await tree2.copyNode(a1Node.id, { to: b2Node.id, pos: LastChild });
      });
      expect(copyRoot.treeId).toBe(2);
      expect(copyRoot.level).toBe(b2Node.level + 1);
      expect(copyRoot.id).not.toBe(a1Node.id);
      // 源子树保持原样
      const n1After = await tree1.getNodes();
      expect(n1After.find((n: any) => n.id === a1Node.id)!.leftValue).toBe(a1Node.leftValue);
    });

    test("通过 treeId 参数复制到另一棵树：to 指向目标树的节点", async () => {
      // tree1（当前 manager）复制到 tree2：to 是 tree2 中的节点 id
      const tree1 = await createTreeManager(1);
      await createDemoTree(tree1, { treeCount: 1 });
      const n1 = await tree1.getNodes();
      const a1Node = n1.find((n: any) => n.name === "A")!;

      const tree2 = new (tree1.constructor as any)("tree", {
        treeId: 2,
        adapter: tree1.adapter,
      });
      await tree2.write(async () => {
        await tree2.createRoot({ id: 5000, name: "root2", treeId: 2, title: "r2", size: 1 });
        await tree2.addNodes([{ id: 5100, name: "B2", treeId: 2, title: "b2", size: 1 }]);
      });
      const n2 = await tree2.getNodes();
      const b2Node = n2.find((n: any) => n.name === "B2")!;

      let copyRoot: any;
      await tree1.write(async () => {
        copyRoot = await tree1.copyNode(a1Node.id, {
          to: b2Node.id,
          pos: LastChild,
          treeId: 2,
        });
      });
      expect(copyRoot.treeId).toBe(2);
      expect(copyRoot.level).toBe(b2Node.level + 1);
      expect(copyRoot.id).not.toBe(a1Node.id);
      // 源子树保持原样
      const n1After = await tree1.getNodes();
      expect(n1After.find((n: any) => n.id === a1Node.id)!.leftValue).toBe(a1Node.leftValue);
      // 目标树内副本可正常访问
      const n2After = await tree2.getNodes();
      expect(n2After.find((n: any) => n.id === copyRoot.id)).toBeDefined();
    });

    test("treeId 等于当前树时行为与普通复制一致", async () => {
      // 多树表场景：显式传入当前 treeId，不应触发跨树分支
      const tree1 = await createTreeManager(1);
      await createDemoTree(tree1, { treeCount: 1 });
      const n1 = await tree1.getNodes();
      const a1Node = n1.find((n: any) => n.name === "A")!;
      const b1Node = n1.find((n: any) => n.name === "B")!;

      let copyRoot: any;
      await tree1.write(async () => {
        copyRoot = await tree1.copyNode(a1Node.id, {
          treeId: 1,
          to: b1Node.id,
          pos: NextSibling,
        });
      });
      expect(copyRoot.treeId).toBe(1);
      expect(copyRoot.level).toBe(b1Node.level);
      expect(copyRoot.leftValue).toBe(b1Node.rightValue + 1);
    });
  });

  describe("transformField 字段变换", () => {
    test("变换 id（自增表显式提供 id 表达式也生效）", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, {
          transformField: { id: "abs(random()%100000)+1000" },
        });
      });
      expect(copyRoot.id).not.toBe(a.id);
      await verifyTree(tree);
    });

    test("变换 name（sqlite: name || '-copy'）", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, {
          transformField: { name: "name || '-copy'" },
        });
      });
      expect(copyRoot.name).toBe(`${a.name}-copy`);
      await verifyTree(tree);
    });

    test("变换作用于子树所有节点", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, {
          transformField: { name: "name || '-copy'" },
        });
      });
      const descendants = await tree.getDescendants(copyRoot.id);
      expect(descendants.length).toBeGreaterThan(0);
      for (const d of descendants) {
        expect(d.name.endsWith("-copy")).toBe(true);
      }
    });

    test("变换任意自定义字段", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, {
          transformField: { size: "size * 2" },
        });
      });
      expect(copyRoot.size).toBe(a.size * 2);
      await verifyTree(tree);
    });

    test("多字段同时变换", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, {
          transformField: {
            id: "abs(random()%100000)+1000",
            name: "name || '-copy'",
            size: "size + 1",
          },
        });
      });
      expect(copyRoot.id).not.toBe(a.id);
      expect(copyRoot.name).toBe(`${a.name}-copy`);
      expect(copyRoot.size).toBe(a.size + 1);
      await verifyTree(tree);
    });

    test("树结构基础字段的变换被忽略", async () => {
      // treeId/leftValue/rightValue/level 由算法控制，提供变换不影响结果
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, {
          to: b.id,
          pos: NextSibling,
          transformField: {
            leftValue: "99999",
            rightValue: "99999",
            level: "999",
          } as any,
        });
      });
      // 结构正确：副本仍紧邻 b 之后，level 与 b 相同
      expect(copyRoot.level).toBe(b.level);
      expect(copyRoot.leftValue).toBe(b.rightValue + 1);
      await verifyTree(tree);
    });

    test("未提供变换的字段原样照抄", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, {
          transformField: { name: "name || '-copy'" },
        });
      });
      expect(copyRoot.title).toBe(a.title); // 未变换的字段照抄
      expect(copyRoot.size).toBe(a.size);
    });
  });

  describe("fields 字段筛选", () => {
    test("未指定 fields 时复制所有字段", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id);
      });
      // 测试表自定义字段：title、size 均被复制
      expect(copyRoot.title).toBe(a.title);
      expect(copyRoot.size).toBe(a.size);
    });

    test("指定 fields 时只复制指定字段", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { fields: ["title"] });
      });
      expect(copyRoot.title).toBe(a.title); // 指定的字段被复制
      expect(copyRoot.size).toBeNull();     // 未指定的字段不复制（sqlite 默认 NULL）
      expect(copyRoot.name).toBe(a.name);   // 关键字段 name 恒复制
      await verifyTree(tree);
    });

    test("fields 含全部字段时与全量复制等价", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { fields: ["title", "size"] });
      });
      expect(copyRoot.title).toBe(a.title);
      expect(copyRoot.size).toBe(a.size);
      await verifyTree(tree);
    });

    test("空数组表示仅复制关键字段", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { fields: [] });
      });
      expect(copyRoot.name).toBe(a.name);     // 关键字段恒复制
      expect(copyRoot.title).toBeNull();      // 自定义字段均不复制
      expect(copyRoot.size).toBeNull();
      await verifyTree(tree);
    });

    test("筛选字段对子树所有节点生效", async () => {
      let copyRoot: any;
      await tree.write(async () => {
        copyRoot = await tree.copyNode(a.id, { fields: ["title"] });
      });
      const descendants = await tree.getDescendants(copyRoot.id);
      expect(descendants.length).toBeGreaterThan(0);
      for (const d of descendants) {
        expect(d.title).toBeDefined();  // title 被复制
        expect(d.size).toBeNull();      // size 未复制
      }
    });
  });

  describe("连续复制与源完整性", () => {
    test("多次复制后树仍完整且源子树未变", async () => {
      const srcSubtreeBefore = nodes
        .filter((n) => n.leftValue >= a.leftValue && n.rightValue <= a.rightValue)
        .sort((x, y) => x.leftValue - y.leftValue)
        .map((n) => ({ name: n.name, level: n.level }));
      await tree.write(async () => {
        await tree.copyNode(a.id);
        await tree.copyNode(a.id);
        await tree.copyNode(a.id, { to: b.id, pos: LastChild });
      });
      await verifyTree(tree);
      const after = await tree.getNodes();
      const srcSubtreeAfter = after
        .filter((n: any) => n.name.startsWith("A"))
        .sort((x: any, y: any) => x.leftValue - y.leftValue);
      // 源子树的层级结构保持不变（名字重复但结构一致）
      const aAfter = after.find((n: any) => n.id === a.id)!;
      const srcAgain = after
        .filter(
          (n: any) => n.leftValue >= aAfter.leftValue && n.rightValue <= aAfter.rightValue,
        )
        .sort((x: any, y: any) => x.leftValue - y.leftValue)
        .map((n: any) => ({ name: n.name, level: n.level }));
      expect(srcAgain).toEqual(srcSubtreeBefore);
      expect(srcSubtreeAfter.length).toBeGreaterThan(0);
    });
  });
});
