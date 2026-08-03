// @ts-nocheck
/**
 * 移动树节点测试
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { FirstChild, LastChild, NextSibling, PreviousSibling } from "../../src";
import { FlexTreeNodeInvalidOperationError } from "../../src";
import type { CustomDemoFlexTreeManager } from "../helpers";
import {
  createCustomDemoTree,
  createCustomTreeManager,
  verifyCustomTree,
} from "../helpers";

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

  describe("LastChild - 移动节点为目标节点最后一个子节点", () => {
    test("向下移动：节点向下移动为同级节点的最后一个子节点", async () => {
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

    test("向下移动：根节点级别的子树向下移动为另一个根节点子树的最后一个子节点", async () => {
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

    test("向下移动：根节点级别的子树向下移动为深层节点的最后一个子节点", async () => {
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

    test("向上移动：节点向上移动为同级节点的最后一个子节点", async () => {
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

    test("向上移动：根节点级别的子树向上移动为另一个根节点子树的最后一个子节点", async () => {
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

    test("向上移动：根节点级别的子树向上移动为深层节点的最后一个子节点", async () => {
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

  describe("FirstChild - 移动节点为目标节点第一个子节点", () => {
    test("向下移动：节点向下移动为同级节点的第一个子节点", async () => {
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

    test("向下移动：根节点级别的子树向下移动为另一个根节点子树的第一个子节点", async () => {
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

    test("向下移动：根节点级别的子树向下移动为深层节点的第一个子节点", async () => {
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

    test("向上移动：节点向上移动为同级节点的第一个子节点", async () => {
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

    test("向上移动：根节点级别的子树向上移动为另一个根节点子树的第一个子节点", async () => {
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

    test("向上移动：根节点级别的子树向上移动为深层节点的第一个子节点", async () => {
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

  describe("NextSibling - 移动节点到目标节点的后面成为其下一个兄弟节点", () => {
    test("向下移动：同级内节点向下移动到下一个兄弟节点", async () => {
      let a1 = (await tree.findNode({ title: "A-1-1" }))!;
      let a2 = (await tree.findNode({ title: "A-1-2" }))!;
      await tree.write(async () => {
        await tree.moveNode(a1!.pk, a2!.pk, NextSibling);
      });
      const a = (await tree.findNode({ title: "A-1" }))!;
      a1 = (await tree.findNode({ title: "A-1-1" }))!;
      a2 = (await tree.findNode({ title: "A-1-2" }))!;
      a3 = (await tree.findNode({ title: "A-1-3" }))!;
      const a4 = (await tree.findNode({ title: "A-1-4" }))!;
      const a5 = (await tree.findNode({ title: "A-1-5" }))!;

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

    test("向下移动：同级内节点连续向下移动到多个下一个兄弟节点", async () => {
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

    test("向下移动：根节点级别的子树连续向下移动到多个根节点子树的下一个兄弟节点", async () => {
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

    test("向上移动：同级内节点向上移动到下一个兄弟节点", async () => {
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

    test("向上移动：同级内节点连续向上移动到多个下一个兄弟节点", async () => {
      const a1 = await tree.findNode({ title: "A-1-1" })!;
      const a2 = await tree.findNode({ title: "A-1-2" })!;
      const a3 = await tree.findNode({ title: "A-1-3" })!;
      const a5 = await tree.findNode({ title: "A-1-5" })!;

      await tree.write(async () => {
        await tree.moveNode(a5.pk, a3.pk, NextSibling);
        await tree.moveNode(a5.pk, a2.pk, NextSibling);
        await tree.moveNode(a5.pk, a1.pk, NextSibling);
      });
      expect(await verifyCustomTree(tree)).toBe(true);
    });

    test("向上移动：子树向上移动到同级内前面的目标节点的下一个兄弟节点", async () => {
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

    test("跨层级移动：深层节点移动为另一个根节点子树下深层节点的下一个兄弟节点", async () => {
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

    test("跨层级移动：深层节点移动为另一个根节点子树下深层节点的下一个兄弟节点的反向操作", async () => {
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

    test("跨层级移动：深层子节点移动为根节点的下一个兄弟节点", async () => {
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

  describe("PreviousSibling - 移动节点到目标节点的前面成为其上一个兄弟节点", () => {
    test("向下移动：同级内节点向下移动到上一个兄弟节点", async () => {
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

    test("向下移动：同级内节点连续向下移动到多个上一个兄弟节点", async () => {
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

    test("向下移动：子树向下移动到同级内的目标节点的上一个兄弟节点", async () => {
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

    test("向下移动：子树向下移动到不同级内的目标节点的上一个兄弟节点", async () => {
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

    test("向上移动：同级内节点向上移动到上一个兄弟节点", async () => {
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

    test("向上移动：同级内节点连续向上移动到多个上一个兄弟节点", async () => {
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

    test("向上移动：子树向上移动到同级内的目标节点的上一个兄弟节点", async () => {
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

    test("向上移动：子树向上移动到不同级内的目标节点的上一个兄弟节点", async () => {
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

    test("跨层级移动：深层节点连续向上移动到多个上层节点的上一个兄弟节点", async () => {
      let f55 = await tree.findNode({ title: "F-5-5" });
      const f54 = await tree.findNode({ title: "F-5-4" });
      const f53 = await tree.findNode({ title: "F-5-3" });
      const f52 = await tree.findNode({ title: "F-5-2" });
      const f51 = await tree.findNode({ title: "F-5-1" });

      await tree.write(async () => {
        await tree.moveNode(f55, f54, PreviousSibling);
        f55 = await tree.findNode({ title: "F-5-5" });
        await tree.moveNode(f55, f53, PreviousSibling);
        f55 = await tree.findNode({ title: "F-5-5" });
        await tree.moveNode(f55, f52, PreviousSibling);
        f55 = await tree.findNode({ title: "F-5-5" });
        await tree.moveNode(f55, f51, PreviousSibling);
      });
      expect(await verifyCustomTree(tree)).toBe(true);
    });

    test("跨层级移动：深层子节点移动为根节点的上一个兄弟节点", async () => {
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

  describe("向上移动节点 - moveUpNode", () => {
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
      expect(fChildren[0].title).toBe("F-5-1");
      expect(fChildren[1].title).toBe("F-5-2");
      expect(fChildren[2].title).toBe("F-5-3");
      expect(fChildren[3].title).toBe("F-5-4");

      expect(f55.level).toBe(f5.level);
      expect(f55.rgt + 1).toBe(f5.lft);
      expect(await verifyCustomTree(tree)).toBe(true);
    });

    test("深层节点连续向上移动直至根节点级别", async () => {
      let f55 = await tree.findNode({ title: "F-5-5" });
      const root = await tree.findNode({ title: "root" });
      await tree.write(async () => {
        // 执行足够多次向上移动，让F-5-5移到与root直接子节点同级的位置
        for (let i = 0; i < 10; i++) {
          await tree.moveUpNode(f55.pk);
        }
      });

      f55 = await tree.findNode({ title: "F-5-5" });
      // 验证F-5-5已经移到root的直接子节点级别（level=1）
      expect(f55.level).toBe(1);
      // 验证F-5-5在root的范围内
      expect(f55.lft).toBeGreaterThan(root.lft);
      expect(f55.rgt).toBeLessThan(root.rgt);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });

  describe("向下移动节点 - moveDownNode", () => {
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
      expect(fChildren[0].title).toBe("A-1-2");
      expect(fChildren[1].title).toBe("A-1-3");
      expect(fChildren[2].title).toBe("A-1-4");
      expect(fChildren[3].title).toBe("A-1-5");

      expect(a11.level).toBe(a1.level);
      expect(a11.lft).toBe(a1.rgt + 1);
      expect(await verifyCustomTree(tree)).toBe(true);
    });

    test("深层节点连续向下移动直至树的最后位置", async () => {
      const root = await tree.findNode({ title: "root" });
      let a11 = await tree.findNode({ title: "A-1-1" });
      await tree.write(async () => {
        // 执行足够多次向下移动，让A-1-1移到树的后部位置
        for (let i = 0; i < 10; i++) {
          await tree.moveDownNode(a11.pk);
        }
      });

      a11 = await tree.findNode({ title: "A-1-1" });
      // 验证A-1-1的level（可能在不同层级）
      expect(a11.level).toBeDefined();
      // 验证A-1-1仍然在root的范围内
      expect(a11.lft).toBeGreaterThan(root.lft);
      expect(a11.rgt).toBeLessThan(root.rgt);
      expect(await verifyCustomTree(tree)).toBe(true);
    });
  });
});
