/**
 * forEachTree / isCompleteTree 工具函数测试（纯函数）
 *
 * 这两个函数已提取为独立工具（src/utils/forEachNodes），此处覆盖其核心行为。
 */
import { describe, it, expect } from "bun:test";
import { forEachTree, isCompleteTree } from "../../src/utils/forEachNodes";

describe("forEachTree", () => {
  it("应该正确遍历完整的树", () => {
    const nodes = [
      { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 8 },
      { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 7 },
      { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 6 },
    ];

    const visitCount: Record<number, number> = {};
    const maxIndex = forEachTree(nodes, ({ node }) => {
      visitCount[node.id] = (visitCount[node.id] || 0) + 1;
    });

    // 每个节点被访问两次（进入 + 退出）
    expect(visitCount[1]).toBe(2);
    expect(visitCount[2]).toBe(2);
    expect(visitCount[3]).toBe(2);
    expect(visitCount[4]).toBe(2);
    expect(maxIndex).toBe(-1); // 树完整，返回 -1
  });

  it("应该检测到破坏的树", () => {
    const nodes = [
      { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 18 },
      { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 9 },
      { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 16 },
      { id: 5, name: "A3", level: 2, leftValue: 7, rightValue: 8 },
      { id: 6, name: "B", level: 1, leftValue: 10, rightValue: 17 },
      { id: 7, name: "B1", level: 2, leftValue: 21, rightValue: 12 },
      { id: 8, name: "B2", level: 2, leftValue: 13, rightValue: 14 },
      { id: 9, name: "B3", level: 2, leftValue: 15, rightValue: 16 },
    ];

    let errorFound = false;
    const maxIndex = forEachTree(nodes, ({ error }) => {
      if (error) errorFound = true;
    });

    expect(errorFound).toBe(true);
    expect(maxIndex).toBeGreaterThanOrEqual(0);
  });
});

describe("isCompleteTree", () => {
  it("应该识别完整的子树", () => {
    const nodes = [
      { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 8 },
      { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 7 },
      { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 6 },
    ];

    // 检查从 A 节点（index=1）开始的子树
    expect(isCompleteTree(nodes, 1).length).toBeGreaterThan(0);
  });

  it("应该识别不完整的子树", () => {
    const nodes = [
      { id: 1, name: "root", level: 0, leftValue: 1, rightValue: 18 },
      { id: 2, name: "A", level: 1, leftValue: 2, rightValue: 9 },
      { id: 3, name: "A1", level: 2, leftValue: 3, rightValue: 4 },
      { id: 4, name: "A2", level: 2, leftValue: 5, rightValue: 16 },
      { id: 5, name: "A3", level: 2, leftValue: 7, rightValue: 8 },
    ];

    // 检查从 A2 节点（index=3）开始的子树（不完整）
    expect(isCompleteTree(nodes, 3).length).toBe(0);
  });
});
