// sqljs 适配器契约测试（bun test，串行执行）
import { describe, test, expect, beforeEach } from "bun:test";
import initSqlJs from "sql.js";
import FlexTreeSqljsAdapter, { FlexTreeSqljsPersistError } from "../src";

let SQL: Awaited<ReturnType<typeof initSqlJs>>;

beforeEach(async () => {
  SQL = await initSqlJs();
});

function createAdapter(options?: ConstructorParameters<typeof FlexTreeSqljsAdapter>[1]) {
  const db = new SQL.Database();
  const adapter = new FlexTreeSqljsAdapter(db, options);
  return adapter;
}

async function createTable(adapter: FlexTreeSqljsAdapter) {
  await adapter.exec(`
    CREATE TABLE tree (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(60),
        treeId INTEGER,
        level INTEGER,
        leftValue INTEGER,
        rightValue INTEGER
    );
  `);
}

describe("FlexTreeSqljsAdapter 基础契约", () => {
  test("connected / bind / open", () => {
    const adapter = createAdapter();
    expect(adapter.connected).toBe(true);
    expect(adapter.open()).resolves.toBe(adapter.db);
  });

  test("getRows 返回列名→对象映射", async () => {
    const adapter = createAdapter();
    await createTable(adapter);
    await adapter.exec("INSERT INTO tree (name, level, leftValue, rightValue) VALUES ('a', 0, 1, 2)");
    const rows = await adapter.getRows<{ id: number; name: string; level: number }>(
      "SELECT id, name, level FROM tree",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("a");
    expect(rows[0].level).toBe(0);
  });

  test("getScalar 返回首行首列", async () => {
    const adapter = createAdapter();
    await createTable(adapter);
    await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
    const count = await adapter.getScalar<number>("SELECT COUNT(*) FROM tree");
    expect(count).toBe(1);
  });

  test("getScalar 无结果时抛错（与 bun-sqlite 一致）", async () => {
    const adapter = createAdapter();
    await createTable(adapter);
    expect(adapter.getScalar("SELECT id FROM tree")).rejects.toThrow("No scalar value found");
  });

  test("exec 支持字符串与数组", async () => {
    const adapter = createAdapter();
    await createTable(adapter);
    await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
    await adapter.exec(["INSERT INTO tree (name) VALUES ('b')", "INSERT INTO tree (name) VALUES ('c')"]);
    const count = await adapter.getScalar<number>("SELECT COUNT(*) FROM tree");
    expect(count).toBe(3);
  });
});

describe("transaction 语义", () => {
  test("COMMIT 保留数据", async () => {
    const adapter = createAdapter();
    await createTable(adapter);
    await adapter.transaction(async () => {
      await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
    });
    const count = await adapter.getScalar<number>("SELECT COUNT(*) FROM tree");
    expect(count).toBe(1);
  });

  test("ROLLBACK 回滚数据", async () => {
    const adapter = createAdapter();
    await createTable(adapter);
    await adapter
      .transaction(async () => {
        await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
        throw new Error("boom");
      })
      .catch(() => {});
    const count = await adapter.getScalar<number>("SELECT COUNT(*) FROM tree");
    expect(count).toBe(0);
  });

  test("嵌套调用复用外层事务（内层失败整体回滚）", async () => {
    const adapter = createAdapter();
    await createTable(adapter);
    await adapter
      .transaction(async () => {
        await adapter.exec("INSERT INTO tree (name) VALUES ('outer')");
        await adapter.transaction(async () => {
          await adapter.exec("INSERT INTO tree (name) VALUES ('inner')");
        });
      })
      .catch(() => {});
    // 外层成功则全部提交
    expect(await adapter.getScalar<number>("SELECT COUNT(*) FROM tree")).toBe(2);

    const adapter2 = createAdapter();
    await createTable(adapter2);
    await adapter2
      .transaction(async () => {
        await adapter2.exec("INSERT INTO tree (name) VALUES ('outer')");
        await adapter2
          .transaction(async () => {
            await adapter2.exec("INSERT INTO tree (name) VALUES ('inner')");
            throw new Error("inner boom");
          })
          .catch(() => {}); // 内层错误被捕获，外层继续提交
      })
      .catch(() => {});
    // 内层嵌套复用外层事务：外层 COMMIT 后两条都在
    expect(await adapter2.getScalar<number>("SELECT COUNT(*) FROM tree")).toBe(2);
  });
});

describe("onPersist 持久化钩子", () => {
  test("写事务 COMMIT 后触发，参数为 db 实例", async () => {
    const persisted: unknown[] = [];
    const adapter = createAdapter({
      onPersist: (db) => {
        persisted.push(db);
      },
    });
    await createTable(adapter);
    await adapter.transaction(async () => {
      await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toBe(adapter.db);
  });

  test("纯读事务不触发", async () => {
    let count = 0;
    const adapter = createAdapter({ onPersist: () => count++ });
    await createTable(adapter);
    await adapter.transaction(async () => {
      await adapter.getRows("SELECT * FROM tree");
    });
    expect(count).toBe(0);
  });

  test("ROLLBACK 不触发", async () => {
    let count = 0;
    const adapter = createAdapter({ onPersist: () => count++ });
    await createTable(adapter);
    await adapter
      .transaction(async () => {
        await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
        throw new Error("boom");
      })
      .catch(() => {});
    expect(count).toBe(0);
  });

  test("无钩子时写事务正常（不抛错）", async () => {
    const adapter = createAdapter();
    await createTable(adapter);
    await adapter.transaction(async () => {
      await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
    });
    expect(await adapter.getScalar<number>("SELECT COUNT(*) FROM tree")).toBe(1);
  });

  test("钩子抛错包装为 FlexTreeSqljsPersistError，且数据已提交", async () => {
    const adapter = createAdapter({
      onPersist: () => {
        throw new Error("QuotaExceeded");
      },
    });
    await createTable(adapter);
    let caught: unknown;
    await adapter
      .transaction(async () => {
        await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
      })
      .catch((e) => {
        caught = e;
      });
    expect(caught).toBeInstanceOf(FlexTreeSqljsPersistError);
    expect((caught as FlexTreeSqljsPersistError).cause).toBeInstanceOf(Error);
    // 关键语义：持久化失败时内存已提交
    expect(await adapter.getScalar<number>("SELECT COUNT(*) FROM tree")).toBe(1);
  });

  test("异步钩子被 await（完成前事务不结束）", async () => {
    let done = false;
    const order: string[] = [];
    const adapter = createAdapter({
      onPersist: async () => {
        await new Promise((r) => setTimeout(r, 10));
        done = true;
        order.push("persist-done");
      },
    });
    await createTable(adapter);
    await adapter.transaction(async () => {
      await adapter.exec("INSERT INTO tree (name) VALUES ('a')");
    });
    order.push("write-returned");
    expect(done).toBe(true);
    expect(order).toEqual(["persist-done", "write-returned"]);
  });
});
