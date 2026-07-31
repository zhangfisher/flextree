# FlexTree 移动节点示例

这个示例演示如何使用 FlexTreeManager 和 flextree-bun-sqlite-adapter 进行节点移动操作。

## 特点

- ✅ 使用真实 SQLite 数据库文件（非内存数据库）
- ✅ 完整的树结构初始化演示
- ✅ 详细的节点移动操作说明
- ✅ 移动前后的树结构对比
- ✅ 树结构完整性验证

## 示例结构

该示例创建以下树结构：

```
Root
├─ A
│  ├─ A1
│  ├─ A2
│  ├─ A3
│  ├─ A4
│  └─ A5
├─ B
│  ├─ B1
│  ├─ B2
│  ├─ B3
│  ├─ B4
│  └─ B5
├─ C
│  ├─ C1
│  ├─ C2
│  ├─ C3
│  ├─ C4
│  └─ C5
└─ D
   ├─ D1
   ├─ D2
   ├─ D3
   ├─ D4
   └─ D5
```

## 移动操作演示

示例演示将节点 **A1** 移动到 **A3** 的 `NextSibling` 位置：

**移动前**: A1, A2, A3, A4, A5  
**移动后**: A3, A4, A1, A2, A5  

说明：`NextSibling` 表示将源节点移动到目标节点的下一个兄弟节点位置。在这个例子中，A1 被移动到 A3 的后面，所以 A3 及其后续节点（A4）的相对位置保持不变，然后 A1 被插入到它们之后。

## 运行方式

### 方式 1: 使用运行脚本（推荐）

**Windows:**
```bash
run-move-example.bat
```

**Linux/Mac:**
```bash
chmod +x run-move-example.sh
./run-move-example.sh
```

### 方式 2: 直接运行

```bash
bun run move-nodes-example.ts
```

## 运行要求

- [Bun](https://bun.sh/) 运行时 (1.3.14+)
- Node.js 包依赖（会自动安装）

## 输出说明

运行示例后，您会看到：

1. **初始化过程**: 显示树结构创建过程
2. **初始树结构**: 显示完整的树结构
3. **移动操作详情**: 
   - 源节点和目标节点信息
   - 移动前的 A 节点子节点列表
   - 移动执行状态
   - 移动后的 A 节点子节点列表
4. **完整树结构**: 移动后的完整树结构
5. **树结构验证**: 验证移动操作的正确性

## 数据库文件

示例运行后会生成 `tree_example.db` SQLite 数据库文件，包含：

- `tree_table`: 存储树结构数据的表

您可以使用 SQLite 客户端工具查看数据库内容：

### 命令行查看
```bash
sqlite3 tree_example.db
```

```sql
-- 查看所有节点
SELECT id, name, level, leftValue, rightValue FROM tree_table ORDER BY leftValue;

-- 查看特定节点的子节点
SELECT * FROM tree_table WHERE name = 'A1';

-- 查看树结构统计
SELECT level, COUNT(*) as count FROM tree_table GROUP BY level ORDER BY level;
```

### GUI 工具
- [DB Browser for SQLite](https://sqlitebrowser.org/) (推荐)
- [SQLite Browser](https://github.com/sqlitebrowser/sqlitebrowser)
- DBeaver
- DataGrip

## 代码结构

示例代码包含以下主要函数：

### `createDatabase(dbPath: string)`
创建真实数据库文件并初始化表结构。

### `initializeTreeData(manager: FlexTreeManager)`
初始化树结构数据，创建根节点和所有子节点。

### `displayTreeStructure(manager: FlexTreeManager)`
显示当前树结构的可视化展示。

### `demonstrateMoveOperation(manager: FlexTreeManager)`
演示节点移动操作的核心函数。

### `verifyTreeIntegrity(manager: FlexTreeManager)`
验证树结构的完整性，确保移动操作正确。

## 核心概念

### FlexNodeRelPosition 枚举

支持四种相对位置：

- `LastChild`: 作为目标节点的最后一个子节点
- `FirstChild`: 作为目标节点的第一个子节点  
- `NextSibling`: 作为目标节点的下一个兄弟节点
- `PreviousSibling`: 作为目标节点的上一个兄弟节点

### 移动操作原理

基于 Nested Set Model（左右值算法），移动操作包括：

1. 将源节点标记为负数（脱离原位置）
2. 调整其他节点填补空隙
3. 调整目标位置为新节点腾出空间
4. 将源节点重新定位到新位置

## 技术细节

### 使用适配器

```typescript
const adapter = new BunSqliteAdapter(db); // 传入真实数据库连接
const manager = new FlexTreeManager("tree_table", { adapter });
```

### 写操作

所有修改树结构的操作必须在 `write()` 方法中执行：

```typescript
await manager.write(async (tree) => {
  await tree.moveNode(sourceId, targetId, FlexNodeRelPosition.NextSibling);
});
```

### 树结构验证

```typescript
const isValid = await manager.verifyTree();
if (isValid.success) {
  console.log("✅ 树结构正确");
}
```

## 扩展练习

您可以在示例基础上尝试：

1. 将 B3 移动到 C2 的 PreviousSibling 位置
2. 将整个 D 子树移动到 A 的第一个子节点位置
3. 批量移动多个节点
4. 自定义节点字段（如添加 `description`、`createdAt` 等字段）

## 故障排除

### 常见问题

**Q: 提示找不到 `bun` 命令？**
A: 请先安装 Bun 运行时：`curl -fsSL https://bun.sh/install | bash`

**Q: 数据库文件无法删除？**
A: 请确保没有其他程序正在访问该数据库文件。

**Q: 移动操作失败？**
A: 检查节点 ID 是否正确，确保目标节点不是源节点的后代节点。

## 相关资源

- [FlexTree 文档](https://zhangfisher.github.io/flextree/)
- [Nested Set Model 详解](https://en.wikipedia.org/wiki/Nested_set_model)
- [Bun SQLite 文档](https://bun.sh/docs/api/sqlite)
