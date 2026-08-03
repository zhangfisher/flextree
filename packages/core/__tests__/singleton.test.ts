import { describe, test, expect } from "bun:test";
import { FlexTreeManager } from "../src/manager";
import { createMockAdapter } from "../__tests__/helpers/mock-adapter";

describe("FlexTreeManager 单例模式测试", () => {
  test("相同 tableName 应返回同一实例", () => {
    const adapter = createMockAdapter();

    const manager1 = FlexTreeManager.getInstance("test_table", {
      adapter,
    });

    const manager2 = FlexTreeManager.getInstance("test_table", {
      adapter,
    });

    // 使用工厂方法可以实现真正的对象引用单例
    expect(manager1).toBe(manager2);
  });

  test("不同 tableName 时应返回不同实例", () => {
    const adapter = createMockAdapter();

    const manager1 = FlexTreeManager.getInstance("table1", {
      adapter,
    });

    const manager2 = FlexTreeManager.getInstance("table2", {
      adapter,
    });

    expect(manager1).not.toBe(manager2);
    expect(manager1.tableName).not.toBe(manager2.tableName);
  });

  test("直接使用构造函数创建独立实例", () => {
    const adapter = createMockAdapter();

    const manager1 = new FlexTreeManager("test_table", {
      adapter,
    });

    const manager2 = new FlexTreeManager("test_table", {
      adapter,
    });

    // 直接使用构造函数创建独立实例
    expect(manager1).not.toBe(manager2);
  });

  test("单例模式下首次调用设置会被保留", () => {
    const adapter = createMockAdapter();

    const manager1 = FlexTreeManager.getInstance("test_table1", {
      adapter,
      treeId: "tree1",
    });

    const manager2 = FlexTreeManager.getInstance("test_table1", {
      adapter,
      treeId: "tree2",
    });

    // 相同 tableName 返回同一实例，保留首次设置的 treeId
    expect(manager1).toBe(manager2);
    expect(manager1.treeId).toBe("tree1"); // 首次设置的值被保留
  });

  test("单例模式下首次调用设置的 fields 会被保留", () => {
    const adapter = createMockAdapter();

    const manager1 = FlexTreeManager.getInstance("test_table23", {
      adapter,
      fields: {
        id: "uuid",
        name: "title",
        treeId: "tree_id",
        level: "lvl",
        leftValue: "lv",
        rightValue: "rv",
      },
    });

    const manager2 = FlexTreeManager.getInstance("test_table23", {
      adapter,
      fields: {
        id: "custom_id",
        name: "custom_name",
      },
    });

    // 相同 tableName 返回同一实例，保留首次设置的 fields
    expect(manager1).toBe(manager2);
    expect(manager1.keyFields.id).toBe("uuid");
    expect(manager1.keyFields.name).toBe("title");
  });
});
