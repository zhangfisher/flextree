/**
 * 演示树构建工具函数
 * 用于生成测试用的标准树结构
 */

import type { FlexTreeManager } from "../../src";

export interface TestFields {
  title: string;
  size: number;
}

export type TestFlexTreeManager = FlexTreeManager<TestFields>;

export type CustomDemoFlexTreeManager = FlexTreeManager<
  {
    size: number;
  },
  {
    id: ["pk", number];
    treeId: ["tree", number];
    name: "title";
    leftValue: "lft";
    rightValue: "rgt";
  }
>;

/**
 * 生成一个默认字段名的 demo 树
 *
 * 树的结构如下：
 * root:
 * - A:
 *  - A1:
 *     - A11
 * - A12
 *      - A13
 *      - A14
 *      - A15
 *  - B
 */
export async function createDemoTree(
  tree: TestFlexTreeManager,
  options?: { level?: number; treeCount?: number },
): Promise<number> {
  const { level, treeCount } = Object.assign({ level: 3, treeCount: 1 }, options);
  const names = ["A", "B", "C", "D", "E", "F"];
  let count: number = 0;

  for (let currentTreeId = 1; currentTreeId <= treeCount; currentTreeId++) {
    await tree.write(async () => {
      await tree.createRoot({
        id: 1,
        name: "root",
        treeId: currentTreeId,
        title: "root-title",
        size: Math.floor(Math.random() * 1000),
      });
      count++;

      // level=1:   id=100,200,300,400,500,600,700
      await tree.addNodes(
        names.map((name, index) => {
          count++;
          return {
            name,
            id: (index + 1) * 100,
            treeId: currentTreeId,
            title: `${name}-title`,
            size: Math.floor(Math.random() * 1000),
          };
        }),
      );

      async function createNodes(pid: number, pname: string, lv: number) {
        const nodes = Array.from({ length: 5 })
          .fill(0)
          .map((_, i) => {
            count++;
            const name = `${pname}-${i + 1}`;
            return {
              name,
              id: Number.parseInt(`${pid}${Number(i) + 1}`),
              treeId: currentTreeId,
              title: `${name}-title`,
              size: Math.floor(Math.random() * 1000),
            };
          });
        await tree.addNodes(nodes, pid);

        if (lv < level) {
          for (const node of nodes) {
            await createNodes(node.id, node.name, lv + 1);
          }
        }
      }

      for (const [index, name] of Object.entries(names)) {
        await createNodes((Number(index) + 1) * 100, name, 2);
      }
    });
  }

  return count;
}

/**
 * 生成一个自定义字段名的 demo 树
 *
 * 树的结构如下：
 * root:
 * - A:
 *  - A1:
 *     - A11
 * - A12
 *      - A13
 *      - A14
 *      - A15
 *  - B
 */
export async function createCustomDemoTree(
  tree: CustomDemoFlexTreeManager,
  options?: { level?: number; treeCount?: number }
): Promise<number> {
  const { level, treeCount } = Object.assign(
    { level: 3, treeCount: 1 },
    options
  );
  const names = ["A", "B", "C", "D", "E", "F"];
  let count: number = 0;
  for (let treeId = 1; treeId <= treeCount; treeId++) {
    await tree.write(async () => {
      await tree.createRoot({
        pk: 1,
        title: "root",
        tree: treeId,
        size: Math.floor(Math.random() * 1000),
      });
      count++;
      // level=1:   id=100,200,300,400,500,600,700
      await tree.addNodes(
        names.map((name, index) => {
          count++;
          return {
            pk: (index + 1) * 100,
            tree: treeId,
            title: name,
            size: Math.floor(Math.random() * 1000),
          };
        })
      );
      async function createNodes(pid: number, pname: string, lv: number) {
        const nodes = Array.from({ length: 5 })
          .fill(0)
          .map<any>((_, i) => {
            count++;
            const name = `${pname}-${i + 1}`;
            return {
              title: name,
              pk: Number.parseInt(`${pid}${Number(i) + 1}`),
              tree: treeId,
              size: Math.floor(Math.random() * 1000),
            };
          });
        await tree.addNodes(nodes, pid);
        if (lv < level) {
          for (const node of nodes) {
            await createNodes(node.pk, node.title, lv + 1);
          }
        }
      }
      for (const [index, name] of Object.entries(names)) {
        await createNodes((Number(index) + 1) * 100, name, 2);
      }
    });
  }
  return count;
}
