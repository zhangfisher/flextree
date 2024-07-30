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
        onlyMark?: boolean, 
        onExecuteBefore?: (sqls: string[]) => boolean }
): Promise<void> {

```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |
| `options` |  | 无 | 可选的，配置选项 |
| `options.onlyMark` | boolean | false | 可选的，是否仅标记删除 |
| `options.onExecuteBefore` | (sqls: string[]) => boolean | 无 | 可选的，执行前回调函数 |

- **说明**

**`onlyMark`**

默认情况下，删除节点会删除节点以及其后代节点。
如果设置为`true`，则仅标记删除节点，不会删除节点以及其后代节点。
所有标记为删除的节点其`leftValue`和`rightValue`值会被设置为`负值`。


**`onExecuteBefore`**

执行前回调函数，用于在执行删除操作前，可以对`sql`进行修改。如果返回`false`，则不执行删除操作。


## 清空树

`clear`方法用来清空树的所有节点。

```ts
async clear(): Promise<void> {
```

