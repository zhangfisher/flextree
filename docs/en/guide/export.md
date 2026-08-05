# Export

`FlexTreeManager` and `FlexTree` support exporting the tree to `Json` and `List` formats.

The following uses the tree below to illustrate how to export a tree.

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

`FlexTreeManager`, `FlexTree`, and `FlexTreeNode` all support the `toJson` method, which exports the tree to `Json` format.

```ts
toJson(
    options?: FlexTreeExportJsonOptions<Fields, KeyFields>
): FlexTreeExportJsonFormat<Fields, KeyFields>

interface FlexTreeExportJsonOptions<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> {
    childrenField?: string
    level?: number // Limit the level to export
    fields?: (keyof IFlexTreeNode<Fields, KeyFields>)[]
    includeKeyFields?: boolean
}


```

- **Parameters**

| Parameter                  | Type                                         | Default      | Description                 |
| -------------------------- | -------------------------------------------- | ------------ | --------------------------- |
| `options`                  | `FlexTreeExportJsonOptions`                  | None         | Export options              |
| `options.childrenField`    | `string`                                     | `'children'` | Child field name            |
| `options.level`            | `number`                                     | None         | Limit the level to export   |
| `options.fields`           | `(keyof IFlexTreeNode<Fields, KeyFields>)[]` | None         | Fields to export            |
| `options.includeKeyFields` | `boolean`                                    | `false`      | Whether to export key fields |

- **Return**

Returns a `JSON` object whose child field name defaults to `children`; it can be customized via the `options.childrenField` parameter.

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

- **Example**

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

The output is as follows:

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

- **Notes**

  - The `toJson` method exports the tree to `Json` format; you can limit the exported level via the `options.level` parameter.
  - The `toJson` method can be called on `FlexTree` and `FlexTreeNode`.
  - You can specify the exported fields via the `options.fields` parameter.
  - By default the `leftValue` and `rightValue` fields are not exported; use `options.includeKeyFields` to specify whether to export key fields.
  - You can specify the child field name via the `options.childrenField` parameter.

## toList

`FlexTreeManager`, `FlexTree`, and `FlexTreeNode` all support the `toList` method, which exports the tree to a `list` node array with a `pid` field.

```ts
toList(
    options?: FlexTreeExportListOptions<Fields, KeyFields>
): FlexTreeExportListFormat<Fields, KeyFields>
interface FlexTreeExportListOptions<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> {
    pidField?: string
    level?: number // Limit the level to export
    fields?: (keyof IFlexTreeNode<Fields, KeyFields>)[]
    includeKeyFields?: boolean
}
```

- **Parameters**

| Parameter                  | Type                                         | Default | Description                 |
| -------------------------- | -------------------------------------------- | ------- | --------------------------- |
| `options`                  | `FlexTreeExportListOptions`                  | None    | Export options              |
| `options.pidField`         | `string`                                     | `'pid'` | Parent field name           |
| `options.level`            | `number`                                     | None    | Limit the level to export   |
| `options.fields`           | `(keyof IFlexTreeNode<Fields, KeyFields>)[]` | None    | Fields to export            |
| `options.includeKeyFields` | `boolean`                                    | `false` | Whether to export key fields |

- **Return**

Returns a `list` node array whose parent field name defaults to `pid`; it can be customized via the `options.pidField` parameter.

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

- **Example**

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

The output is as follows:

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

:::warning Note
Both `toList` and `toJson` support a `level` parameter to limit the exported level. They can be called on `FlexTree` and `FlexTreeNode`.
:::

## getTree

`FlexTreeManager` provides the `getTree` method, which builds an in-memory `FlexTree` object based on the current manager, so that you can use the rich `API` provided by `FlexTree` (such as `getByPath`, `find`, `toJson`, `toList`, etc.).

```ts
getTree(options?: FlexTreeOptions): FlexTree<Fields, KeyFields>
```

- **Example**

```ts
const tree = manager.getTree()
await tree.load()           // FlexTree must be loaded manually before it can be accessed
tree.getByPath('/A/A-1')
```

:::tip Note
`FlexTreeManager` also provides two **async** convenience methods, `toJson` and `toList`, which automatically build and load the tree via `getTree` before exporting:

```ts
await manager.toJson()
await manager.toList()
```

:::
