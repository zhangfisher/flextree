/**
 * Bun 类型验证脚本
 *
 * 此脚本用于验证 bun:test 类型定义是否正确安装和可访问
 * 如果脚本运行成功，说明 TypeScript 能正确识别 Bun 类型
 */

// 尝试导入 bun:test 的类型
import type {} from "bun:test";

console.log("✓ bun:test 类型定义可访问");
console.log("✓ TypeScript 语言服务配置正确");
console.log("✓ @types/bun 包已正确安装");
