import { FlexTreeManager, FlexTree, type IFlexTreeNodeFields } from "../src";
import { FlexTreeVerifyError, DefaultTreeKeyFields } from "../src";
import BunSqliteAdapter from "../../bun-sqlite/src";

export interface TestFields {
  title: string;
  size: number;
}

export async function createTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS  tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),
            treeId INTEGER,
            level INTEGER,
            leftValue INTEGER,
            rightValue INTEGER,
            title VARCHAR(60),
            size INTEGER
        );
        `,
  ]);
}

export async function createMultiTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS  tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),
            treeId INTEGER,
            level INTEGER,
            leftValue INTEGER,
            rightValue INTEGER,
            title VARCHAR(60),
            size INTEGER,
            UNIQUE(treeId, leftValue)
        );
        `,
  ]);
}

async function clearAllTables(driver: BunSqliteAdapter) {
  await driver.exec([`DELETE FROM tree`]);
}

export async function createTreeManager(treeId?: number): Promise<FlexTreeManager<TestFields>> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  if (treeId) {
    await createMultiTreeTable(sqliteAdapter);
  } else {
    await createTreeTable(sqliteAdapter);
  }
  await clearAllTables(sqliteAdapter);

  const manager = new FlexTreeManager<TestFields>("tree", {
    treeId: treeId ? ["treeId", treeId] : undefined,
    adapter: sqliteAdapter,
  });

  return manager;
}

export async function createFlexTree(treeId?: number): Promise<FlexTree<TestFields>> {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  if (treeId) {
    await createMultiTreeTable(sqliteAdapter);
  } else {
    await createTreeTable(sqliteAdapter);
  }
  await clearAllTables(sqliteAdapter);

  const tree = new FlexTree<TestFields>("tree", {
    treeId: treeId ? ["treeId", treeId] : undefined,
    adapter: sqliteAdapter,
    lazy: false, // 明确禁用 lazy loading，确保完整树结构加载
  });

  return tree;
}

/**
 * 生成一个 demo 树
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
  tree: FlexTreeManager<TestFields>,
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
 * 对通过createDemoTree生成的树进行全树验证
 *
 * 主要验证左右值是否正确，如果不正确则抛出异常
 */
export async function verifyTree(tree: FlexTreeManager<TestFields>): Promise<boolean> {
  const nodes = await tree.getNodes();
  const pnodes: IFlexTreeNodeFields<TestFields, DefaultTreeKeyFields>[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.rightValue - node.leftValue === 1) {
      // 无子节点
      if (pnodes.length > 0) {
        const pnode = pnodes[pnodes.length - 1];
        if (pnode.level !== node.level - 1) {
          throw new FlexTreeVerifyError(`level error ${node.name}(${node.id})`);
        } else if (!(node.leftValue > pnode.leftValue)) {
          throw new FlexTreeVerifyError(`leftValue error ${node.name}(${node.id})`);
        } else if (!(node.rightValue < pnode.rightValue)) {
          throw new FlexTreeVerifyError(`rightValue error ${node.name}(${node.id})`);
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
        throw new FlexTreeVerifyError(`${node.name}(${node.id}) rightValue - leftValue error `);
      }
    } else if (node.rightValue - node.leftValue >= 3) {
      // 有子节点
      //  rightValue-leftValue一定是奇数,否则说明有问题
      if ((node.rightValue - node.leftValue - 1) % 2 === 0) {
        pnodes.push(node); // 先保存父节点
      } else {
        throw new FlexTreeVerifyError(`${node.name}(${node.id}) rightValue - leftValue error `);
      }
    } else {
      throw new FlexTreeVerifyError();
    }
  }

  if (pnodes.length > 0) {
    throw new FlexTreeVerifyError();
  }

  return true;
}

/**
 * 导出树数据用于调试
 */
export async function dumpTree(
  adapter: BunSqliteAdapter,
): Promise<IFlexTreeNodeFields<TestFields, DefaultTreeKeyFields>[]> {
  const rows = await adapter.getRows("SELECT * FROM tree ORDER BY leftValue");
  return rows as IFlexTreeNodeFields<TestFields, DefaultTreeKeyFields>[];
}

export type TestFlexTreeManager = FlexTreeManager<TestFields>;
export type TestFlexTree = FlexTree<TestFields>;
