# 导出

`FlexTreeMnaager`和`FlexTree`支持将树导出为`Json`和`List`格式。

下面以下面的树为例，说明如何导出树。

<LiteTree>
Root
    + A
        A1
        A2
        A3
    + B
        B1
        B2
        B3
    + C
        C1
        C2
        C3
</LiteTree>

## toJson

`FlexTreeManager`、`FlexTree`和`FlexTreeNode`均支持`toJson`方法，用于将树导出为`Json`格式。

```ts
toJson(
    options?: FlexTreeExportJsonOptions<Fields, KeyFields>
): FlexTreeExportJsonFormat<Fields, KeyFields>

interface FlexTreeExportJsonOptions<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> {
    childrenField?: string
    level?: number // 限定导出的级别
    fields?: (keyof IFlexTreeNode<Fields, KeyFields>)[]
    includeKeyFields?: boolean
    countField?: string // 指定后附加后代数量字段
}


```

- **参数**

| 参数                       | 类型                                         | 默认         | 描述             |
| -------------------------- | -------------------------------------------- | ------------ | ---------------- |
| `options`                  | `FlexTreeExportJsonOptions`                  | 无           | 导出选项         |
| `options.childrenField`    | `string`                                     | `'children'` | 子节点字段名     |
| `options.level`            | `number`                                     | 无           | 限定导出的级别   |
| `options.fields`           | `(keyof IFlexTreeNode<Fields, KeyFields>)[]` | 无           | 导出的字段       |
| `options.includeKeyFields` | `boolean`                                    | `false`      | 是否导出关键字段 |
| `options.countField`       | `string`                                     | 无           | 后代数量字段名   |

- **返回**

返回一个`JSON`对象，子节点字段名默认为`children`，可以通过`options.childrenField`参数自定义。

```ts
type FlexTreeExportJsonFormat<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNode<Fields, KeyFields> = IFlexTreeNode<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
> = TreeNode & {
  children?: FlexTreeExportJsonFormat<Fields, KeyFields, TreeNode, NodeId>[];
};
```

- **示例**

```ts
import type { FlexTreeOptions, IFlexTreeNode } from "flextree";
import { FlexTreeManager, FlexTree, FlexTreeVerifyError } from "flextree";

import SqliteAdapter from "flextree-sqlite-adapter";
const sqliteDriver = new SqliteAdapter();
await sqliteDriver.open();

const tree = new FlexTree("tree", {
  adapter: sqliteDriver,
});
await tree.load();

tree.toJson();
```

输出的结果如下：

```json
{
  "id": 1,
  "name": "root",
  "children": [
    {
      "id": 2,
      "name": "A",
      "children": [
        { "id": 3, "name": "A1" },
        { "id": 4, "name": "A2" },
        { "id": 5, "name": "A3" }
      ]
    },
    {
      "id": 6,
      "name": "B",
      "children": [
        { "id": 7, "name": "B1" },
        { "id": 8, "name": "B2" },
        { "id": 9, "name": "B3" }
      ]
    },
    {
      "id": 10,
      "name": "C",
      "children": [
        { "id": 11, "name": "C1" },
        { "id": 12, "name": "C2" },
        { "id": 13, "name": "C3" }
      ]
    }
  ]
}
```

- **说明**

  - `toJson`方法会将树导出为`Json`格式，可以通过`options.level`参数限定导出的级别。
  - `toJson`方法可以在`FlexTree`和`FlexTreeNode`中调用。
  - 可以通过`options.fields`参数指定导出的字段
  - 默认情况下不会导出`leftValue`和`rightValue`字段,可以通过`options.includeKeyFields`参数指定是否导出关键字段
  - 可以通过`options.childrenField`参数指定子节点字段名

### countField 后代数量

指定`options.countField`后，每个节点会附加一个表示**后代节点数量**的字段（叶子节点为`0`）：

```ts
await manager.toJson({ countField: "count" })
// { "id": 1, "name": "root", "count": 12, "children": [
//    { "id": 2, "name": "A", "count": 3, "children": [...] },
//    ...
// ] }
```

- 数量按`(rightValue - leftValue - 1) / 2`计算，恒为**全量后代数**——不受`level`截断影响（`level: 2` 导出时根节点的数量仍包含深层后代）
- `countField`与`id`同地位：指定`fields`过滤时照样附加，不受`includeKeyFields`控制
- 与节点已有字段重名时会抛出`FlexTreeError`
- 启用回收站时为**可见口径**：默认视角下数量不含已被回收的节点（与导出内容一致）；`includeRecyclebin: true`时为物理全集数量

## toList

`FlexTreeManager`、`FlexTree`和`FlexTreeNode`均支持`toList`方法，用于将树导出为带`pid`字段的`list`节点数组格式。

```ts
toList(
    options?: FlexTreeExportListOptions<Fields, KeyFields>
): FlexTreeExportListFormat<Fields, KeyFields>
interface FlexTreeExportListOptions<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> {
    pidField?: string
    level?: number // 限定导出的级别
    fields?: (keyof IFlexTreeNode<Fields, KeyFields>)[]
    includeKeyFields?: boolean
    countField?: string // 指定后附加后代数量字段
}
```

- **参数**

| 参数                       | 类型                                         | 默认    | 描述             |
| -------------------------- | -------------------------------------------- | ------- | ---------------- |
| `options`                  | `FlexTreeExportListOptions`                  | 无      | 导出选项         |
| `options.pidField`         | `string`                                     | `'pid'` | 父节点字段名     |
| `options.level`            | `number`                                     | 无      | 限定导出的级别   |
| `options.fields`           | `(keyof IFlexTreeNode<Fields, KeyFields>)[]` | 无      | 导出的字段       |
| `options.includeKeyFields` | `boolean`                                    | `false` | 是否导出关键字段 |
| `options.countField`       | `string`                                     | 无      | 后代数量字段名   |

- **返回**

返回一个`list`节点数组，父节点字段名默认为`pid`，可以通过`options.pidField`参数自定义。

```ts
export type FlexTreeExportListFormat<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNode<Fields, KeyFields> = IFlexTreeNode<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  OPTIONS extends FlexTreeExportListOptions<Fields, KeyFields> = FlexTreeExportListOptions<
    Fields,
    KeyFields
  >,
> = ((OPTIONS["fields"] extends string[]
  ? Extract<TreeNode, OPTIONS["fields"][number]>
  : TreeNode) & { [P in OPTIONS["pidField"] & string]: NodeId })[];
```

- **示例**

```ts
import type { FlexTreeOptions, IFlexTreeNode } from "flextree";
import { FlexTreeManager, FlexTree, FlexTreeVerifyError } from "flextree";
import SqliteAdapter from "flextree-sqlite-adapter";
const sqliteDriver = new SqliteAdapter();
await sqliteDriver.open();

const tree = new FlexTree("tree", {
  adapter: sqliteDriver,
});
await tree.load();

tree.toList();
```

输出的结果如下：

```json
[
  { "id": 1, "name": "root", "pid": 0 },
  { "id": 2, "name": "A", "pid": 1 },
  { "id": 3, "name": "A1", "pid": 2 },
  { "id": 4, "name": "A2", "pid": 2 },
  { "id": 5, "name": "A3", "pid": 2 },
  { "id": 6, "name": "B", "pid": 1 },
  { "id": 7, "name": "B1", "pid": 6 },
  { "id": 8, "name": "B2", "pid": 6 },
  { "id": 9, "name": "B3", "pid": 6 },
  { "id": 10, "name": "C", "pid": 1 },
  { "id": 11, "name": "C1", "pid": 10 },
  { "id": 12, "name": "C2", "pid": 10 },
  { "id": 13, "name": "C3", "pid": 10 }
]
```

:::warning 提示
`toList`和`toJson`方法均支持`level`参数，用于限定导出的级别。可以在`FlexTree`和`FlexTreeNode`中调用。`countField`的语义见上文[ countField 后代数量](#countfield-后代数量)。
:::

## getTree

`FlexTreeManager`提供了`getTree`方法，用于基于当前管理器构建一个内存中的`FlexTree`对象，从而可以使用`FlexTree`提供的丰富`API`（如`getByPath`、`find`、`toJson`、`toList`等）。

```ts
getTree(options?: FlexTreeOptions): FlexTree<Fields, KeyFields>
```

- **示例**

```ts
const tree = manager.getTree()
await tree.load()           // FlexTree 需手动加载后才能访问
tree.getByPath('/A/A-1')
```

:::tip 提示
`FlexTreeManager`还提供了`toJson`与`toList`两个**异步**便捷方法，内部会自动通过`getTree`构建并加载树后再导出：

```ts
await manager.toJson()
await manager.toList()
```

:::
