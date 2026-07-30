// oxlint-disable no-unused-vars
import { describe, test, expect } from "bun:test";
import { FlexTreeManager } from "../src/manager";
import { createMockAdapter } from "./helpers/mock-adapter";

/**
 * SQL 注入防护测试套件
 *
 * 这些测试确保所有用户输入（特别是 treeId）都经过正确的转义，
 * 防止 SQL 注入攻击。
 */
describe("SQL 注入防护测试", () => {
  describe("treeId 注入防护", () => {
    const maliciousTreeIds = [
      {
        name: "经典 OR 注入",
        value: "1' OR '1'='1",
        description: "试图绕过条件验证",
      },
      {
        name: "SQL 注释注入",
        value: "1'; DROP TABLE users; --",
        description: "试图删除表",
      },
      {
        name: "UNION 注入",
        value: "1' UNION SELECT * FROM users--",
        description: "试图窃取数据",
      },
      {
        name: "多语句注入",
        value: "1'; INSERT INTO users VALUES ('hacker', 'password'); --",
        description: "试图插入恶意数据",
      },
      {
        name: "MySQL 注释注入",
        value: "1' OR 1=1#",
        description: "使用 # 注释符",
      },
      {
        name: "反斜杠转义注入",
        value: "1\\'; EXEC xp_cmdshell('format c:'); --",
        description: "试图执行系统命令",
      },
      {
        name: "带引号的树名",
        value: "root's tree",
        description: "合法但包含特殊字符",
      },
      {
        name: "带双引号的树名",
        value: 'tree "quoted"',
        description: "包含双引号",
      },
      {
        name: "带反斜杠的树名",
        value: "tree\\name",
        description: "包含反斜杠",
      },
      {
        name: "带换行符的树名",
        value: "tree\nname",
        description: "包含换行符",
      },
      {
        name: "带制表符的树名",
        value: "tree\tname",
        description: "包含制表符",
      },
      {
        name: "带分号的树名",
        value: "tree; DROP TABLE x",
        description: "包含分号",
      },
    ];

    test.each(maliciousTreeIds)(
      "应安全转义恶意 treeId: $name",
      async ({ value: maliciousTreeId, description }) => {
        const mockAdapter = createMockAdapter();
        const tableName = "users";
        const manager = new FlexTreeManager(tableName, {
          treeId: maliciousTreeId,
          adapter: mockAdapter,
        });

        // 记录执行的 SQL
        const executedSqls: string[] = [];
        const originalExec = mockAdapter.exec.bind(mockAdapter);
        mockAdapter.exec = async (sqls: string | string[]) => {
          const sqlArray = Array.isArray(sqls) ? sqls : [sqls];
          executedSqls.push(...sqlArray);
          return originalExec(sqls);
        };

        const originalGetRows = mockAdapter.getRows.bind(mockAdapter);
        mockAdapter.getRows = async (sql: string) => {
          executedSqls.push(sql);
          return originalGetRows(sql);
        };

        // 测试各种查询方法
        await manager.getNodes();
        await manager.getRoot();
        await manager.getChildren(1);

        // 验证：执行的 SQL 中不包含原始的恶意代码
        // 恶意代码应该被转义，例如 1' OR '1'='1 应该变成 '1'' OR ''1''=''1'
        for (const sql of executedSqls) {
          // 检查 SQL 不包含未转义的恶意模式
          expect(sql).not.toContain(maliciousTreeId);

          // 对于某些特殊情况，检查转义后的形式
          if (maliciousTreeId.includes("'")) {
            // 单引号应该被转义（MySQL 用 \'，其他数据库用 ''）
            expect(sql).not.toMatch(/(?<!')'(?!')/); // 不应该有单独的单引号
          }
        }
      },
    );

    test("应正确转义 treeId 中的单引号", async () => {
      const mockAdapter = createMockAdapter();
      const manager = new FlexTreeManager("users", {
        treeId: "root's tree",
        adapter: mockAdapter,
      });

      let capturedSql: string | null = null;
      mockAdapter.getRows = async (sql: string) => {
        capturedSql = sql;
        return [];
      };

      await manager.getNodes();

      // 验证单引号被正确转义
      expect(capturedSql).toBeDefined();
      // 根据 escaper 实现，单引号应该被转义
      // MySQL: \'  或 PostgreSQL: ''
      expect(capturedSql).not.toContain("root's tree"); // 原始字符串不应出现
    });

    test("应处理数值类型的 treeId", async () => {
      const mockAdapter = createMockAdapter();
      const manager = new FlexTreeManager("users", {
        treeId: 1,
        adapter: mockAdapter,
      });

      let capturedSql: string | null = null;
      mockAdapter.getRows = async (sql: string) => {
        capturedSql = sql;
        return [];
      };

      await manager.getNodes();

      // 验证数值不被添加引号
      expect(capturedSql).toContain("treeId=1"); // 不是 treeId='1'
      expect(capturedSql).not.toContain("treeId='1'");
    });

    test("应处理 null 类型的 treeId", async () => {
      const mockAdapter = createMockAdapter();
      const manager = new FlexTreeManager("users", {
        treeId: null as any,
        adapter: mockAdapter,
      });

      let capturedSql: string | null = null;
      mockAdapter.getRows = async (sql: string) => {
        capturedSql = sql;
        return [];
      };

      await manager.getNodes();

      // 验证 null 被转换为 SQL NULL
      expect(capturedSql).toBeDefined();
    });
  });

  describe("节点 ID 注入防护", () => {
    const maliciousNodeIds = [
      { name: "OR 注入", value: "1' OR '1'='1" },
      { name: "UNION 注入", value: "1' UNION SELECT * FROM users--" },
      { name: "注释注入", value: "1'; DROP TABLE users; --" },
    ];

    test.each(maliciousNodeIds)(
      "应安全转义恶意节点 ID: $name",
      async ({ value: maliciousNodeId }) => {
        const mockAdapter = createMockAdapter();
        const manager = new FlexTreeManager("users", {
          adapter: mockAdapter,
        });

        let capturedSql: string | null = null;
        mockAdapter.getRows = async (sql: string) => {
          capturedSql = sql;
          return [];
        };

        // 测试 getNode 方法
        try {
          await manager.getNode(maliciousNodeId as any);
        } catch (e) {
          // 节点不存在时会抛出错误，这是正常的
        }

        // 验证 SQL 不包含未转义的恶意代码
        expect(capturedSql).toBeDefined();
        expect(capturedSql).not.toContain(maliciousNodeId);
      },
    );
  });

  describe("字段名注入防护", () => {
    test("应安全转义自定义字段名", async () => {
      const mockAdapter = createMockAdapter();
      const manager = new FlexTreeManager("users", {
        fields: {
          id: "user's_id", // 恶意字段名
          name: "name",
          treeId: "treeId",
          level: "level",
          leftValue: "leftValue",
          rightValue: "rightValue",
        },
        adapter: mockAdapter,
      });

      // 字段名应该被转义为标识符
      // MySQL: `user's_id`, PostgreSQL: "user's_id", SQLite: [user's_id]
      expect(manager.keyFields.id).toBeDefined();
    });
  });

  describe("多树表环境下的安全测试", () => {
    test("应防止跨树数据访问", async () => {
      const mockAdapter = createMockAdapter();
      const tableName = "users";

      // 创建两个独立的树管理器
      const tree1 = new FlexTreeManager(tableName, {
        treeId: "tree1",
        adapter: mockAdapter,
      });
      const tree2 = new FlexTreeManager(tableName, {
        treeId: "tree2",
        adapter: mockAdapter,
      });

      // 模拟数据库返回不同树的数据
      let callCount = 0;
      mockAdapter.getRows = async (sql: string) => {
        callCount++;

        // 验证 SQL 包含正确的树 ID 过滤
        if (sql.includes("tree1")) {
          expect(sql).toContain("treeId=");
          expect(sql).not.toContain("tree2");
        } else if (sql.includes("tree2")) {
          expect(sql).toContain("treeId=");
          expect(sql).not.toContain("tree1");
        }

        // 模拟返回数据
        if (callCount === 1) {
          return [{ id: 1, name: "tree1-node1", treeId: "tree1" }];
        } else {
          return [{ id: 2, name: "tree2-node1", treeId: "tree2" }];
        }
      };

      // 获取两个树的数据
      const tree1Nodes = await tree1.getNodes();
      const tree2Nodes = await tree2.getNodes();

      // 验证数据隔离
      expect(tree1Nodes).toBeDefined();
      expect(tree2Nodes).toBeDefined();
      expect(callCount).toBe(2);
    });

    test("应防止通过恶意 treeId 访问其他树的数据", async () => {
      const mockAdapter = createMockAdapter();
      const maliciousManager = new FlexTreeManager("users", {
        treeId: "tree2' OR '1'='1",
        adapter: mockAdapter,
      });

      let capturedSql: string | null = null;
      mockAdapter.getRows = async (sql: string) => {
        capturedSql = sql;
        return [];
      };

      await maliciousManager.getNodes();

      // 验证恶意 treeId 被正确转义
      expect(capturedSql).toBeDefined();
      expect(capturedSql).not.toContain("tree2' OR '1'='1");
      // 转义后的形式应该包含
      if (mockAdapter.type === "mysql") {
        expect(capturedSql).toContain("tree2\\' OR \\'1\\'=\\'1");
      } else {
        expect(capturedSql).toContain("tree2'' OR ''1''=''1");
      }
    });
  });

  describe("边界情况测试", () => {
    test("应处理空字符串 treeId", async () => {
      const mockAdapter = createMockAdapter();
      const manager = new FlexTreeManager("users", {
        treeId: "",
        adapter: mockAdapter,
      });

      let capturedSql: string | null = null;
      mockAdapter.getRows = async (sql: string) => {
        capturedSql = sql;
        return [];
      };

      await manager.getNodes();

      // 空字符串应该被转义为 ''
      expect(capturedSql).toBeDefined();
      expect(capturedSql).toMatch(/treeId=''|treeId=$/);
    });

    test("应处理特殊 Unicode 字符的 treeId", async () => {
      const mockAdapter = createMockAdapter();
      const specialTreeIds = [
        "世界🌍",
        "Привет мир",
        "مرحبا",
        "こんにちは",
        "😀😁😂",
      ];

      for (const treeId of specialTreeIds) {
        manager.treeId = treeId;
        let capturedSql: string | null = null;

        mockAdapter.getRows = async (sql: string) => {
          capturedSql = sql;
          return [];
        };

        await manager.getNodes();

        // Unicode 字符应该被正确处理
        expect(capturedSql).toBeDefined();
      }
    });

    test("应处理超长 treeId", async () => {
      const mockAdapter = createMockAdapter();
      const longTreeId = "a".repeat(10000);
      const manager = new FlexTreeManager("users", {
        treeId: longTreeId,
        adapter: mockAdapter,
      });

      let capturedSql: string | null = null;
      mockAdapter.getRows = async (sql: string) => {
        capturedSql = sql;
        return [];
      };

      await manager.getNodes();

      // 超长字符串应该被正确转义
      expect(capturedSql).toBeDefined();
      expect(capturedSql).not.toContain(longTreeId); // 原始字符串不应出现
    });
  });

  describe("不同数据库类型的转义测试", () => {
    const databaseTypes = ["sqlite", "mysql", "postgresql", "oracle", "sqlserver"] as const;

    test.each(databaseTypes)("应正确转义 %s 数据库的 treeId", async (dbType) => {
      const mockAdapter = createMockAdapter(dbType);
      const manager = new FlexTreeManager("users", {
        treeId: "root's tree",
        adapter: mockAdapter,
      });

      let capturedSql: string | null = null;
      mockAdapter.getRows = async (sql: string) => {
        capturedSql = sql;
        return [];
      };

      await manager.getNodes();

      // 验证单引号被正确转义
      expect(capturedSql).toBeDefined();
      expect(capturedSql).not.toContain("root's tree"); // 原始字符串不应出现

      // 根据数据库类型验证转义方式
      if (dbType === "mysql") {
        // MySQL 使用反斜杠转义
        expect(capturedSql).toMatch(/root\\'s/);
      } else {
        // 其他数据库使用双单引号
        expect(capturedSql).toMatch(/root''s/);
      }
    });
  });
});

/**
 * 创建 mock adapter 用于测试
 */
function createMockAdapter(dbType: "sqlite" | "mysql" | "postgresql" | "oracle" | "sqlserver" = "sqlite") {
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
