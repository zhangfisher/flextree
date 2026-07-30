import Database from "bun:sqlite";
import { FlexTreeManager, FlexTree } from "../../src";
import BunSqliteAdapter from "../../../bun-sqlite/src";

export async function createTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS  tree (
            pk INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60),
            tree INTEGER,
            level INTEGER,
            lft INTEGER,
            rgt INTEGER,
            size INTEGER
        );
        `,
  ]);
}

export async function createMultiTreeTable(driver: BunSqliteAdapter) {
  await driver.exec([
    `
        CREATE TABLE IF NOT EXISTS  tree (
            pk INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60),
            tree INTEGER,
            level INTEGER,
            lft INTEGER,
            rgt INTEGER,
            size INTEGER,
            UNIQUE(tree, lft)
        );
        `,
  ]);
}

async function clearAllTables(driver: BunSqliteAdapter) {
  await driver.exec([`DELETE FROM tree`]);
}

export async function createCustomTreeManager(treeId?: any) {
  const sqliteAdapter = new BunSqliteAdapter();
  await sqliteAdapter.open();
  if (treeId) {
    await createMultiTreeTable(sqliteAdapter);
  } else {
    await createTreeTable(sqliteAdapter);
  }
  await clearAllTables(sqliteAdapter);
  return new FlexTreeManager<
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
  >("tree", {
    treeId,
    adapter: sqliteAdapter,
    fields: {
      id: "pk",
      treeId: "tree",
      name: "title",
      leftValue: "lft",
      rightValue: "rgt",
    },
  });
}

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

export type CustomDemoFlexTree = FlexTree<
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

export async function createCustomFlexTree(treeId?: any) {
  const sqliteDriver = new BunSqliteAdapter();
  await sqliteDriver.open();
  if (treeId) {
    await createMultiTreeTable(sqliteDriver);
  } else {
    await createTreeTable(sqliteDriver);
  }
  await clearAllTables(sqliteDriver);
  const tree = new FlexTree<
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
  >("tree", {
    treeId,
    adapter: sqliteDriver,
    fields: {
      id: "pk",
      treeId: "tree",
      name: "title",
      leftValue: "lft",
      rightValue: "rgt",
    },
  });
  return tree;
}

/**
 *
 * 生成一个 demo 树
 *
 * @description
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

/**
 * 将srceDb的树复制到destDb
 *
 * 单元测试使用内存数据库，调试过程中不方便查看表数据
 * 所以在每个Case后将数据转存到数据库文件以便查看
 *
 * @param srcDb
 */
export async function dumpCustomTree(srcDb: Database, dbFile: string = "tree.db") {
  // BunSqliteAdapter使用内存数据库，dump功能不再需要
  // 保留函数签名以兼容现有测试
}

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

export type ReturnPromiseType<T extends (...args: any) => any> = ReturnType<
  T
> extends Promise<infer U>
  ? U
  : ReturnType<T>;
