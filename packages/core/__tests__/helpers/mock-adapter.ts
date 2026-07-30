/**
 * Mock Adapter 测试辅助工具
 *
 * 用于测试过程中模拟数据库适配器行为
 */

export function createMockAdapter(
  dbType: "sqlite" | "mysql" | "postgresql" | "oracle" | "sqlserver" = "sqlite",
) {
  const mockAdapter: any = {
    type: dbType,
    ready: false,
    bind: function () {},
    exec: async function (sqls: string | string[]) {
      return;
    },
    getRows: async function (sql: string) {
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
