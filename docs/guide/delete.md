# 删除节点

:::warning 提示
删除节点是一个数据写操作，需要在`write`方法中执行。
:::

## 删除节点

`deleteNode`方法用来删除树的节点以及其后代节点。

```ts
async deleteNode(
    nodeId: NodeId | TreeNode,
    options?: {
        recycle?: boolean
        includeRecyclebin?: boolean
    }
): Promise<void>
```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode | 无 | 节点`id`或节点对象 |
| `options.recycle` | boolean | `false` | 逻辑删除：子树移入回收站而非物理删除 |
| `options.includeRecyclebin` | boolean | `false` | `false`（默认）：回收站内的节点视为不存在，删除时抛`NotFound`；`true`：进入回收站视角，可删除站内节点（物理删除）。管理回收站内容时需要设为`true`（见下文[详解](#includerecyclebin-删除站内节点)） |

### 物理删除（默认）

默认删除节点及其全部后代节点，并回缩右侧节点的左右值：

```ts
await tree.write(async () => {
    // A 及其全部后代从表中删除
    await tree.deleteNode(aId);
});
```

### 逻辑删除（回收站）

启用回收站后，`recycle: true` 将目标子树**移入回收站**而非物理删除——结构保持、数据保留，但从逻辑树上消失：

```ts
await tree.write(async () => {
    // A 及其全部后代（保持结构）移入回收站
    await tree.deleteNode(aId, { recycle: true });
});

// 此后默认视角下 A 逻辑不存在：
await tree.findNode({ name: "A" });   // null
await tree.getNode(aId);              // 抛 NotFound
```

**注意：**

- `recycle: true`**仅在启用回收站后生效**；未启用时等同物理删除。
- 回收的是**整个子树**：后代连同层级结构一并进站。
- 删除**回收站节点自身**等效于清空回收站（`clearRecycleBin()`），保留 bin 节点、删除其全部子孙。

完整的回收站特性（启用配置、恢复节点、清空、事件语义）见[回收站](./recyclebin)。

### includeRecyclebin：删除站内节点

节点被逻辑删除（已进入回收站）后，它在逻辑上已经不存在——默认调用`deleteNode`会抛出**节点不存在**（`FlexTreeNodeNotFoundError`）：

```ts
await tree.write(async () => {
    await tree.deleteNode(aId, { recycle: true });   // A 移入回收站
});

await tree.write(async () => {
    await tree.deleteNode(aId);                      // 抛 NotFound —— A 逻辑上已删除
});
```

传入`includeRecyclebin: true`可跳过该判定，进入回收站视角对站内节点执行删除——此时是**物理删除**（`recycle` 参数无效，已在站内的节点再"删除"即彻底移除）：

```ts
await tree.write(async () => {
    // 从回收站中彻底删除 A 及其全部后代
    await tree.deleteNode(aId, { includeRecyclebin: true });
});
```

- 适合"清空回收站中的部分内容"场景（全部清空用`clearRecycleBin()`）
- 站外节点不受影响：`includeRecyclebin: true`对未回收节点照常生效，可与`recycle: true`组合
- 一般而言，**管理回收站内容**（列出、恢复、彻底删除站内节点）都需要`includeRecyclebin: true`——默认视角下站内节点不可见，不进入回收站视角就找不到操作目标

## 清空树

`clear`方法用来清空树的所有节点。

```ts
async clear(): Promise<void>
```
