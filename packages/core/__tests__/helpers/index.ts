/**
 * 测试工具函数统一导出
 *
 * 所有测试相关的工具函数都从此处导出
 * 提供统一的入口，便于维护和使用
 */

// ===== 树管理器相关 =====
export {
  // 表创建
  createTreeTable,
  createMultiTreeTable,
  createCustomTreeTable,
  createCustomMultiTreeTable,
  // 管理器创建
  createTreeManager,
  createFlexTree,
  createCustomTreeManager,
  createCustomFlexTree,
  // 类型导出
  type TestFields,
  type TestFlexTreeManager,
  type TestFlexTree,
  type DemoFlexTreeManager,
  type DemoFlexTree,
  type CustomDemoFlexTreeManager,
  type CustomDemoFlexTree,
} from "./tree-manager";

// ===== 树构建相关 =====
export {
  createDemoTree,
  createCustomDemoTree,
} from "./tree-builder";

// ===== 树验证相关 =====
export {
  verifyTree,
  verifyCustomTree,
} from "./tree-verifier";

// ===== 树导出相关 =====
export {
  dumpTree,
  dumpCustomTree,
  dumpTreeCompat,
} from "./tree-exporter";

// ===== 树可视化相关 =====
export {
  toTree,
  toNestedTree,
  toSimpleTree,
  toDetailedTree,
  toCustomTree,
  buildTreeStructure,
  type TreeNode,
  type ToTreeOptions,
} from "./tree-visualizer";

// ===== Mock适配器 =====
export { createMockAdapter } from "./mock-adapter";

// ===== 工具类型 =====
export type ReturnPromiseType<T extends (...args: any) => any> = ReturnType<
  T
> extends Promise<infer U>
  ? U
  : ReturnType<T>;
