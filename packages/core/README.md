# FlexTree

[![NPM Version](https://img.shields.io/npm/v/flextree.svg)](https://www.npmjs.com/package/flextree)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-blue)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/Coverage-95%25%2B-brightgreen)](https://github.com/zhangfisher/flextree)

FlexTree is a powerful tree structure storage and management library based on the **Nested Set Model** (Left-Right Value Algorithm). It provides efficient tree operations, supports multiple databases, and is built with TypeScript for complete type safety.

## 🌟 Features

### Core Capabilities
- **🚀 High Performance**: Based on Nested Set Model for efficient tree queries and operations
- **💪 Database Agnostic**: Support for SQLite, MySQL, PostgreSQL, Oracle, SQL Server
- **🔷 TypeScript-First**: Complete type definitions and generic support for type safety
- **🔄 Transaction Support**: Built-in transaction management for data integrity
- **🎯 Singleton Pattern**: Optional singleton mode for optimized resource usage
- **🛡️ Concurrent Safety**: AsyncLocalStorage-based context isolation prevents dirty reads

### Advanced Features
- **🗑️ Recycle Bin**: Logical deletion with restore capability via `recyclebin` configuration
- **📋 Node Copying**: Copy nodes with optional descendants and field filtering
- **🌲 Cross-Tree Operations**: Move nodes between different trees seamlessly
- **👥 Multi-Root Trees**: Support for trees with multiple top-level nodes
- **🔍 Tree Traversal**: DFS/BFS traversal with interruption support
- **🔧 Tree Repair**: Automatic repair of corrupted tree structures
- **📊 Node Events**: Event system for node lifecycle monitoring
- **📤 Export Options**: Export to JSON (nested) or flat list formats

### Developer Experience
- **✅ 95%+ Test Coverage**: Comprehensive test suite ensures reliability
- **📝 Extensive Documentation**: Detailed guides and API documentation
- **🔌 Flexible Adapters**: Easy database adapter integration
- **🎨 Mixin Architecture**: Modular design for extensibility

## 📦 Installation

```bash
# Core package
npm install flextree

# SQLite adapter
npm install flextree-sqlite-adapter

# Prisma adapter
npm install flextree-prisma-adapter

# Bun SQLite adapter
npm install flextree-bun-sqlite-adapter

# SQL.js adapter (browser support)
npm install flextree-sqljs-adapter
```

## 🚀 Quick Start

### 1. Database Setup

Create a table with the required fields:

```sql
CREATE TABLE your_table (
    id INTEGER PRIMARY KEY,
    name VARCHAR,
    level INTEGER,
    leftValue INTEGER,
    rightValue INTEGER
);
```

### 2. Initialize FlexTreeManager

```typescript
import { FlexTreeManager } from 'flextree';
import SqliteAdapter from 'flextree-sqlite-adapter';

const adapter = new SqliteAdapter('database.db');
await adapter.open();

const manager = new FlexTreeManager('your_table', {
    adapter: adapter
});
```

### 3. Create and Manipulate Trees

```typescript
// Create root node
await manager.createRoot({ name: 'Root' });

// Add child nodes
await manager.addNodes([
    { name: 'Child 1' },
    { name: 'Child 2' }
]);

// Query nodes
const root = await manager.getRoot();
const children = await manager.getChildren(root);

// Move nodes
await manager.move(childNode, parentNode);

// Delete nodes
await manager.deleteNode(node);
```

## 📚 Documentation

For comprehensive guides, API references, and advanced usage, visit our documentation site:

- **📖 [Documentation Site](https://zhangfisher.github.io/flextree/)**
- **🌏 [中文文档](https://zhangfisher.github.io/flextree/guide/)**

### Key Documentation Sections
- [Getting Started Guide](https://zhangfisher.github.io/flextree/guide/)
- [Manager API Reference](https://zhangfisher.github.io/flextree/guide/manager.html)
- [Node Operations](https://zhangfisher.github.io/flextree/guide/crud.html)
- [Tree Query Methods](https://zhangfisher.github.io/flextree/guide/query.html)
- [Recycle Bin Feature](https://zhangfisher.github.io/flextree/guide/recycle.html)
- [Cross-Tree Operations](https://zhangfisher.github.io/flextree/guide/cross-tree.html)

## 🔧 Advanced Usage

### Singleton Pattern

```typescript
// Get singleton instance
const manager = FlexTreeManager.getInstance('table_name', options);

// Clear singleton cache
FlexTreeManager.clearInstance('table_name');
```

### Recycle Bin

```typescript
// Soft delete with recycle bin
await manager.deleteNode(node, { recycle: true });

// Clear recycle bin
await manager.clearRecycleBin();
```

### Tree Export

```typescript
// Export to nested JSON
const jsonTree = await manager.toJson();

// Export to flat list
const flatList = await manager.toList();
```

### Event System

```typescript
manager.on('node:added', (node) => {
    console.log('Node added:', node);
});

manager.on('node:moved', (node) => {
    console.log('Node moved:', node);
});
```

## 🧪 Testing

```bash
# Run all tests
bun test

# Generate coverage report
bun run coverage

# Run specific package tests
bun --filter flextree test
```

## 📄 License

[MIT](../../LICENSE) © wxzhang

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🔗 Related Projects

- [flextree-rest](../rest/) - RESTful API provider for FlexTree
- [flextree-sqlite-adapter](../sqlite/) - SQLite database adapter
- [flextree-prisma-adapter](../prisma/) - Prisma ORM adapter
- [flextree-bun-sqlite-adapter](../bun-sqlite/) - Bun SQLite adapter
- [flextree-sqljs-adapter](../sqljs/) - SQL.js browser adapter

## 📞 Support

For issues, questions, or contributions, please visit our [GitHub repository](https://github.com/zhangfisher/flextree).
