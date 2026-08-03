// @ts-nocheck
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  createCustomDemoTree,
  createCustomTreeManager,
  CustomDemoFlexTreeManager,
} from "../helpers";

describe("自定义关键字段-删除树节点", () => {
  let tree: CustomDemoFlexTreeManager;
  beforeEach(async () => {
    tree = await createCustomTreeManager();
    await createCustomDemoTree(tree, { level: 2 });
  });
  afterEach(async () => {
    // await dumpCustomTree(tree.adapter.db, 'delete.db')
  });
  test("自定义关键字段-依次删除所有子节点", async () => {
    // 删除A_1
    const a1 = await tree.findNode({ title: "A-1" });
    await tree.write(async () => {
      await tree.deleteNode(a1);
    });
    let a = await tree.findNode({ title: "A" });
    expect((a.rgt - a.lft - 1) / 2).toBe(4);

    let aChildren = await tree.getChildren(a.pk);
    expect(aChildren.length).toBe(4);

    // 删除A_2
    const a2 = await tree.findNode({ title: "A-2" });
    await tree.write(async () => {
      await tree.deleteNode(a2);
    });
    a = await tree.findNode({ title: "A" }); // 由于删除了A_2节点会导致A节点的左右值变化，所以需要重新获取A节点
    expect((a.rgt - a.lft - 1) / 2).toBe(3);
    aChildren = await tree.getChildren(a.pk);
    expect(aChildren.length).toBe(3);

    // 删除A_3
    const a3 = await tree.findNode({ title: "A-3" });
    await tree.write(async () => {
      await tree.deleteNode(a3);
    });
    a = await tree.findNode({ title: "A" }); // 由于删除了A_3节点会导致A节点的左右值变化，所以需要重新获取A节点
    expect((a.rgt - a.lft - 1) / 2).toBe(2);
    aChildren = await tree.getChildren(a.pk);
    expect(aChildren.length).toBe(2);

    // 删除A_4
    const a4 = await tree.findNode({ title: "A-4" });
    await tree.write(async () => {
      await tree.deleteNode(a4);
    });
    a = await tree.findNode({ title: "A" }); // 由于删除了A_4节点会导致A节点的左右值变化，所以需要重新获取A节点
    expect((a.rgt - a.lft - 1) / 2).toBe(1);
    aChildren = await tree.getChildren(a.pk);
    expect(aChildren.length).toBe(1);

    // 删除A_5
    const a5 = await tree.findNode({ title: "A-5" });
    await tree.write(async () => {
      await tree.deleteNode(a5);
    });
    a = await tree.findNode({ title: "A" }); // 由于删除了A_5节点会导致A节点的左右值变化，所以需要重新获取A节点
    expect((a.rgt - a.lft - 1) / 2).toBe(0);
    aChildren = await tree.getChildren(a.pk);
    expect(aChildren.length).toBe(0);
  });
  test("自定义关键字段-删除节点及所有子节点", async () => {
    // 删除A
    let nodes = await tree.getNodes();
    const oldCount = nodes.length;
    const a = await tree.findNode({ title: "A" });
    const deleteCount = (a.rgt - a.lft - 1) / 2 + 1;
    await tree.write(async () => {
      await tree.deleteNode(a);
    });
    nodes = await tree.getNodes();
    expect(nodes.length).toBe(oldCount - deleteCount);
  });
  test("自定义关键字段-删除所有节点包括根节点", async () => {
    const root = await tree.findNode({ title: "root" });
    await tree.write(async () => {
      await tree.deleteNode(root);
    });
    const nodes = await tree.getNodes();
    expect(nodes.length).toBe(0);
  });
  test("自定义关键字段-只标注删除节点及所有子节点", async () => {
    // 删除A
    let nodes = await tree.getNodes();
    const oldCount = nodes.length;
    const a = await tree.findNode({ title: "A" });
    const deleteCount = (a.rgt - a.lft - 1) / 2 + 1;
    await tree.write(async () => {
      await tree.deleteNode(a, { onlyMark: true });
    });
    nodes = await tree.getNodes();
    expect(nodes.length).toBe(oldCount - deleteCount);
    const rows = await tree.adapter.getRows("select * from tree where lft<0 and rgt<0");
    expect(rows.length).toBe(deleteCount);
  });
});

/**
 * 创建更详细的演示树结构用于测试删除操作
 * 树结构：
 * Root
 * |--A
 * |  |--A-1
 * |  |--A-2
 * |  |--A-3
 * |  |--A-4
 * |  \--A-5
 * |--B
 * |  |--B-1
 * |  |--B-2
 * |  |--B-3
 * |  |--B-4
 * |  \--B-5
 * |--C
 * |  |--C-1
 * |  |--C-2
 * |  |--C-3
 * |  |--C-4
 * |  \--C-5
 * \--D
 *    |--D-1
 *    |--D-2
 *    |--D-3
 *    |--D-4
 *    \--D-5
 */
async function createDetailedDemoTree(
  tree: CustomDemoFlexTreeManager
): Promise<{ rootNode: any; level1Nodes: any[]; allNodes: any[] }> {
  let rootNode: any = null;
  let level1Nodes: any[] = [];

  await tree.write(async () => {
    // 创建根节点
    await tree.createRoot({
      pk: 1,
      title: "Root",
      tree: 1,
      size: 1000,
    });

    rootNode = await tree.findNode({ title: "Root" });

    // 创建一级节点 A, B, C, D
    level1Nodes = [
      { pk: 10, title: "A", tree: 1, size: 100 },
      { pk: 20, title: "B", tree: 1, size: 100 },
      { pk: 30, title: "C", tree: 1, size: 100 },
      { pk: 40, title: "D", tree: 1, size: 100 },
    ];

    await tree.addNodes(level1Nodes, 1);

    // 为每个一级节点创建 5 个二级节点
    for (const parent of level1Nodes) {
      const parentPk = parent.pk;
      const parentTitle = parent.title;
      const children = Array.from({ length: 5 }, (_, i) => ({
        pk: parentPk * 100 + (i + 1) * 10,
        title: `${parentTitle}-${i + 1}`,
        tree: 1,
        size: 50,
      }));

      await tree.addNodes(children, parentPk);
    }
  });

  const allNodes = await tree.getNodes();
  return { rootNode, level1Nodes, allNodes };
}

/**
 * 将树节点转换为带有父子关系的结构
 */
function buildTreeStructure(nodes: any[]): any[] {
  const nodeMap = new Map();
  const roots: any[] = [];

  // 先创建所有节点的副本
  nodes.forEach(node => {
    nodeMap.set(node.pk, { ...node, children: [] });
  });

  // 构建树结构
  const sortedNodes = [...nodes].sort((a, b) => a.lft - b.lft);

  sortedNodes.forEach(node => {
    // 找到父节点
    let parent = null;
    for (let i = sortedNodes.indexOf(node) - 1; i >= 0; i--) {
      const candidate = sortedNodes[i];
      if (candidate.lft < node.lft && candidate.rgt > node.rgt && candidate.level === node.level - 1) {
        parent = candidate;
        break;
      }
    }

    if (parent) {
      const parentNode = nodeMap.get(parent.pk);
      parentNode.children.push(nodeMap.get(node.pk));
    } else {
      roots.push(nodeMap.get(node.pk));
    }
  });

  return roots;
}

/**
 * 生成树结构的文本表示
 */
function generateTreeText(nodes: any[], options: { showValues?: boolean } = {}): string {
  const roots = buildTreeStructure(nodes);
  const lines: string[] = [];

  function buildLines(node: any, prefix: string, isLast: boolean): void {
    const value = options.showValues ? ` (lft:${node.lft}, rgt:${node.rgt})` : '';
    lines.push(`${prefix}${isLast ? '└--' : '|--'}${node.title}${value}`);

    if (node.children && node.children.length > 0) {
      const newPrefix = prefix + (isLast ? '    ' : '|   ');
      node.children.forEach((child: any, index: number) => {
        buildLines(child, newPrefix, index === node.children.length - 1);
      });
    }
  }

  roots.forEach((root, index) => {
    buildLines(root, '', index === roots.length - 1);
  });

  return lines.join('\n');
}

describe("详细删除测试套件 - Root->A,B,C,D->子节点", () => {
  let tree: CustomDemoFlexTreeManager;

  beforeEach(async () => {
    tree = await createCustomTreeManager();
    await createDetailedDemoTree(tree);
  });

  test("删除单个叶子节点 A-1", async () => {
    const a1 = await tree.findNode({ title: "A-1" });

    await tree.write(async () => {
      await tree.deleteNode(a1);
    });

    const nodesAfter = await tree.getNodes();
    const treeAfter = generateTreeText(nodesAfter, { showValues: true });

    const expectedTree = `
└--Root (lft:1, rgt:48)
    |--A (lft:2, rgt:11)
    |   |--A-2 (lft:3, rgt:4)
    |   |--A-3 (lft:5, rgt:6)
    |   |--A-4 (lft:7, rgt:8)
    |   └--A-5 (lft:9, rgt:10)
    |--B (lft:12, rgt:23)
    |   |--B-1 (lft:13, rgt:14)
    |   |--B-2 (lft:15, rgt:16)
    |   |--B-3 (lft:17, rgt:18)
    |   |--B-4 (lft:19, rgt:20)
    |   └--B-5 (lft:21, rgt:22)
    |--C (lft:24, rgt:35)
    |   |--C-1 (lft:25, rgt:26)
    |   |--C-2 (lft:27, rgt:28)
    |   |--C-3 (lft:29, rgt:30)
    |   |--C-4 (lft:31, rgt:32)
    |   └--C-5 (lft:33, rgt:34)
    └--D (lft:36, rgt:47)
        |--D-1 (lft:37, rgt:38)
        |--D-2 (lft:39, rgt:40)
        |--D-3 (lft:41, rgt:42)
        |--D-4 (lft:43, rgt:44)
        └--D-5 (lft:45, rgt:46)`.trim();

    expect(treeAfter).toEqual(expectedTree);
  });

  test("删除子树 A（包含所有 A-1 到 A-5）", async () => {
    const a = await tree.findNode({ title: "A" });

    await tree.write(async () => {
      await tree.deleteNode(a);
    });

    const nodesAfter = await tree.getNodes();
    const treeAfter = generateTreeText(nodesAfter, { showValues: true });

    const expectedTree = `
└--Root (lft:1, rgt:38)
    |--B (lft:2, rgt:13)
    |   |--B-1 (lft:3, rgt:4)
    |   |--B-2 (lft:5, rgt:6)
    |   |--B-3 (lft:7, rgt:8)
    |   |--B-4 (lft:9, rgt:10)
    |   └--B-5 (lft:11, rgt:12)
    |--C (lft:14, rgt:25)
    |   |--C-1 (lft:15, rgt:16)
    |   |--C-2 (lft:17, rgt:18)
    |   |--C-3 (lft:19, rgt:20)
    |   |--C-4 (lft:21, rgt:22)
    |   └--C-5 (lft:23, rgt:24)
    └--D (lft:26, rgt:37)
        |--D-1 (lft:27, rgt:28)
        |--D-2 (lft:29, rgt:30)
        |--D-3 (lft:31, rgt:32)
        |--D-4 (lft:33, rgt:34)
        └--D-5 (lft:35, rgt:36)`.trim();

    expect(treeAfter).toEqual(expectedTree);
  });

  test("逐一删除 A 的所有子节点", async () => {
    const aChildren = ["A-1", "A-2", "A-3", "A-4", "A-5"];
    const a = await tree.findNode({ title: "A" });

    // 逐一删除每个子节点
    for (let i = 0; i < aChildren.length; i++) {
      const childTitle = aChildren[i];
      const child = await tree.findNode({ title: childTitle });

      await tree.write(async () => {
        await tree.deleteNode(child);
      });
    }

    const nodesAfter = await tree.getNodes();
    const treeAfter = generateTreeText(nodesAfter, { showValues: true });

    const expectedTree = `
└--Root (lft:1, rgt:40)
    |--A (lft:2, rgt:3)
    |--B (lft:4, rgt:15)
    |   |--B-1 (lft:5, rgt:6)
    |   |--B-2 (lft:7, rgt:8)
    |   |--B-3 (lft:9, rgt:10)
    |   |--B-4 (lft:11, rgt:12)
    |   └--B-5 (lft:13, rgt:14)
    |--C (lft:16, rgt:27)
    |   |--C-1 (lft:17, rgt:18)
    |   |--C-2 (lft:19, rgt:20)
    |   |--C-3 (lft:21, rgt:22)
    |   |--C-4 (lft:23, rgt:24)
    |   └--C-5 (lft:25, rgt:26)
    └--D (lft:28, rgt:39)
        |--D-1 (lft:29, rgt:30)
        |--D-2 (lft:31, rgt:32)
        |--D-3 (lft:33, rgt:34)
        |--D-4 (lft:35, rgt:36)
        └--D-5 (lft:37, rgt:38)`.trim();

    expect(treeAfter).toEqual(expectedTree);
  });

  test("删除中间节点 B-3（同时删除 B 的其他子节点）", async () => {
    const b3 = await tree.findNode({ title: "B-3" });

    await tree.write(async () => {
      await tree.deleteNode(b3);
    });

    const nodesAfter = await tree.getNodes();
    const treeAfter = generateTreeText(nodesAfter, { showValues: true });

    const expectedTree = `
└--Root (lft:1, rgt:48)
    |--A (lft:2, rgt:13)
    |   |--A-1 (lft:3, rgt:4)
    |   |--A-2 (lft:5, rgt:6)
    |   |--A-3 (lft:7, rgt:8)
    |   |--A-4 (lft:9, rgt:10)
    |   └--A-5 (lft:11, rgt:12)
    |--B (lft:14, rgt:23)
    |   |--B-1 (lft:15, rgt:16)
    |   |--B-2 (lft:17, rgt:18)
    |   |--B-4 (lft:19, rgt:20)
    |   └--B-5 (lft:21, rgt:22)
    |--C (lft:24, rgt:35)
    |   |--C-1 (lft:25, rgt:26)
    |   |--C-2 (lft:27, rgt:28)
    |   |--C-3 (lft:29, rgt:30)
    |   |--C-4 (lft:31, rgt:32)
    |   └--C-5 (lft:33, rgt:34)
    └--D (lft:36, rgt:47)
        |--D-1 (lft:37, rgt:38)
        |--D-2 (lft:39, rgt:40)
        |--D-3 (lft:41, rgt:42)
        |--D-4 (lft:43, rgt:44)
        └--D-5 (lft:45, rgt:46)`.trim();

    expect(treeAfter).toEqual(expectedTree);
  });

  test("删除整棵树的所有一级节点（逐一删除 A, B, C, D）", async () => {
    const level1Nodes = ["A", "B", "C", "D"];

    // 逐一删除每个一级节点
    for (let i = 0; i < level1Nodes.length; i++) {
      const nodeTitle = level1Nodes[i];
      const node = await tree.findNode({ title: nodeTitle });

      await tree.write(async () => {
        await tree.deleteNode(node);
      });
    }

    const nodesAfter = await tree.getNodes();
    const treeAfter = generateTreeText(nodesAfter, { showValues: true });

    const expectedTree = `
└--Root (lft:1, rgt:2)`.trim();

    expect(treeAfter).toEqual(expectedTree);
  });

  test("删除所有节点包括根节点", async () => {
    const root = await tree.findNode({ title: "Root" });

    await tree.write(async () => {
      await tree.deleteNode(root);
    });

    const nodesAfter = await tree.getNodes();
    const treeAfter = generateTreeText(nodesAfter);

    expect(treeAfter).toBe(""); // 空树返回空字符串
  });

  test("只标记删除节点 A（逻辑删除）", async () => {
    const a = await tree.findNode({ title: "A" });

    await tree.write(async () => {
      await tree.deleteNode(a, { onlyMark: true });
    });

    const nodesAfter = await tree.getNodes();
    const treeAfter = generateTreeText(nodesAfter, { showValues: true });

    const expectedTree = `
└--Root (lft:1, rgt:38)
    |--B (lft:2, rgt:13)
    |   |--B-1 (lft:3, rgt:4)
    |   |--B-2 (lft:5, rgt:6)
    |   |--B-3 (lft:7, rgt:8)
    |   |--B-4 (lft:9, rgt:10)
    |   └--B-5 (lft:11, rgt:12)
    |--C (lft:14, rgt:25)
    |   |--C-1 (lft:15, rgt:16)
    |   |--C-2 (lft:17, rgt:18)
    |   |--C-3 (lft:19, rgt:20)
    |   |--C-4 (lft:21, rgt:22)
    |   └--C-5 (lft:23, rgt:24)
    └--D (lft:26, rgt:37)
        |--D-1 (lft:27, rgt:28)
        |--D-2 (lft:29, rgt:30)
        |--D-3 (lft:31, rgt:32)
        |--D-4 (lft:33, rgt:34)
        └--D-5 (lft:35, rgt:36)`.trim();

    expect(treeAfter).toEqual(expectedTree);

    // 额外验证：标记删除的节点应该有负的左右值
    const aAfter = await tree.findNode({ title: "A" });
    expect(aAfter).toBeDefined();
    expect(aAfter!.lft).toBeLessThan(0); // 验证左值为负数（标记删除）
    expect(aAfter!.rgt).toBeLessThan(0); // 验证右值为负数（标记删除）
  });

  test("删除节点后验证树结构完整性", async () => {
    const c1 = await tree.findNode({ title: "C-1" });

    await tree.write(async () => {
      await tree.deleteNode(c1);
    });

    const nodesAfter = await tree.getNodes();
    const treeAfter = generateTreeText(nodesAfter, { showValues: true });

    const expectedTree = `
└--Root (lft:1, rgt:48)
    |--A (lft:2, rgt:13)
    |   |--A-1 (lft:3, rgt:4)
    |   |--A-2 (lft:5, rgt:6)
    |   |--A-3 (lft:7, rgt:8)
    |   |--A-4 (lft:9, rgt:10)
    |   └--A-5 (lft:11, rgt:12)
    |--B (lft:14, rgt:25)
    |   |--B-1 (lft:15, rgt:16)
    |   |--B-2 (lft:17, rgt:18)
    |   |--B-3 (lft:19, rgt:20)
    |   |--B-4 (lft:21, rgt:22)
    |   └--B-5 (lft:23, rgt:24)
    |--C (lft:26, rgt:35)
    |   |--C-2 (lft:27, rgt:28)
    |   |--C-3 (lft:29, rgt:30)
    |   |--C-4 (lft:31, rgt:32)
    |   └--C-5 (lft:33, rgt:34)
    └--D (lft:36, rgt:47)
        |--D-1 (lft:37, rgt:38)
        |--D-2 (lft:39, rgt:40)
        |--D-3 (lft:41, rgt:42)
        |--D-4 (lft:43, rgt:44)
        └--D-5 (lft:45, rgt:46)`.trim();

    expect(treeAfter).toEqual(expectedTree);

    // 额外验证：检查树结构的完整性
    const allNodes = await tree.getNodes();
    expect(allNodes.length).toBeGreaterThan(0);

    // 验证每个节点的左右值关系正确
    for (const node of allNodes) {
      if (node.title === "Root") continue; // 跳过根节点

      // 验证左值 < 右值
      expect(node.lft).toBeLessThan(node.rgt);

      // 验证层级正确性
      const parent = await tree.getParent(node.pk);
      if (parent) {
        expect(node.level).toBe(parent.level + 1);
      }
    }
  });
});
