# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

FlexTree 是一个基于 Nested Set Model (左右值算法) 的树结构存储和管理库，使用 TypeScript 开发，支持多种数据库适配器。该项目采用 monorepo 架构，使用 Bun 1.3.14 管理多个包。

### 核心算法

项目基于 Nested Set Model 算法，通过 `leftValue` 和 `rightValue` 两个字段来表示节点在树中的位置，实现高效的树结构查询和操作。相比传统的邻接表模型，该算法在查询子树、获取路径等操作上具有明显优势。

### 项目特点

- **Mixin 架构模式**: 核心管理器使用 Mixin 模式将不同功能模块化
- **适配器模式**: 支持多种数据库，可轻松扩展新的数据库适配器
- **完整 TypeScript 支持**: 提供完整的类型定义和泛型支持
- **高测试覆盖率**: 95%+ 的测试覆盖率
- **多包管理**: 使用 turbo 进行构建优化

## 常用开发命令

### 构建和发布

```bash
# 构建所有包（排除测试包）
bun run build

# 构建特定包
bun --filter flextree build
bun --filter flextree-sqlite-adapter build
bun --filter flextree-prisma-adapter build

# 发布流程
bun run release  # 构建 + 版本管理 + 发布
bun run changeset  # 创建 changeset
```

### 测试

```bash
# 运行所有测试（使用 Bun Test API）
bun test

# 运行特定包的测试
bun --filter flextree test

# 生成覆盖率报告
bun run coverage
bun --filter flextree coverage
```

### 代码质量

```bash
# 代码检查
bun run lint

# 自动修复
bun run lint:fix
```

### 文档

```bash
# 开发文档
bun run docs:dev

# 构建文档
bun run docs:build

# 预览文档
bun run docs:preview
```

### 示例运行

```bash
# Prisma 示例
cd examples/prisma
bun run db:sync     # 同步数据库
bun run db:generate # 生成 Prisma 客户端
bun run dev         # 运行示例
```

## 项目架构

### 包结构

```
packages/
├── core/                    # 核心库 (flextree)
│   ├── src/
│   │   ├── manager.ts      # FlexTreeManager 主类
│   │   ├── adapter.ts      # 适配器接口定义
│   │   ├── types.ts        # TypeScript 类型定义
│   │   ├── node.ts         # 节点相关
│   │   ├── tree.ts         # 树相关
│   │   ├── mixins/         # Mixin 功能模块
│   │   │   ├── add.mixin.ts      # 添加节点
│   │   │   ├── delete.mixin.ts   # 删除节点
│   │   │   ├── find.mixin.ts     # 查找节点
│   │   │   ├── move.mixin.ts     # 移动节点
│   │   │   ├── get.mixin.ts      # 获取节点
│   │   │   ├── update.mixin.ts   # 更新节点
│   │   │   ├── relation.mixin.ts # 节点关系
│   │   │   ├── root.mixin.ts     # 根节点操作
│   │   │   ├── is.mixin.ts       # 节点判断
│   │   │   ├── sql.mixin.ts      # SQL 生成
│   │   │   └── verify.mixin.ts   # 树验证
│   │   ├── utils/         # 工具函数
│   │   ├── errors.ts      # 错误定义
│   │   └── consts.ts      # 常量定义
│   └── package.json
├── sqlite/                 # SQLite 适配器 (flextree-sqlite-adapter)
├── prisma/                 # Prisma 适配器 (flextree-prisma-adapter)
└── tests/                  # 单元测试包 (flextree-unit-tests)
examples/
└── prisma/                 # Prisma 使用示例
```

### 核心架构模式

#### 1. Mixin 模式

FlexTreeManager 使用 Mixin 模式将功能模块化，每个 Mixin 负责特定的树操作：

- **AddNodeMixin**: 节点添加逻辑，支持批量添加和不同位置插入
- **DeleteNodeMixin**: 节点删除逻辑，包括子树删除
- **MoveNodeMixin**: 节点移动逻辑，支持多种相对位置移动
- **GetNodeMixin**: 节点查询，包括父子关系、兄弟节点等
- **FindNodeMixin**: 节点搜索和过滤
- **UpdateNodeMixin**: 节点更新
- **RelationMixin**: 节点关系判断
- **SqlMixin**: SQL 语句生成
- **VerifyTreeMixin**: 树结构完整性验证

这种设计使得：
- 功能模块化，便于维护
- 支持功能组合和扩展
- 降低单一类的复杂度

#### 2. 适配器模式

通过 `IFlexTreeAdapter` 接口定义数据库访问标准：

```typescript
interface IFlexTreeAdapter {
    ready: boolean
    bind: (treeManager: FlexTreeManager) => void
    exec: (sqls: string | string[]) => Promise<void>
    getRows: (sql: string) => Promise<any[]>
    getScalar: <T>(sql: string) => Promise<T>
    open: (config?: any) => Promise<any>
    db: any
}
```

当前支持的适配器：
- **flextree-sqlite-adapter**: 基于 better-sqlite3
- **flextree-prisma-adapter**: 基于 Prisma ORM

扩展新数据库只需实现该接口即可。

#### 3. 泛型类型系统

核心类型支持完全自定义：

```typescript
FlexTreeManager<
    Fields,      // 自定义字段
    KeyFields,   // 关键字段映射
    TreeNode,    // 节点类型
    NodeId,      // 节点 ID 类型
    TreeId       // 树 ID 类型
>
```

支持：
- 自定义字段名（id、name、leftValue、rightValue、level）
- 自定义字段类型
- 单表多树支持（通过 treeId）

### 数据库表结构要求

使用 FlexTree 需要数据库表包含以下必需字段：

```sql
CREATE TABLE table_name (
    id INTEGER PRIMARY KEY,          -- 主键
    treeId INTEGER,                 -- 树ID（可选，用于单表多树）
    name VARCHAR,                   -- 节点名称
    level INTEGER,                  -- 层级
    leftValue INTEGER,              -- 左值
    rightValue INTEGER              -- 右值
);
```

可以根据需要添加其他自定义字段。

## 开发指南

### 添加新功能

1. **创建新 Mixin**: 在 `packages/core/src/mixins/` 中创建新的 mixin 文件
2. **遵循现有模式**: 参考现有 mixin 的结构，使用泛型类型
3. **添加到 Manager**: 在 `manager.ts` 中导入并混入新 mixin
4. **导出 API**: 在 `index.ts` 中导出需要公开的类型和函数

### 扩展数据库支持

1. **创建适配器包**: 在 `packages/` 下创建新目录
2. **实现 IFlexTreeAdapter**: 完整实现适配器接口
3. **添加测试**: 创建完整的测试用例
4. **添加示例**: 在 `examples/` 中提供使用示例

### 测试注意事项

- **避免并发**: 测试涉及数据库操作，所有测试必须串行执行
- **清理状态**: 每个测试后确保数据库状态清理
- **使用 Bun Test API**: 测试文件使用 Bun 内置的测试框架编写
- **使用测试包**: 单元测试放在 `packages/tests/` 中

### 发布流程

1. **创建 Changeset**: `bun run changeset` 选择要发布的包和版本变更类型
2. **版本管理**: `bun run changeset version` 自动更新版本号
3. **构建**: `bun run build` 确保所有包构建成功
4. **发布**: `bun run changeset publish` 发布到 npm

### 类型系统要点

- 使用 `IFlexTreeNodeFields<Fields, KeyFields>` 表示节点类型
- 使用 `CustomTreeKeyFields` 自定义字段映射
- 使用 `FlexNodeRelPosition` 枚举表示节点相对位置
- 使用 `FlexTreeNodeRelation` 枚举表示节点关系

### 常见任务模式

**添加节点到指定位置**:
```typescript
await manager.addNodes([...nodes], parentNode, FlexNodeRelPosition.LastChild)
```

**移动节点**:
```typescript
await manager.move(sourceNode, targetNode, FlexNodeRelPosition.FirstChild)
```

**查询节点关系**:
```typescript
await manager.getDescendants(node)        // 所有后代
await manager.getAncestors(node)          // 所有祖先
await manager.getChildren(node)           // 直接子节点
await manager.getSiblings(node)           // 兄弟节点
```

## 重要约束

1. **测试必须串行**: 由于涉及数据库操作，所有测试必须禁用并发
2. **类型安全**: 严格遵循 TypeScript 类型系统，确保类型安全
3. **向后兼容**: 修改公共 API 时需要考虑向后兼容性
4. **文档同步**: API 变更需要同步更新文档
5. **测试覆盖**: 新功能必须有对应的测试用例

## 技术栈

- **构建工具**: tsup (打包), turbo (任务编排)
- **测试框架**: Bun Test API (Bun 内置测试框架)
- **代码检查**: oxlint
- **文档**: vitepress
- **类型系统**: TypeScript 5.8+
- **包管理**: Bun 1.3.14
- **发布管理**: changesets
- **关键依赖**: flex-tools, mitt (事件), ts-mixer (mixin 支持), sqlstring (SQL 转义)
