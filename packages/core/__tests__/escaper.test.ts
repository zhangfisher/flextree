// oxlint-disable no-unused-vars
import { describe, test, expect } from "bun:test";
import { createEscaper, type DatabaseType, raw } from "../src/escaper";

// 使用全局 Buffer 对象
declare const Buffer: {
  from(data: number[] | Uint8Array): Buffer;
  prototype: Buffer;
  isBuffer(data: unknown): data is Buffer;
};

describe("escaper 多数据库支持测试", () => {
  const dbTypes: DatabaseType[] = ["sqlite", "mysql", "postgresql", "oracle", "sqlserver"];

  describe.each(dbTypes)("数据库类型: %s", (dbType: DatabaseType) => {
    const escaper = createEscaper(dbType);

    describe("字符串转义", () => {
      test("基本字符串转义", () => {
        const result = escaper.escape("hello");
        expect(result).toMatch(/^'hello'$/);
      });

      test("包含单引号的字符串转义", () => {
        const result = escaper.escape("it's a test");
        if (dbType === "mysql") {
          expect(result).toBe("'it\\'s a test'");
        } else {
          expect(result).toBe("'it''s a test'");
        }
      });

      test("包含特殊字符的字符串转义", () => {
        const result = escaper.escape("test\n\x00\t");
        expect(result).toBeDefined();
        expect(result).toMatch(/^'.*'$/);
      });

      test("包含双引号的字符串转义", () => {
        const result = escaper.escape('say "hello"');
        // 双引号在SQL字符串中不需要转义
        expect(result).toBe("'say \"hello\"'");
      });

      test("空字符串转义", () => {
        expect(escaper.escape("")).toBe("''");
      });

      test("中文字符串转义", () => {
        const result = escaper.escape("你好世界");
        expect(result).toBe("'你好世界'");
      });
      test("特殊字符串转义", () => {
        const result = escaper.escape('root\'s "special"');
        if (dbType === "mysql") {
          // MySQL 使用反斜杠转义单引号，双引号保持原样
          expect(result).toBe("'root\\'s \"special\"'");
        } else {
          // 其他数据库使用双单引号转义单引号，双引号保持原样
          expect(result).toBe("'root''s \"special\"'");
        }
      });
    });

    describe("标识符转义", () => {
      test("简单标识符转义", () => {
        const result = escaper.escapeId("tableName");
        switch (dbType) {
          case "mysql":
            expect(result).toBe("`tableName`");
            break;
          case "postgresql":
          case "oracle":
            expect(result).toBe('"tableName"');
            break;
          case "sqlite":
          case "sqlserver":
            expect(result).toBe("[tableName]");
            break;
        }
      });

      test("包含特殊字符的标识符转义", () => {
        const result = escaper.escapeId("table's Name");
        expect(result).toBeDefined();
        expect(result).toMatch(/^[`["'].*[`\]"']$/);
      });

      test("包含点的标识符转义", () => {
        const result = escaper.escapeId("db.tableName");
        expect(result).toBeDefined();
        expect(result).toContain("db");
        expect(result).toContain("tableName");
      });

      test("数组标识符转义", () => {
        const result = escaper.escapeId(["table1", "table2", "table3"]);
        expect(result).toContain("table1");
        expect(result).toContain("table2");
        expect(result).toContain("table3");
        expect(result).toMatch(/.*,.*,.*$/);
      });

      test("包含标识符引号的标识符转义", () => {
        const result = escaper.escapeId("my`table");
        expect(result).toBeDefined();
        expect(result).not.toContain("`my`table`");
      });
    });

    describe("布尔值转义", () => {
      test("true 值转义", () => {
        const result = escaper.escape(true);
        // 大多数数据库支持 true/false
        expect(result).toBe("true");
      });

      test("false 值转义", () => {
        const result = escaper.escape(false);
        expect(result).toBe("false");
      });

      test("布尔值在数组中", () => {
        const result = escaper.arrayToList([true, false, true]);
        expect(result).toBe("true, false, true");
      });
    });

    describe("数字转义", () => {
      test("整数转义", () => {
        expect(escaper.escape(42)).toBe("42");
      });

      test("负数转义", () => {
        expect(escaper.escape(-3.14)).toBe("-3.14");
      });

      test("科学计数法转义", () => {
        expect(escaper.escape(1.23e-4)).toBe("0.000123");
      });

      test("BigInt 转义", () => {
        expect(escaper.escape(BigInt(9007199254740991))).toBe("9007199254740991");
      });

      test("零值转义", () => {
        expect(escaper.escape(0)).toBe("0");
      });
    });

    describe("NULL 值转义", () => {
      test("null 值转义", () => {
        expect(escaper.escape(null)).toBe("NULL");
      });

      test("undefined 值转义", () => {
        expect(escaper.escape(undefined)).toBe("NULL");
      });

      test("数组中的 null 值", () => {
        const result = escaper.arrayToList([1, null, 3]);
        expect(result).toBe("1, NULL, 3");
      });
    });

    describe("日期时间转义", () => {
      test("标准日期转义", () => {
        const date = new Date("2024-03-15T10:30:45.123Z");
        const result = escaper.dateToString(date, "Z");
        // 验证日期格式符合数据库要求
        expect(result).toMatch(/'2024-03-15/);
        expect(result).toMatch(/10:30:45/);
      });

      test("无效日期转义", () => {
        const invalidDate = new Date("invalid");
        expect(escaper.dateToString(invalidDate, "local")).toBe("NULL");
      });

      test("本地时区日期转义", () => {
        const date = new Date("2024-03-15T10:30:45.123Z");
        const result = escaper.dateToString(date, "local");
        expect(result).toBeDefined();
        expect(result).toMatch(/'.*'/);
      });

      test("日期包含毫秒", () => {
        const date = new Date("2024-03-15T10:30:45.999Z");
        const result = escaper.dateToString(date, "Z");
        expect(result).toMatch(/\.999/);
      });
    });

    describe("数组转列表", () => {
      test("简单数组转列表", () => {
        const result = escaper.arrayToList([1, 2, 3]);
        expect(result).toBe("1, 2, 3");
      });

      test("混合类型数组转列表", () => {
        const result = escaper.arrayToList([1, "hello", null]);
        expect(result).toContain("1");
        expect(result).toContain("hello");
        expect(result).toContain("NULL");
      });

      test("嵌套数组转列表", () => {
        const result = escaper.arrayToList([
          [1, 2],
          [3, 4],
        ]);
        expect(result).toBe("(1, 2), (3, 4)");
      });

      test("Set 类型转列表", () => {
        const result = escaper.arrayToList(new Set([1, 2, 3]));
        expect(result).toBe("1, 2, 3");
      });

      test("空数组转列表", () => {
        expect(escaper.arrayToList([])).toBe("");
      });

      test("嵌套 Set 类型", () => {
        const result = escaper.arrayToList([new Set([1, 2]), new Set([3, 4])]);
        expect(result).toBe("(1, 2), (3, 4)");
      });
    });

    describe("对象转值", () => {
      test("简单对象转值", () => {
        const result = escaper.objectToValues({ name: "John", age: 30 });
        expect(result).toContain("name");
        expect(result).toContain("age");
        expect(result).toContain("John");
        expect(result).toContain("30");
      });

      test("Map 对象转值", () => {
        const map = new Map<string, string | number>([
          ["name", "Alice"],
          ["age", 25],
        ]);
        const result = escaper.objectToValues(map);
        expect(result).toContain("name");
        expect(result).toContain("Alice");
      });

      test("对象转值带特殊字符", () => {
        const result = escaper.objectToValues({ "user's name": "John's" });
        expect(result).toContain("user's name");
        // MySQL 使用反斜杠转义，其他数据库使用双单引号
        if (dbType === "mysql") {
          expect(result).toContain("John\\'s");
        } else {
          expect(result).toContain("John''s");
        }
      });

      test("空对象转值", () => {
        expect(escaper.objectToValues({})).toBe("");
      });

      test("对象中包含 null 值", () => {
        const result = escaper.objectToValues({ name: null, age: 30 });
        expect(result).toContain("NULL");
      });
    });

    describe("Buffer 转换", () => {
      test("Buffer 转十六进制", () => {
        const buffer = Buffer.from([0x01, 0x02, 0x03]);
        const result = escaper.bufferToString(buffer);
        expect(result).toMatch(/X'010203'/);
      });

      test("Uint8Array 转换", () => {
        const uint8Array = new Uint8Array([0xff, 0xfe, 0xfd]);
        const result = escaper.escape(uint8Array);
        expect(result).toMatch(/X'.*'/);
        expect(result).toContain("FFFEFD");
      });

      test("空 Buffer 转换", () => {
        const buffer = Buffer.from([]);
        const result = escaper.bufferToString(buffer);
        expect(result).toBe("X''");
      });
    });

    describe("SQL 格式化", () => {
      test("简单占位符替换", () => {
        const result = escaper.format("SELECT * FROM users WHERE id = ?", 42);
        expect(result).toBe("SELECT * FROM users WHERE id = 42");
      });

      test("多个占位符替换", () => {
        const result = escaper.format("SELECT * FROM users WHERE name = ? AND age = ?", [
          "John",
          30,
        ]);
        expect(result).toContain("John");
        expect(result).toContain("30");
      });

      test("标识符占位符替换 (??)", () => {
        const result = escaper.format("SELECT * FROM ?? WHERE id = ?", "users");
        expect(result).toBeDefined();
        expect(result).toContain("users");
        expect(result).not.toContain("??");
      });

      test("对象展开为 SET 子句", () => {
        const result = escaper.format("UPDATE users SET ? WHERE id = ?", [
          { name: "Alice", age: 25 },
          1,
        ]);
        expect(result).toContain("UPDATE users SET");
        expect(result).toContain("Alice");
        expect(result).toContain("WHERE id = 1");
      });

      test("数组展开为 IN 子句", () => {
        const result = escaper.format("SELECT * FROM users WHERE id IN (?)", [[1, 2, 3]]);
        expect(result).toContain("1");
        expect(result).toContain("2");
        expect(result).toContain("3");
      });

      test("无占位符的 SQL", () => {
        const result = escaper.format("SELECT * FROM users");
        expect(result).toBe("SELECT * FROM users");
      });

      test("空值数组", () => {
        const result = escaper.format("SELECT * FROM users WHERE id IN (?)", [[]]);
        expect(result).toContain("()");
      });

      test("混合占位符类型", () => {
        const result = escaper.format("INSERT INTO ?? (name, age) VALUES (?, ?)", [
          "users",
          "Bob",
          28,
        ]);
        expect(result).toContain("users");
        expect(result).toContain("Bob");
        expect(result).toContain("28");
      });
    });

    describe("原始 SQL", () => {
      test("创建原始 SQL 对象", () => {
        const rawSql = raw("NOW()");
        expect(rawSql.toSqlString()).toBe("NOW()");
      });

      test("在 format 中使用 raw", () => {
        const result = escaper.format("SELECT * FROM users WHERE created_at = ?", raw("NOW()"));
        expect(result).toBe("SELECT * FROM users WHERE created_at = NOW()");
      });

      test("多个 raw 函数调用", () => {
        const result = escaper.format("SELECT ?, ?", [raw("COUNT(*)"), raw("SUM(total)")]);
        expect(result).toBe("SELECT COUNT(*), SUM(total)");
      });

      test("raw 函数与普通值混合", () => {
        const result = escaper.format("SELECT ? as name, ? as count", ["Alice", raw("COUNT(*)")]);
        expect(result).toContain("Alice");
        expect(result).toContain("COUNT(*)");
      });
    });

    describe("特殊场景", () => {
      test("超长字符串转义", () => {
        const longString = "a".repeat(10000);
        const result = escaper.escape(longString);
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(longString.length);
      });

      test("Unicode 字符处理", () => {
        const unicodeString = "Hello 世界 🌍";
        const result = escaper.escape(unicodeString);
        expect(result).toContain("世界");
        expect(result).toContain("🌍");
      });

      test("特殊字符组合", () => {
        const result = escaper.escape("test\x00\x08\x09\x0a\x0d\x1a\x22\x27\x5c");
        expect(result).toBeDefined();
        expect(result).toMatch(/^'.*'$/);
      });

      test("复杂嵌套结构", () => {
        const result = escaper.arrayToList([
          [1, [2, 3]],
          [4, [5, 6]],
        ]);
        expect(result).toBeDefined();
      });
    });
  });

  describe("跨数据库一致性", () => {
    test("所有数据库支持 NULL 转义", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        expect(escaper.escape(null)).toBe("NULL");
      });
    });

    test("所有数据库支持数字转义", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        expect(escaper.escape(42)).toBe("42");
      });
    });

    test("所有数据库支持数组转列表", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        expect(escaper.arrayToList([1, 2, 3])).toBe("1, 2, 3");
      });
    });

    test("所有数据库支持布尔值", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        expect(escaper.escape(true)).toBe("true");
        expect(escaper.escape(false)).toBe("false");
      });
    });
  });

  describe("数据库特定差异", () => {
    test("字符串转义差异", () => {
      const mysqlEscaper = createEscaper("mysql");
      const pgEscaper = createEscaper("postgresql");

      const mysqlResult = mysqlEscaper.escape("it's");
      const pgResult = pgEscaper.escape("it's");

      expect(mysqlResult).toBe("'it\\'s'");
      expect(pgResult).toBe("'it''s'");
    });

    test("标识符转义差异", () => {
      const mysqlEscaper = createEscaper("mysql");
      const pgEscaper = createEscaper("postgresql");
      const sqliteEscaper = createEscaper("sqlite");

      const mysqlResult = mysqlEscaper.escapeId("table");
      const pgResult = pgEscaper.escapeId("table");
      const sqliteResult = sqliteEscaper.escapeId("table");

      expect(mysqlResult).toBe("`table`");
      expect(pgResult).toBe('"table"');
      expect(sqliteResult).toBe("[table]");
    });

    test("复杂 SQL 格式化", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        const result = escaper.format("INSERT INTO ?? (name, email, created_at) VALUES (?, ?, ?)", [
          "users",
          "Alice",
          "alice@example.com",
          raw("NOW()"),
        ]);

        expect(result).toContain("Alice");
        expect(result).toContain("alice@example.com");
        expect(result).toContain("NOW()");
        expect(result).not.toContain("?");
      });
    });
  });

  describe("边界情况处理", () => {
    test("空字符串处理", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        const result = escaper.escape("");
        expect(result).toBe("''");
      });
    });

    test("超长字符串处理", () => {
      const longString = "a".repeat(10000);
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        const result = escaper.escape(longString);
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(longString.length);
      });
    });

    test("特殊 Unicode 字符处理", () => {
      const unicodeString = "Hello 世界 🌍 🎉 藤";
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        const result = escaper.escape(unicodeString);
        expect(result).toContain("世界");
        expect(result).toContain("🌍");
      });
    });

    test("Infinity 和 NaN 处理", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        const infResult = escaper.escape(Infinity);
        const nanResult = escaper.escape(NaN);

        expect(infResult).toBeDefined();
        expect(nanResult).toBeDefined();
      });
    });
  });

  describe("错误处理", () => {
    test("raw 函数参数验证", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        expect(() => escaper.raw(null as any)).toThrow();
      });
    });

    test("raw 函数不接受非字符串", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        expect(() => escaper.raw(123 as any)).toThrow("argument sql must be a string");
      });
    });
  });

  describe("性能和可靠性", () => {
    test("大量占位符处理", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        const placeholders = Array(100).fill("?").join(", ");
        const values = Array(100)
          .fill(0)
          .map((_, i) => i);
        const result = escaper.format(`SELECT ${placeholders}`, values);

        expect(result).toBeDefined();
        expect(result).not.toContain("?");
      });
    });

    test("深层嵌套结构", () => {
      dbTypes.forEach((dbType) => {
        const escaper = createEscaper(dbType);
        const nestedArray = [[[[1]]]];
        const result = escaper.arrayToList(nestedArray);

        expect(result).toBeDefined();
        expect(result).toContain("(");
      });
    });
  });
});
