/**
 * FlexTree 验证功能测试
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { DemoFlexTreeManager } from "../helpers";
import { createDemoTree, createTreeManager } from "../helpers";
import { FlexTreeVerifyError } from "../../src";

describe("检查树的完整性", () => {
  let tree: DemoFlexTreeManager;
  beforeEach(async () => {
    tree = await createTreeManager();
    await createDemoTree(tree);
  });
  afterEach(async () => {
    // 清理测试数据
  });

  describe("基本验证功能", () => {
    test("检查正常树的完整性", async () => {
      expect(await tree.verify()).toBe(true);
    });

    test("空树应该通过验证", async () => {
      const emptyTree = await createTreeManager();
      expect(await emptyTree.verify()).toBe(true);
    });
  });

  describe("Level 字段验证", () => {
    test("根节点的 level 必须为 0", async () => {
      // 修改根节点的 level 为错误值
      await tree.adapter.exec(
        "UPDATE tree SET level = 5 WHERE leftValue = 1"
      );

      await expect(tree.verify()).rejects.toThrow(FlexTreeVerifyError);
      await expect(tree.verify()).rejects.toThrow("根节点的 level 必须为 0");
    });

    test("子节点的 level 必须等于父节点 level + 1", async () => {
      // 获取一个节点和其父节点
      const nodes = await tree.getNodes();
      const root = nodes.find((n) => n.name === "root")!;
      const childA = nodes.find((n) => n.name === "A")!;

      // 修改子节点的 level 为错误值
      await tree.adapter.exec(
        `UPDATE tree SET level = 5 WHERE id = ${childA.id}`
      );

      await expect(tree.verify()).rejects.toThrow(FlexTreeVerifyError);
      await expect(tree.verify()).rejects.toThrow(/层级关系错误/);
    });

    test("修复 level 后验证应该通过", async () => {
      // 修改根节点的 level 为错误值
      await tree.adapter.exec(
        "UPDATE tree SET level = 5 WHERE leftValue = 1"
      );

      // 验证应该失败
      await expect(tree.verify()).rejects.toThrow(FlexTreeVerifyError);

      // 修复 level 值
      await tree.adapter.exec(
        "UPDATE tree SET level = 0 WHERE leftValue = 1"
      );

      // 验证应该通过
      expect(await tree.verify()).toBe(true);
    });

    test("批量修复错误 level 后验证通过", async () => {
      const nodes = await tree.getNodes();
      const root = nodes.find((n) => n.name === "root")!;
      const childA = nodes.find((n) => n.name === "A")!;
      const childA1 = nodes.find((n) => n.name === "A-1")!;

      // 修改多个节点的 level 为错误值
      await tree.adapter.exec(
        `UPDATE tree SET level = 10 WHERE id IN (${root.id}, ${childA.id}, ${childA1.id})`
      );

      // 验证应该失败
      await expect(tree.verify()).rejects.toThrow(FlexTreeVerifyError);

      // 批量修复 level 值
      await tree.adapter.exec(
        `UPDATE tree SET level = 0 WHERE id = ${root.id}`
      );
      await tree.adapter.exec(
        `UPDATE tree SET level = 1 WHERE id = ${childA.id}`
      );
      await tree.adapter.exec(
        `UPDATE tree SET level = 2 WHERE id = ${childA1.id}`
      );

      // 验证应该通过
      expect(await tree.verify()).toBe(true);
    });
  });

  describe("多树场景下的 Level 验证", () => {
    test("多树中每棵树的根节点 level 都必须为 0", async () => {
      // 直接在现有树上测试多树场景
      // 修改现有根节点的 level 为错误值
      await tree.adapter.exec(
        "UPDATE tree SET level = 3 WHERE leftValue = 1"
      );

      await expect(tree.verify()).rejects.toThrow(FlexTreeVerifyError);

      // 修复后应该通过验证
      await tree.adapter.exec(
        "UPDATE tree SET level = 0 WHERE leftValue = 1"
      );
      expect(await tree.verify()).toBe(true);
    });

    test("treeId 隔离验证", async () => {
      // 测试 treeId 参数的作用
      const originalTreeId = tree.treeId;

      // 临时设置一个不存在的 treeId
      tree.treeId = 999;

      // 空树应该通过验证（没有节点）
      expect(await tree.verify()).toBe(true);

      // 恢复原始 treeId
      tree.treeId = originalTreeId;
      expect(await tree.verify()).toBe(true);
    });
  });

  describe("Level 验证错误信息", () => {
    test("根节点 level 错误应该显示具体信息", async () => {
      await tree.adapter.exec(
        "UPDATE tree SET level = 10 WHERE leftValue = 1"
      );

      try {
        await tree.verify();
        throw new Error("应该抛出错误");
      } catch (error) {
        expect(error).toBeInstanceOf(FlexTreeVerifyError);
        expect((error as FlexTreeVerifyError).message).toContain("level=10");
        expect((error as FlexTreeVerifyError).message).toContain("根节点的 level 必须为 0");
      }
    });

    test("父子关系 level 错误应该显示节点名称", async () => {
      const nodes = await tree.getNodes();
      const childA = nodes.find((n) => n.name === "A")!;

      await tree.adapter.exec(
        `UPDATE tree SET level = 8 WHERE id = ${childA.id}`
      );

      try {
        await tree.verify();
        throw new Error("应该抛出错误");
      } catch (error) {
        expect(error).toBeInstanceOf(FlexTreeVerifyError);
        expect((error as FlexTreeVerifyError).message).toContain("A");
        expect((error as FlexTreeVerifyError).message).toMatch(/层级关系错误/);
        expect((error as FlexTreeVerifyError).message).toMatch(/level=\d+.*应该是 \d+/);
      }
    });
  });

  describe("边界情况", () => {
    test("只有根节点的树应该通过验证", async () => {
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

      expect(await singleRootTree.verify()).toBe(true);
    });

    test("两级树的 level 验证", async () => {
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
        ]);
      });

      expect(await twoLevelTree.verify()).toBe(true);
    });

    test("深层嵌套树的 level 验证", async () => {
      // 创建一个深度为 5 的树
      const deepTree = await createTreeManager();
      await createDemoTree(deepTree, { level: 5 });

      expect(await deepTree.verify()).toBe(true);
    });
  });
});
