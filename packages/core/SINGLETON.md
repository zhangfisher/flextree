# FlexTreeManager 单例模式

## 概述

FlexTreeManager 支持基于 `tableName` 的单例模式。当启用单例模式时，相同表名的请求将返回同一个实例，而不同表名将创建不同的实例。

## 特性

- **基于表名的单例**：相同 `tableName` 共享一个实例
- **可配置**：通过 `singleton` 选项控制是否启用单例模式
- **默认启用**：`singleton` 默认值为 `true`
- **智能检测**：自动识别创建方式并应用相应的单例策略

## 使用方式

### 主要方式：使用静态工厂方法

```typescript
import { FlexTreeManager } from 'flextree';

// 创建单例实例（singleton 默认为 true）
const manager1 = FlexTreeManager.create('users', { adapter });
const manager2 = FlexTreeManager.create('users', { adapter });

console.log(manager1 === manager2); // true - 同一个实例

// 不同表名创建不同实例
const ordersManager = FlexTreeManager.create('orders', { adapter });
console.log(manager1 === ordersManager); // false - 不同实例
```

**为什么推荐使用 `create` 方法？**
- ✅ **真正的单例**：返回完全相同的对象引用
- ✅ **性能优化**：避免重复创建相同配置的实例
- ✅ **内存效率**：相同表名共享内存空间
- ✅ **一致性保证**：确保全局状态一致性

### 禁用单例模式

```typescript
// singleton: false 将始终创建新实例
const manager1 = FlexTreeManager.create('users', { 
  adapter, 
  singleton: false 
});
const manager2 = FlexTreeManager.create('users', { 
  adapter, 
  singleton: false 
});

console.log(manager1 === manager2); // false - 不同实例
```

### 传统构造函数

```typescript
// 直接使用构造函数（不启用单例功能）
const manager1 = new FlexTreeManager('users', { adapter });
const manager2 = new FlexTreeManager('users', { adapter });

console.log(manager1 === manager2); // false - 构造函数始终创建新实例

// 注意：即使设置 singleton: true，直接使用构造函数也不会启用单例模式
const manager3 = new FlexTreeManager('users', { adapter, singleton: true });
const manager4 = new FlexTreeManager('users', { adapter, singleton: true });

console.log(manager3 === manager4); // false - 构造函数不支持单例模式
```

## 静态方法

### `FlexTreeManager.create(tableName, options)`

创建 FlexTreeManager 实例，支持单例模式。

**参数：**
- `tableName`: 表名
- `options`: 配置选项
  - `adapter`: 数据库适配器（必需）
  - `singleton`: 是否启用单例模式（默认: `true`）
  - `treeId`: 树ID（可选）
  - `fields`: 自定义字段映射（可选）

**返回：** FlexTreeManager 实例

### `FlexTreeManager.getInstance(tableName, options)`

获取单例实例，是 `create` 方法的别名。

**参数：** 同 `create` 方法

**返回：** FlexTreeManager 实例

### `FlexTreeManager.clearInstance(tableName)`

清除指定表名的单例实例。

```typescript
FlexTreeManager.clearInstance('users');
```

### `FlexTreeManager.clearAllInstances()`

清除所有单例实例。

```typescript
FlexTreeManager.clearAllInstances();
```

### `FlexTreeManager.instanceCount`

获取当前已注册的单例实例数量。

```typescript
console.log(FlexTreeManager.instanceCount); // 2
```

## 使用场景

### 1. 应用级单例管理

```typescript
// 在应用初始化时创建管理器实例
const userManager = FlexTreeManager.create('users', { adapter });
const roleManager = FlexTreeManager.create('roles', { adapter });

// 在应用的任何地方使用
function someFunction() {
  // 将获取到同一个实例
  const sameUserManager = FlexTreeManager.create('users', { adapter });
  // ...
}
```

### 2. 测试隔离

```typescript
describe('User Management Tests', () => {
  beforeEach(() => {
    // 清除单例，确保测试独立性
    FlexTreeManager.clearAllInstances();
  });

  test('should create user', async () => {
    const manager = FlexTreeManager.create('users', { adapter });
    // ...
  });
});
```

### 3. 多树管理

```typescript
// 管理多个独立的树结构
const tree1 = FlexTreeManager.create('categories', { 
  adapter, 
  treeId: 1 
});

const tree2 = FlexTreeManager.create('categories', { 
  adapter, 
  treeId: 2 
});

// 注意：相同 tableName 和 treeId 会返回同一个实例
const tree1Again = FlexTreeManager.create('categories', { 
  adapter, 
  treeId: 1 
});

console.log(tree1 === tree1Again); // true
```

## 注意事项

1. **线程安全**：单例模式在 JavaScript 单线程环境中是安全的
2. **内存管理**：使用 `clearInstance` 或 `clearAllInstances` 来释放不再需要的单例
3. **适配器共享**：单例实例会共享同一个适配器实例
4. **状态一致性**：单例模式确保同一表名的所有操作都基于同一个状态

## 迁移指南

### 从原有代码迁移

**之前：**
```typescript
const manager = new FlexTreeManager('users', { adapter });
```

**之后（推荐）：**
```typescript
const manager = FlexTreeManager.create('users', { adapter });
```

**向后兼容（不推荐）：**
```typescript
// 构造函数仍然可用，但不支持单例模式
const manager = new FlexTreeManager('users', { adapter });
```

## 性能考虑

单例模式可以：
- 减少对象创建开销
- 共享数据库连接和状态
- 降低内存使用

对于频繁访问相同表名的场景，建议启用单例模式。
