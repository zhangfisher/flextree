/**
 * Mock Adapter 测试辅助工具
 *
 * 用于测试过程中模拟数据库适配器行为
 */

export function createMockAdapter(
  dbType: "sqlite" | "mysql" | "postgresql" | "oracle" | "sqlserver" = "sqlite",
) {
  let currentTreeId: any = null;

  const mockAdapter: any = {
    type: dbType,
    ready: false,
    bind: function (manager: any) {
      currentTreeId = manager.treeId;
    },
    exec: async function (sqls: string | string[]) {
      return;
    },
    getRows: async function (sql: string) {
      // 为不同的SQL查询返回模拟数据
      // 模拟根节点查询
      if (sql.includes('level=0') || sql.includes('level = 0')) {
        return [{
          id: 0,
          name: 'root',
          treeId: currentTreeId,
          level: 0,
          leftValue: 1,
          rightValue: 10,
        }];
      }

      // 模拟所有节点查询
      if (sql.includes('SELECT * FROM') && sql.includes('ORDER BY') && sql.includes('leftValue')) {
        return [
          {
            id: 0,
            name: 'root',
            treeId: currentTreeId,
            level: 0,
            leftValue: 1,
            rightValue: 10,
          },
          {
            id: 1,
            name: 'node1',
            treeId: currentTreeId,
            level: 1,
            leftValue: 2,
            rightValue: 3,
          },
          {
            id: 2,
            name: 'node2',
            treeId: currentTreeId,
            level: 1,
            leftValue: 4,
            rightValue: 5,
          }
        ];
      }

      // 模拟ID为1的节点查询
      if (sql.includes('id=1') || sql.includes('id = 1') || sql.includes('= 1') && sql.includes('WHERE')) {
        return [{
          id: 1,
          name: 'node1',
          treeId: currentTreeId,
          level: 1,
          leftValue: 2,
          rightValue: 3,
        }];
      }

      // 模拟子节点查询（包含 leftValue 和 rightValue 条件）
      if (sql.includes('leftValue') && sql.includes('rightValue') && sql.includes('>')) {
        return [{
          id: 1,
          name: 'node1',
          treeId: currentTreeId,
          level: 1,
          leftValue: 2,
          rightValue: 3,
        }];
      }

      // 默认返回空数组
      return [];
    },
    getScalar: async function (sql: string) {
      return 0;
    },
    open: async function () {
      this.ready = true;
    },
  };

  return mockAdapter;
}
