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
        detach?: boolean
    }
): Promise<void> {

```

- **参数**

| 参数 | 类型 | 默认 | 描述 |
| --- | --- | --- | --- |
| `nodeId` | NodeId \| TreeNode| 无 | 节点`id`或节点对象 |
| `options` |  | 无 | 可选的，配置选项 |
| `options.detach` | boolean | false | 可选的，是否假删除（脱离） |

- **说明**

**`detach`**

默认情况下，删除节点会删除节点以及其后代节点。
如果设置为`true`，则仅将目标子树从树结构中脱离（假删除）：其`leftValue`和`rightValue`会被设置为`负值`，并回缩右侧节点的左右值，但记录本身保留。
该模式供`moveNode`内部复用（源节点先脱离原位置，再由移动 SQL 重新挂载到目标位置），普通删除无需设置。


## 清空树

`clear`方法用来清空树的所有节点。

```ts
async clear(): Promise<void> {
```

