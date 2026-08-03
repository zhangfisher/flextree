/**
 * 树验证工具函数
 * 用于验证树结构的完整性和正确性
 */

import type { IFlexTreeNodeFields, FlexTreeManager, FlexTreeVerifyError, DefaultTreeKeyFields } from "../../src";

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
 * 对默认字段名的树进行全树验证
 *
 * 主要验证左右值是否正确，如果不正确则抛出异常
 */
export async function verifyTree(tree: TestFlexTreeManager): Promise<boolean> {
  const nodes = await tree.getNodes();
  const pnodes: IFlexTreeNodeFields<TestFields, DefaultTreeKeyFields>[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.rightValue - node.leftValue === 1) {
      // 无子节点
      if (pnodes.length > 0) {
        const pnode = pnodes[pnodes.length - 1];
        if (pnode.level !== node.level - 1) {
          throw new Error(`level error ${node.name}(${node.id})`);
        } else if (!(node.leftValue > pnode.leftValue)) {
          throw new Error(`leftValue error ${node.name}(${node.id})`);
        } else if (!(node.rightValue < pnode.rightValue)) {
          throw new Error(`rightValue error ${node.name}(${node.id})`);
        }

        // 子节点结束
        if (node.rightValue + 1 === pnode.rightValue) {
          let preNode = pnodes.pop();
          if (pnodes.length > 0) {
            while (preNode!.rightValue + 1 === pnodes[pnodes.length - 1]?.rightValue) {
              preNode = pnodes.pop();
              if (pnodes.length === 0) {
                break;
              }
            }
          }
        }
      }

      if ((node.rightValue - node.leftValue - 1) % 2 !== 0) {
        throw new Error(`${node.name}(${node.id}) rightValue - leftValue error `);
      }
    } else if (node.rightValue - node.leftValue >= 3) {
      // 有子节点
      //  rightValue-leftValue一定是奇数,否则说明有问题
      if ((node.rightValue - node.leftValue - 1) % 2 === 0) {
        pnodes.push(node); // 先保存父节点
      } else {
        throw new Error(`${node.name}(${node.id}) rightValue - leftValue error `);
      }
    } else {
      throw new Error();
    }
  }

  if (pnodes.length > 0) {
    throw new Error();
  }

  return true;
}

/**
 * 对自定义字段名的树进行全树验证
 */
export async function verifyCustomTree(tree: CustomDemoFlexTreeManager): Promise<boolean> {
  const nodes = await tree.getNodes();
  const pnodes: any[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.rgt - node.lft === 1) {
      // 无子节点
      if (pnodes.length > 0) {
        const pnode = pnodes[pnodes.length - 1];
        if (pnode.level !== node.level - 1) {
          throw new Error(`level error ${node.title}(${node.pk})`);
        } else if (!(node.lft > pnode.lft)) {
          throw new Error(`lft error ${node.title}(${node.pk})`);
        } else if (!(node.rgt < pnode.rgt)) {
          throw new Error(`rgt error ${node.title}(${node.pk})`);
        }

        if (node.rgt + 1 === pnode.rgt) {
          let preNode = pnodes.pop();
          if (pnodes.length > 0) {
            while (preNode!.rgt + 1 === pnodes[pnodes.length - 1]?.rgt) {
              preNode = pnodes.pop();
              if (pnodes.length === 0) break;
            }
          }
        }
      }

      if ((node.rgt - node.lft - 1) % 2 !== 0) {
        throw new Error(`${node.title}(${node.pk}) rgt - lft error`);
      }
    } else if (node.rgt - node.lft >= 3) {
      // 有子节点
      if ((node.rgt - node.lft - 1) % 2 === 0) {
        pnodes.push(node);
      } else {
        throw new Error(`${node.title}(${node.pk}) rgt - lft error`);
      }
    } else {
      throw new Error();
    }
  }

  if (pnodes.length > 0) {
    throw new Error();
  }

  return true;
}
