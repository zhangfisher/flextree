#!/usr/bin/env node

/**
 * 发布前提升 publishConfig 入口字段脚本
 *
 * 背景：
 * publishConfig 中的 main/module/types/exports 入口替换是 pnpm publish 的专属特性，
 * npm publish（changesets 默认）不识别这些字段，会导致发布到 npm 的 manifest
 * 仍然指向 src/index.ts 源码入口。
 *
 * 功能：
 * 1. 遍历 packages/* 下所有包
 * 2. 将 publishConfig 中的入口字段（main/module/types/exports）提升到 package.json 顶层
 * 3. 保留 publishConfig.access（npm 认识该字段）
 *
 * 说明：
 * 本脚本只在发布流程中运行，发布完成后由 publish-packages 脚本中的
 * git checkout 恢复所有 package.json 的工作区状态
 *
 * 使用方法：
 *   node scripts/promote-publish-config.js
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 需要提升到顶层的 publishConfig 入口字段
 */
const ENTRY_FIELDS = ['main', 'module', 'types', 'typings', 'exports'];

/**
 * 读取 JSON 文件
 */
function readJSON(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`❌ 读取文件失败: ${filePath}`);
    console.error(error.message);
    return null;
  }
}

/**
 * 获取 packages/* 下所有包含 package.json 的包目录
 */
function findPackageDirs(rootDir) {
  const packagesDir = join(rootDir, 'packages');
  if (!existsSync(packagesDir)) {
    console.error(`❌ 未找到 packages 目录: ${packagesDir}`);
    return [];
  }

  const packageDirs = [];
  const dirs = readdirSync(packagesDir, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const pkgJsonPath = join(packagesDir, dir.name, 'package.json');
    if (existsSync(pkgJsonPath)) {
      packageDirs.push(join(packagesDir, dir.name));
    }
  }
  return packageDirs;
}

/**
 * 处理单个包：提升 publishConfig 入口字段到顶层
 */
function processPackage(pkgDir) {
  const pkgJsonPath = join(pkgDir, 'package.json');
  const pkg = readJSON(pkgJsonPath);
  if (!pkg) return false;

  const name = pkg.name || pkgDir;
  const publishConfig = pkg.publishConfig;
  if (!publishConfig || typeof publishConfig !== 'object') {
    console.log(`  ℹ️  ${name}: 无 publishConfig，跳过`);
    return true;
  }

  const promoted = [];
  for (const field of ENTRY_FIELDS) {
    if (publishConfig[field] !== undefined) {
      pkg[field] = publishConfig[field];
      promoted.push(field);
    }
  }

  if (promoted.length === 0) {
    console.log(`  ℹ️  ${name}: publishConfig 中无入口字段，跳过`);
    return true;
  }

  // publishConfig 仅保留 npm 认识的字段（access/registry 等）
  const remaining = Object.keys(publishConfig).filter(
    (key) => !ENTRY_FIELDS.includes(key)
  );
  if (remaining.length === 0) {
    delete pkg.publishConfig;
  } else {
    pkg.publishConfig = Object.fromEntries(
      remaining.map((key) => [key, publishConfig[key]])
    );
  }

  try {
    writeFileSync(
      pkgJsonPath,
      JSON.stringify(pkg, null, 2) + '\n',
      'utf-8'
    );
    console.log(`  ✅ ${name}: 已提升字段 [${promoted.join(', ')}]`);
    return true;
  } catch (error) {
    console.error(`  ❌ ${name}: 写入失败 - ${error.message}`);
    return false;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始提升 publishConfig 入口字段...\n');

  const args = process.argv.slice(2);
  const rootDir = args[0] ? resolve(args[0]) : resolve(__dirname, '..');
  console.log(`📁 根目录: ${rootDir}\n`);

  const packageDirs = findPackageDirs(rootDir);
  if (packageDirs.length === 0) {
    console.error('❌ 未找到任何包');
    process.exit(1);
  }

  console.log(`🔄 开始处理 ${packageDirs.length} 个包...\n`);
  let successCount = 0;
  let failCount = 0;

  for (const pkgDir of packageDirs) {
    if (processPackage(pkgDir)) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✨ 完成! 成功: ${successCount}, 失败: ${failCount}`);
  console.log('='.repeat(50));

  if (failCount > 0) process.exit(1);
}

main();
