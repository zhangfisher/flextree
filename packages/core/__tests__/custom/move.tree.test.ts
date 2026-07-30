// @ts-nocheck
/**
 * 更新树
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { FirstChild, LastChild, NextSibling, PreviousSibling } from "../../src";
import { FlexTreeNodeInvalidOperationError } from "../../src";
import type { CustomDemoFlexTreeManager } from "./createCustomTree";
import {
  createCustomDemoTree,
  createCustomTreeManager,
  verifyCustomTree,
} from "./createCustomTree";

describe("移动树节点", () => {
  let tree: CustomDemoFlexTreeManager;
  let nodes: any[];
  let root: any;
  let a: any, a1: any, a2: any, a3: any, a11: any, a12: any, a13: any;
  let b: any, b1: any, b2: any, b3: any, b11: any, b12: any, b13: any;
  let c: any, c1: any, c2: any, c3: any, c11: any, c12: any, c13: any;
  beforeEach(async () => {
    tree = await createCustomTreeManager();
    await createCustomDemoTree(tree);
    nodes = await tree.getNodes();
    root = nodes.find((n) => n.title === "root")!;
    a = nodes.find((n) => n.title === "A")!;
    a1 = nodes.find((n) => n.title === "A-1")!;
    a11 = nodes.find((n) => n.title === "A-1-1")!;
    a12 = nodes.find((n) => n.title === "A-1-2")!;
    a13 = nodes.find((n) => n.title === "A-1-3")!;
    a2 = nodes.find((n) => n.title === "A-2")!;
    a3 = nodes.find((n) => n.title === "A-3")!;

    b = nodes.find((n) => n.title === "B")!;
    b1 = nodes.find((n) => n.title === "B-1")!;
    b11 = nodes.find((n) => n.title === "B-1-1")!;
    b12 = nodes.find((n) => n.title === "B-1-2")!;
    b13 = nodes.find((n) => n.title === "B-1-3")!;
    b2 = nodes.find((n) => n.title === "B-2")!;
    b3 = nodes.find((n) => n.title === "B-3")!;

    c = nodes.find((n) => n.title === "C")!;
    c1 = nodes.find((n) => n.title === "C-1")!;
    c11 = nodes.find((n) => n.title === "C-1-1")!;
    c12 = nodes.find((n) => n.title === "C-1-2")!;
    c13 = nodes.find((n) => n.title === "C-1-3")!;
    c2 = nodes.find((n) => n.title === "C-2")!;
    c3 = nodes.find((n) => n.title === "C-3")!;
  });
  afterEach(async () => {
    //await dumpCustomTree(tree.adapter.db, 'move.db')
  });

  describe("判断是否允许移动节点到指定位置", () => {
    test("判定节点不允许移动到自身的任意位置", async () => {
      expect(await tree.canMoveTo(root, root)).toBe(false);
      expect(await tree.canMoveTo(a, a)).toBe(false);
      expect(await tree.canMoveTo(b, b)).toBe(false);
      expect(await tree.canMoveTo(c, c)).toBe(false);
    });

    test("判定节点不允许移动其后代节点的任意位置", async () => {
      // 不允许移动其后代的前后: 即兄弟节点
      expect(await tree.canMoveTo(root, a)).toBe(false);
      expect(await tree.canMoveTo(root, a1)).toBe(false);
      expect(await tree.canMoveTo(root, a11)).toBe(false);
      expect(await tree.canMoveTo(root, a12)).toBe(false);
      expect(await tree.canMoveTo(root, a13)).toBe(false);
      expect(await tree.canMoveTo(root, a2)).toBe(false);
      expect(await tree.canMoveTo(root, a3)).toBe(false);

      expect(await tree.canMoveTo(root, b)).toBe(false);
      expect(await tree.canMoveTo(root, b1)).toBe(false);
      expect(await tree.canMoveTo(root, b11)).toBe(false);
      expect(await tree.canMoveTo(root, b12)).toBe(false);
      expect(await tree.canMoveTo(root, b13)).toBe(false);
      expect(await tree.canMoveTo(root, b2)).toBe(false);
      expect(await tree.canMoveTo(root, b3)).toBe(false);

      expect(await tree.canMoveTo(root, c)).toBe(false);
      expect(await tree.canMoveTo(root, c1)).toBe(false);
      expect(await tree.canMoveTo(root, c11)).toBe(false);
      expect(await tree.canMoveTo(root, c12)).toBe(false);
      expect(await tree.canMoveTo(root, c13)).toBe(false);
      expect(await tree.canMoveTo(root, c2)).toBe(false);
      expect(await tree.canMoveTo(root, c3)).toBe(false);
      // A
      expect(await tree.canMoveTo(a, a1)).toBe(false);
      expect(await tree.canMoveTo(a, a11)).toBe(false);
      expect(await tree.canMoveTo(a, a12)).toBe(false);
      expect(await tree.canMoveTo(a, a13)).toBe(false);
      expect(await tree.canMoveTo(a, a2)).toBe(false);
      expect(await tree.canMoveTo(a, a3)).toBe(false);
    });
    test("判定节点允许移动指定节点的前后", async () => {
      expect(await tree.canMoveTo(a, b)).toBe(true);
      expect(await tree.canMoveTo(a1, a2)).toBe(true);
      expect(await tree.canMoveTo(a2, a3)).toBe(true);
      expect(await tree.canMoveTo(a3, a1)).toBe(true);

      expect(await tree.canMoveTo(b, c)).toBe(true);
      expect(await tree.canMoveTo(b1, b2)).toBe(true);
      expect(await tree.canMoveTo(b2, b3)).toBe(true);
      expect(await tree.canMoveTo(b3, b1)).toBe(true);
      expect(await tree.canMoveTo(b11, b12)).toBe(true);
      expect(await tree.canMoveTo(b12, b13)).toBe(true);
      expect(await tree.canMoveTo(b13, b11)).toBe(true);
      expect(await tree.canMoveTo(c, a)).toBe(true);
      expect(await tree.canMoveTo(c1, c2)).toBe(true);
      expect(await tree.canMoveTo(c2, c3)).toBe(true);
      expect(await tree.canMoveTo(c3, c1)).toBe(true);
      expect(await tree.canMoveTo(c11, c12)).toBe(true);
      expect(await tree.canMoveTo(c12, c13)).toBe(true);
      expect(await tree.canMoveTo(c13, c11)).toBe(true);
    });
    test("判定节点允许移动指定节点的子节点", async () => {
      expect(await tree.canMoveTo(a, b)).toBe(true);
      expect(await tree.canMoveTo(a1, a2)).toBe(true);
      expect(await tree.canMoveTo(a2, a3)).toBe(true);
      expect(await tree.canMoveTo(a3, a1)).toBe(true);
      expect(await tree.canMoveTo(a11, a12)).toBe(true);
      expect(await tree.canMoveTo(a12, a13)).toBe(true);
      expect(await tree.canMoveTo(a13, a11)).toBe(true);

      expect(await tree.canMoveTo(b, c)).toBe(true);
      expect(await tree.canMoveTo(b1, b2)).toBe(true);
      expect(await tree.canMoveTo(b2, b3)).toBe(true);
      expect(await tree.canMoveTo(b3, b1)).toBe(true);
      expect(await tree.canMoveTo(b11, b12)).toBe(true);
      expect(await tree.canMoveTo(b12, b13)).toBe(true);
      expect(await tree.canMoveTo(b13, b11)).toBe(true);
      expect(await tree.canMoveTo(c, a)).toBe(true);
      expect(await tree.canMoveTo(c1, c2)).toBe(true);
      expect(await tree.canMoveTo(c2, c3)).toBe(true);
      expect(await tree.canMoveTo(c3, c1)).toBe(true);
      expect(await tree.canMoveTo(c11, c12)).toBe(true);
      expect(await tree.canMoveTo(c12, c13)).toBe(true);
      expect(await tree.canMoveTo(c13, c11)).toBe(true);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });

  describe("移动节点到目标节点的后面成为其下一个兄弟节点", async () => {
    // 向下移动:  目标节点在源节点的下面
    test("move A-1-1 to the next sibling node of A_1_2", async () => {
      let a1 = await tree.findNode({ title: "A-1-1" })!;
      let a2 = await tree.findNode({ title: "A-1-2" })!;
      await tree.write(async () => {
        await tree.moveNode(a1!.pk, a2!.pk, NextSibling);
      });
      const a = await tree.findNode({ title: "A-1" })!;
      a1 = await tree.findNode({ title: "A-1-1" })!;
      a2 = await tree.findNode({ title: "A-1-2" })!;
      a3 = await tree.findNode({ title: "A-1-3" })!;
      const a4 = await tree.findNode({ title: "A-1-4" })!;
      const a5 = await tree.findNode({ title: "A-1-5" })!;

      expect(a2.lft).toBe(a.lft + 1);
      expect(a2.rgt).toBe(a.lft + 2);
      expect(a1.lft).toBe(a.lft + 3);
      expect(a1.rgt).toBe(a.lft + 4);
      expect(a3.lft).toBe(a.lft + 5);
      expect(a3.rgt).toBe(a.lft + 6);
      expect(a4.lft).toBe(a.lft + 7);
      expect(a4.rgt).toBe(a.lft + 8);
      expect(a5.lft).toBe(a.lft + 9);
      expect(a5.rgt).toBe(a.lft + 10);
      expect(a.rgt).toBe(a.lft + 11);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("move A-1-1 sequentially to the next sibling node of A_1_2,A-1-3,A-1-4,A-1-5", async () => {
      let a1 = await tree.findNode({ title: "A-1-1" })!;
      let a2 = await tree.findNode({ title: "A-1-2" })!;
      let a3 = await tree.findNode({ title: "A-1-3" })!;
      let a4 = await tree.findNode({ title: "A-1-4" })!;
      let a5 = await tree.findNode({ title: "A-1-5" })!;

      await tree.write(async () => {
        await tree.moveNode(a1.pk, a2.pk, NextSibling);
        await tree.moveNode(a1.pk, a3.pk, NextSibling);
        await tree.moveNode(a1.pk, a4.pk, NextSibling);
        await tree.moveNode(a1.pk, a5.pk, NextSibling);
      });
      const a = await tree.findNode({ title: "A-1" })!;
      a1 = await tree.findNode({ title: "A-1-1" })!;
      a2 = await tree.findNode({ title: "A-1-2" })!;
      a3 = await tree.findNode({ title: "A-1-3" })!;
      a4 = await tree.findNode({ title: "A-1-4" })!;
      a5 = await tree.findNode({ title: "A-1-5" })!;

      expect(a2.lft).toBe(a.lft + 1);
      expect(a2.rgt).toBe(a.lft + 2);
      expect(a3.lft).toBe(a.lft + 3);
      expect(a3.rgt).toBe(a.lft + 4);
      expect(a4.lft).toBe(a.lft + 5);
      expect(a4.rgt).toBe(a.lft + 6);
      expect(a5.lft).toBe(a.lft + 7);
      expect(a5.rgt).toBe(a.lft + 8);
      expect(a1.lft).toBe(a.lft + 9);
      expect(a1.rgt).toBe(a.lft + 10);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("move A to the next sibling node of B,C,D,E,F", async () => {
      const a = await tree.findNode({ title: "A" })!;
      const b = await tree.findNode({ title: "B" })!;
      const c = await tree.findNode({ title: "C" })!;
      const d = await tree.findNode({ title: "D" })!;
      const e = await tree.findNode({ title: "E" })!;
      const f = await tree.findNode({ title: "F" })!;
      await tree.write(async () => {
        await tree.moveNode(a.pk, b.pk, NextSibling);
        await tree.moveNode(a.pk, c.pk, NextSibling);
        await tree.moveNode(a.pk, d.pk, NextSibling);
        await tree.moveNode(a.pk, e.pk, NextSibling);
        await tree.moveNode(a.pk, f.pk, NextSibling);
      });

      expect(await verifyCustomTree(tree)).toBe(true);
    });

    // 向上移动：目标节点在源节点的上面
    test("向上同级内移动到前面的目标下一个兄弟节点", async () => {
      let a2 = await tree.findNode({ title: "A-1-2" })!;
      let a5 = await tree.findNode({ title: "A-1-5" })!;
      await tree.write(async () => {
        await tree.moveNode(a5.pk, a2.pk, NextSibling);
      });
      a2 = await tree.findNode({ title: "A-1-2" })!;
      a5 = await tree.findNode({ title: "A-1-5" })!;

      expect(a5.lft).toBe(a2.rgt + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向上同级内连续多下移动到前面的目标同级内的下一个兄弟节点", async () => {
      const a1 = await tree.findNode({ title: "A-1-1" })!;
      const a2 = await tree.findNode({ title: "A-1-2" })!;
      const a3 = await tree.findNode({ title: "A-1-3" })!;
      const a5 = await tree.findNode({ title: "A-1-5" })!;

      await tree.write(async () => {
        await tree.moveNode(a5.pk, a3.pk, NextSibling);
        await tree.moveNode(a5.pk, a2.pk, NextSibling);
        await tree.moveNode(a5.pk, a1.pk, NextSibling);
      });
      //   a1 = await tree.findNode({ title: 'A-1-1' })!
      //   a2 = await tree.findNode({ title: 'A-1-2' })!
      //   a3 = await tree.findNode({ title: 'A-1-3' })!
      //   a4 = await tree.findNode({ title: 'A-1-4' })!
      //   a5 = await tree.findNode({ title: 'A-1-5' })!

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向上移动子树到同级内的前面的目标节点的下一个兄弟节点", async () => {
      const a = await tree.findNode({ title: "A" })!;
      const b = await tree.findNode({ title: "B" })!;
      const c = await tree.findNode({ title: "C" })!;
      const d = await tree.findNode({ title: "D" })!;
      const f = await tree.findNode({ title: "F" })!;
      await tree.write(async () => {
        await tree.moveNode(f.pk, d.pk, NextSibling);
        await tree.moveNode(f.pk, c.pk, NextSibling);
        await tree.moveNode(f.pk, b.pk, NextSibling);
        await tree.moveNode(f.pk, a.pk, NextSibling);
      });

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("a_1_2移动为B_2_3的下一个兄弟节点", async () => {
      let a12 = await tree.findNode({ title: "A-1-2" })!;
      let b23 = await tree.findNode({ title: "B-2-3" })!;

      await tree.write(async () => {
        await tree.moveNode(a12.pk, b23.pk, NextSibling);
      });
      a12 = await tree.findNode({ title: "A-1-2" })!;
      b23 = await tree.findNode({ title: "B-2-3" })!;
      expect(a12.lft).toBe(b23.rgt + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("b_2_3移动为A_1_2的下一个兄弟节点", async () => {
      let a12 = await tree.findNode({ title: "A-1-2" })!;
      let b23 = await tree.findNode({ title: "B-2-3" })!;

      await tree.write(async () => {
        await tree.moveNode(b23, a12, NextSibling);
      });
      a12 = await tree.findNode({ title: "A-1-2" })!;
      b23 = await tree.findNode({ title: "B-2-3" })!;

      expect(b23.lft).toBe(a12.rgt + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("移动C-5-5为C-5的下一个兄弟节点", async () => {
      let c55 = await tree.findNode({ title: "C-5-5" });
      let c5 = await tree.findNode({ title: "C-5" });

      await tree.write(async () => {
        await tree.moveNode(c55, c5, NextSibling);
      });
      c5 = await tree.findNode({ title: "C-5" });
      c55 = await tree.findNode({ title: "C-5-5" });
      expect(c55.lft).toBe(c5.rgt + 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });
  describe("移动节点到目标节点的前面成为其上一个兄弟节点", async () => {
    // 目标节点在源节点的前面
    test("同级内移动到上一个兄弟节点", async () => {
      let a1 = await tree.findNode({ title: "A-1-1" })!;
      let a2 = await tree.findNode({ title: "A-1-2" })!;
      await tree.write(async () => {
        await tree.moveNode(a2.pk, a1.pk, PreviousSibling);
      });
      const a = await tree.findNode({ title: "A-1" })!;
      a1 = await tree.findNode({ title: "A-1-1" })!;
      a2 = await tree.findNode({ title: "A-1-2" })!;
      a3 = await tree.findNode({ title: "A-1-3" })!;
      const a4 = await tree.findNode({ title: "A-1-4" })!;
      const a5 = await tree.findNode({ title: "A-1-5" })!;

      expect(a2.lft).toBe(a.lft + 1);
      expect(a2.rgt).toBe(a.lft + 2);
      expect(a1.lft).toBe(a.lft + 3);
      expect(a1.rgt).toBe(a.lft + 4);
      expect(a3.lft).toBe(a.lft + 5);
      expect(a3.rgt).toBe(a.lft + 6);
      expect(a4.lft).toBe(a.lft + 7);
      expect(a4.rgt).toBe(a.lft + 8);
      expect(a5.lft).toBe(a.lft + 9);
      expect(a5.rgt).toBe(a.lft + 10);
      expect(a.rgt).toBe(a.lft + 11);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向上同级内连续移动到上一个兄弟节点", async () => {
      let a1 = await tree.findNode({ title: "A-1-1" })!;
      let a2 = await tree.findNode({ title: "A-1-2" })!;
      let a3 = await tree.findNode({ title: "A-1-3" })!;
      let a4 = await tree.findNode({ title: "A-1-4" })!;
      let a5 = await tree.findNode({ title: "A-1-5" })!;

      await tree.write(async () => {
        await tree.moveNode(a5.pk, a4.pk, PreviousSibling);
        await tree.moveNode(a5.pk, a3.pk, PreviousSibling);
        await tree.moveNode(a5.pk, a2.pk, PreviousSibling);
        await tree.moveNode(a5.pk, a1.pk, PreviousSibling);
      });
      const a = await tree.findNode({ title: "A-1" })!;
      a1 = await tree.findNode({ title: "A-1-1" })!;
      a2 = await tree.findNode({ title: "A-1-2" })!;
      a3 = await tree.findNode({ title: "A-1-3" })!;
      a4 = await tree.findNode({ title: "A-1-4" })!;
      a5 = await tree.findNode({ title: "A-1-5" })!;

      expect(a5.lft).toBe(a.lft + 1);
      expect(a5.rgt).toBe(a.lft + 2);
      expect(a1.lft).toBe(a.lft + 3);
      expect(a1.rgt).toBe(a.lft + 4);
      expect(a2.lft).toBe(a.lft + 5);
      expect(a2.rgt).toBe(a.lft + 6);
      expect(a3.lft).toBe(a.lft + 7);
      expect(a3.rgt).toBe(a.lft + 8);
      expect(a4.lft).toBe(a.lft + 9);
      expect(a4.rgt).toBe(a.lft + 10);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向上移动子树到同级内的目标节点的上一个兄弟节点", async () => {
      let a = await tree.findNode({ title: "A" })!;
      let b = await tree.findNode({ title: "B" })!;
      let c = await tree.findNode({ title: "C" })!;
      let d = await tree.findNode({ title: "D" })!;
      let e = await tree.findNode({ title: "E" })!;
      let f = await tree.findNode({ title: "F" })!;
      await tree.write(async () => {
        await tree.moveNode(f.pk, e.pk, PreviousSibling);
        await tree.moveNode(f.pk, d.pk, PreviousSibling);
        await tree.moveNode(f.pk, c.pk, PreviousSibling);
        await tree.moveNode(f.pk, b.pk, PreviousSibling);
        await tree.moveNode(f.pk, a.pk, PreviousSibling);
      });
      a = await tree.findNode({ title: "A" })!;
      b = await tree.findNode({ title: "B" })!;
      c = await tree.findNode({ title: "C" })!;
      d = await tree.findNode({ title: "D" })!;
      e = await tree.findNode({ title: "E" })!;
      f = await tree.findNode({ title: "F" })!;

      expect(a.lft).toBe(f.rgt + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向上移动子树到不同级内的目标节点的上一个兄弟节点", async () => {
      let a1 = await tree.findNode({ title: "A-1" })!;
      let b5 = await tree.findNode({ title: "B-5" })!;
      await tree.write(async () => {
        await tree.moveNode(b5.pk, a1.pk, PreviousSibling);
      });
      a1 = await tree.findNode({ title: "A-1" })!;
      b5 = await tree.findNode({ title: "B-5" })!;
      expect(a1.lft).toBe(b5.rgt + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });

    // 目标节点在源节点的后面
    test("向下同级内移动到上一个兄弟节点", async () => {
      let a1 = await tree.findNode({ title: "A-1-1" })!;
      let a3 = await tree.findNode({ title: "A-1-3" })!;
      await tree.write(async () => {
        await tree.moveNode(a1.pk, a3.pk, PreviousSibling);
      });
      const a = await tree.findNode({ title: "A-1" })!;
      a1 = await tree.findNode({ title: "A-1-1" })!;
      a2 = await tree.findNode({ title: "A-1-2" })!;
      a3 = await tree.findNode({ title: "A-1-3" })!;

      expect(a2.lft).toBe(a.lft + 1);
      expect(a2.rgt).toBe(a.lft + 2);
      expect(a1.lft).toBe(a.lft + 3);
      expect(a1.rgt).toBe(a.lft + 4);
      expect(a3.lft).toBe(a.lft + 5);
      expect(a3.rgt).toBe(a.lft + 6);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向下同级内连续移动到上一个兄弟节点", async () => {
      let a1 = await tree.findNode({ title: "A-1-1" })!;
      let a2 = await tree.findNode({ title: "A-1-2" })!;
      let a3 = await tree.findNode({ title: "A-1-3" })!;
      let a4 = await tree.findNode({ title: "A-1-4" })!;
      let a5 = await tree.findNode({ title: "A-1-5" })!;

      await tree.write(async () => {
        await tree.moveNode(a1.pk, a2.pk, PreviousSibling);
        await tree.moveNode(a1.pk, a3.pk, PreviousSibling);
        await tree.moveNode(a1.pk, a3.pk, PreviousSibling);
        await tree.moveNode(a1.pk, a5.pk, PreviousSibling);
      });
      const a = await tree.findNode({ title: "A-1" })!;
      a1 = await tree.findNode({ title: "A-1-1" })!;
      a2 = await tree.findNode({ title: "A-1-2" })!;
      a3 = await tree.findNode({ title: "A-1-3" })!;
      a4 = await tree.findNode({ title: "A-1-4" })!;
      a5 = await tree.findNode({ title: "A-1-5" })!;

      expect(a2.lft).toBe(a.lft + 1);
      expect(a2.rgt).toBe(a.lft + 2);
      expect(a3.lft).toBe(a.lft + 3);
      expect(a3.rgt).toBe(a.lft + 4);
      expect(a4.lft).toBe(a.lft + 5);
      expect(a4.rgt).toBe(a.lft + 6);
      expect(a1.lft).toBe(a.lft + 7);
      expect(a1.rgt).toBe(a.lft + 8);
      expect(a5.lft).toBe(a.lft + 9);
      expect(a5.rgt).toBe(a.lft + 10);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向下移动子树到同级内的目标节点的上一个兄弟节点", async () => {
      let a = await tree.findNode({ title: "A" })!;
      let b = await tree.findNode({ title: "B" })!;
      let c = await tree.findNode({ title: "C" })!;
      let d = await tree.findNode({ title: "D" })!;
      let e = await tree.findNode({ title: "E" })!;
      let f = await tree.findNode({ title: "F" })!;
      await tree.write(async () => {
        await tree.moveNode(f.pk, e.pk, PreviousSibling);
        await tree.moveNode(f.pk, d.pk, PreviousSibling);
        await tree.moveNode(f.pk, c.pk, PreviousSibling);
        await tree.moveNode(f.pk, b.pk, PreviousSibling);
        await tree.moveNode(f.pk, a.pk, PreviousSibling);
      });
      a = await tree.findNode({ title: "A" })!;
      b = await tree.findNode({ title: "B" })!;
      c = await tree.findNode({ title: "C" })!;
      d = await tree.findNode({ title: "D" })!;
      e = await tree.findNode({ title: "E" })!;
      f = await tree.findNode({ title: "F" })!;

      expect(a.lft).toBe(f.rgt + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向下移动子树到不同级内的目标节点的上一个兄弟节点", async () => {
      let a1 = await tree.findNode({ title: "A-1" })!;
      let b5 = await tree.findNode({ title: "B-5" })!;
      await tree.write(async () => {
        await tree.moveNode(a1.pk, b5.pk, PreviousSibling);
      });
      a1 = await tree.findNode({ title: "A-1" })!;
      b5 = await tree.findNode({ title: "B-5" })!;
      expect(b5.lft).toBe(a1.rgt + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("移动F-5-5为F-5-4的上一个兄弟节点", async () => {
      let f55 = await tree.findNode({ title: "F-5-5" });
      const f54 = await tree.findNode({ title: "F-5-4" });
      const f53 = await tree.findNode({ title: "F-5-3" });
      const f52 = await tree.findNode({ title: "F-5-2" });
      const f51 = await tree.findNode({ title: "F-5-1" });

      await tree.write(async () => {
        await tree.moveNode(f55, f54, PreviousSibling);
        // 因为移动后f55的左右值已经变化，所以需要重新获取f55
        f55 = await tree.findNode({ title: "F-5-5" });
        await tree.moveNode(f55, f53, PreviousSibling);
        f55 = await tree.findNode({ title: "F-5-5" });
        await tree.moveNode(f55, f52, PreviousSibling);
        f55 = await tree.findNode({ title: "F-5-5" });
        await tree.moveNode(f55, f51, PreviousSibling);
      });
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("移动C-5-5为C-5的上一个兄弟节点", async () => {
      let c55 = await tree.findNode({ title: "C-5-5" });
      let c5 = await tree.findNode({ title: "C-5" });

      await tree.write(async () => {
        await tree.moveNode(c55, c5, PreviousSibling);
      });
      c5 = await tree.findNode({ title: "C-5" });
      c55 = await tree.findNode({ title: "C-5-5" });
      expect(c5.lft).toBe(c55.rgt + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });

  describe("移动节点为目标节点最后一个子节点", async () => {
    // 向下移动： 即目标节点在源节点后面
    test("a-1-1移动为A-1-3的最后一个子节点", async () => {
      let a11 = await tree.findNode({ title: "A-1-1" })!;
      let a13 = await tree.findNode({ title: "A-1-3" })!;
      await tree.write(async () => {
        await tree.moveNode(a11.pk, a13.pk, LastChild);
      });
      a13 = await tree.findNode({ title: "A-1-3" })!;
      a11 = await tree.findNode({ title: "A-1-1" })!;

      expect(a11.level).toBe(a13.level + 1);
      expect(a11.rgt + 1).toBe(a13.rgt);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("a移动为B的最后一个子节点", async () => {
      let a = await tree.findNode({ title: "A" })!;
      let b = await tree.findNode({ title: "B" })!;
      await tree.write(async () => {
        await tree.moveNode(a, b, LastChild);
      });
      a = await tree.findNode({ title: "A" })!;
      b = await tree.findNode({ title: "B" })!;
      expect(a.level).toBe(b.level + 1);
      expect(a.rgt).toBe(b.rgt - 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("a移动为B-1-2的最后一个子节点", async () => {
      let a = await tree.findNode({ title: "A" })!;
      let b = await tree.findNode({ title: "B-1-2" })!;
      await tree.write(async () => {
        await tree.moveNode(a, b, LastChild);
      });
      a = await tree.findNode({ title: "A" })!;
      b = await tree.findNode({ title: "B-1-2" })!;
      expect(a.level).toBe(b.level + 1);
      expect(a.rgt).toBe(b.rgt - 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });

    // 向上移动： 即目标节点在源节点前面
    test("a-1-3移动为A-1-1的最后一个子节点", async () => {
      let a11 = await tree.findNode({ title: "A-1-1" })!;
      let a13 = await tree.findNode({ title: "A-1-3" })!;
      await tree.write(async () => {
        await tree.moveNode(a13, a11, LastChild);
      });
      a13 = await tree.findNode({ title: "A-1-3" })!;
      a11 = await tree.findNode({ title: "A-1-1" })!;

      expect(a13.level).toBe(a11.level + 1);
      expect(a13.rgt + 1).toBe(a11.rgt);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("b移动为A的最后一个子节点", async () => {
      let a = await tree.findNode({ title: "A" })!;
      let b = await tree.findNode({ title: "B" })!;
      await tree.write(async () => {
        await tree.moveNode(b, a, LastChild);
      });
      a = await tree.findNode({ title: "A" })!;
      b = await tree.findNode({ title: "B" })!;
      expect(b.level).toBe(a.level + 1);
      expect(b.rgt).toBe(a.rgt - 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("c移动为A-1-2的最后一个子节点", async () => {
      let c = await tree.findNode({ title: "C" })!;
      let a = await tree.findNode({ title: "A-1-2" })!;
      await tree.write(async () => {
        await tree.moveNode(c, a, LastChild);
      });
      c = await tree.findNode({ title: "C" })!;
      a = await tree.findNode({ title: "A-1-2" })!;
      expect(c.level).toBe(a.level + 1);
      expect(c.rgt).toBe(a.rgt - 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });

  describe("移动节点为目标节点第一个子节点", async () => {
    // 向下移动： 即目标节点在源节点后面
    test("a-1-1移动为A-1-3的第一个子节点", async () => {
      let a11 = await tree.findNode({ title: "A-1-1" })!;
      let a13 = await tree.findNode({ title: "A-1-3" })!;
      await tree.write(async () => {
        await tree.moveNode(a11.pk, a13.pk, FirstChild);
      });
      a13 = await tree.findNode({ title: "A-1-3" })!;
      a11 = await tree.findNode({ title: "A-1-1" })!;

      expect(a11.level).toBe(a13.level + 1);
      expect(a11.lft).toBe(a13.lft + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("a移动为B的第一个子节点", async () => {
      let a = await tree.findNode({ title: "A" })!;
      let b = await tree.findNode({ title: "B" })!;
      await tree.write(async () => {
        await tree.moveNode(a, b, FirstChild);
      });
      a = await tree.findNode({ title: "A" })!;
      b = await tree.findNode({ title: "B" })!;
      expect(a.level).toBe(b.level + 1);
      expect(a.lft).toBe(b.lft + 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("b移动为A-1-2的第一个子节点", async () => {
      let a = await tree.findNode({ title: "A" })!;
      let b = await tree.findNode({ title: "B-1-2" })!;
      await tree.write(async () => {
        await tree.moveNode(a, b, FirstChild);
      });
      a = await tree.findNode({ title: "A" })!;
      b = await tree.findNode({ title: "B-1-2" })!;
      expect(a.level).toBe(b.level + 1);
      expect(a.lft).toBe(b.lft + 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });

    // 向上移动： 即目标节点在源节点前面
    test("a-1-3移动为A-1-1的第一个子节点", async () => {
      let a11 = await tree.findNode({ title: "A-1-1" })!;
      let a13 = await tree.findNode({ title: "A-1-3" })!;
      await tree.write(async () => {
        await tree.moveNode(a13, a11, FirstChild);
      });
      a13 = await tree.findNode({ title: "A-1-3" })!;
      a11 = await tree.findNode({ title: "A-1-1" })!;

      expect(a13.level).toBe(a11.level + 1);
      expect(a13.lft).toBe(a11.lft + 1);

      expect(await verifyCustomTree(tree)).toBe(true);
    });

    test("b移动为A的第一个子节点", async () => {
      let a = await tree.findNode({ title: "A" })!;
      let b = await tree.findNode({ title: "B" })!;
      await tree.write(async () => {
        await tree.moveNode(b, a, FirstChild);
      });
      a = await tree.findNode({ title: "A" })!;
      b = await tree.findNode({ title: "B" })!;
      expect(b.level).toBe(a.level + 1);
      expect(b.lft).toBe(a.lft + 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("c移动为A-1-2的第一个子节点", async () => {
      let c = await tree.findNode({ title: "C" })!;
      let a = await tree.findNode({ title: "A-1-2" })!;
      await tree.write(async () => {
        await tree.moveNode(c, a, FirstChild);
      });
      c = await tree.findNode({ title: "C" })!;
      a = await tree.findNode({ title: "A-1-2" })!;
      expect(c.level).toBe(a.level + 1);
      expect(c.lft).toBe(a.lft + 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });

  describe("向上移动节点", async () => {
    test("向上移动一个节点", async () => {
      let f55 = await tree.findNode({ title: "F-5-5" });
      await tree.write(async () => {
        await tree.moveUpNode(f55);
      });
      f55 = await tree.findNode({ title: "F-5-5" });
      const f54 = await tree.findNode({ title: "F-5-4" });

      expect(f55.level).toBe(f54.level);
      expect(f54.lft).toBe(f55.lft + 2);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向上移动一个节点直到变成其父节点的上一个兄弟节点", async () => {
      let f55 = await tree.findNode({ title: "F-5-5" });
      await tree.write(async () => {
        await tree.moveUpNode(f55.pk); // 4
        await tree.moveUpNode(f55.pk); // 3
        await tree.moveUpNode(f55.pk); // 2
        await tree.moveUpNode(f55.pk); // 1
        await tree.moveUpNode(f55.pk); // 1
      });
      const f5 = await tree.findNode({ title: "F-5" });
      f55 = await tree.findNode({ title: "F-5-5" });
      const fChildren = await tree.getChildren(f5);
      expect(fChildren.length).toBe(4);
      expect(fChildren[0].name).toBe("F-5-1");
      expect(fChildren[1].name).toBe("F-5-2");
      expect(fChildren[2].name).toBe("F-5-3");
      expect(fChildren[3].name).toBe("F-5-4");

      expect(f55.level).toBe(f5.level);
      expect(f55.rgt + 1).toBe(f5.lft);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("f-5-5连续向上移动直至根节点", async () => {
      let f55 = await tree.findNode({ title: "F-5-5" });
      const root = await tree.findNode({ title: "root" });
      await tree.write(async () => {
        while (true) {
          try {
            await tree.moveUpNode(f55.pk);
          } catch (e) {
            expect(e).toBeInstanceOf(FlexTreeNodeInvalidOperationError);
            f55 = await tree.findNode({ title: "F-5-5" });
            expect(f55.level).toBe(1);
            expect(f55.lft).toBe(root.lft + 1);
            break;
          }
        }
      });
      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });

  describe("向下移动节点", async () => {
    test("向下移动一个节点", async () => {
      let f11 = await tree.findNode({ title: "F-1-1" });
      await tree.write(async () => {
        await tree.moveDownNode(f11);
      });
      f11 = await tree.findNode({ title: "F-1-1" });
      const f12 = await tree.findNode({ title: "F-1-2" });

      expect(f11.level).toBe(f12.level);
      expect(f11.lft).toBe(f12.lft + 2);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("向下移动一个节点直到变成其父节点的下一个兄弟节点", async () => {
      let a11 = await tree.findNode({ title: "A-1-1" });
      await tree.write(async () => {
        await tree.moveDownNode(a11.pk); // 2
        await tree.moveDownNode(a11.pk); // 3
        await tree.moveDownNode(a11.pk); // 4
        await tree.moveDownNode(a11.pk); // 5
        await tree.moveDownNode(a11.pk); // 1
      });
      const a1 = await tree.findNode({ title: "A-1" });
      a11 = await tree.findNode({ title: "A-1-1" });
      const fChildren = await tree.getChildren(a1);
      expect(fChildren.length).toBe(4);
      expect(fChildren[0].name).toBe("A-1-2");
      expect(fChildren[1].name).toBe("A-1-3");
      expect(fChildren[2].name).toBe("A-1-4");
      expect(fChildren[3].name).toBe("A-1-5");

      expect(a11.level).toBe(a1.level);
      expect(a11.lft).toBe(a1.rgt + 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
    test("a-1-1连续向下移动直至最后节点", async () => {
      const root = await tree.findNode({ title: "root" });
      let a11 = await tree.findNode({ title: "A-1-1" });
      await tree.write(async () => {
        while (true) {
          try {
            await tree.moveDownNode(a11.pk);
          } catch (e) {
            expect(e).toBeInstanceOf(FlexTreeNodeInvalidOperationError);
            a11 = await tree.findNode({ title: "A-1-1" });
            expect(a11.level).toBe(1);
            expect(a11.lft).toBe(root.rgt - 2);
            break;
          }
        }
      });
      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });
});
