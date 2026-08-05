# Tree Manager

The core class of `FlexTree` is `FlexTreeManager`, which is responsible for creating, modifying, and deleting trees. `FlexTreeManager` provides a series of methods to operate on trees, including creating trees, adding nodes, deleting nodes, and retrieving nodes.

## Creating a Manager

There are two ways to instantiate `FlexTreeManager`:

- Normal mode: create an instance via `new FlexTreeManager`
- Singleton mode: via the static method `FlexTreeManager.getInstance` (recommended)

### Normal Mode

```ts
import { FlexTreeManager } from "felxtree";
import sqltieAdapter from "felxtree-sqltie-adapter";

const tree = new FlexTreeManager("tree", {
  adapter: new sqltieAdapter(),
});
```

Creating a `FlexTreeManager` object requires at least two parameters:

- `tableName`: the database table name, i.e. which table the tree is stored in.
- `adapter`: the adapter used to access the database. `FlexTree` provides adapters such as `sqlite` and `prisma`.

The constructor signature of `FlexTreeManager` is as follows:

```ts {3,4}
class FlexTreeManager {
  constructor(tableName: string, options?: FlexTreeManagerOptions<KeyFields["treeId"]>);
}
```

**Constructor parameters:**

| Parameter           | Type                   | Default | Description                                        |
| ------------------- | ---------------------- | ------- | -------------------------------------------------- |
| `tableName`         | string                 | None    | Required. The database table name                  |
| `options`           | FlexTreeManagerOptions | {}      | Optional. Configuration options                    |
| `options.treeId`    | string                 | None    | Optional. Specified when using a multi-tree table  |
| `options.adapter`   | IFlexTreeAdapter       | None    | Required. The adapter used to access the database  |
| `options.keyFields` | KeyFields              |         | Optional. Custom key field names for tree nodes    |

`FlexTreeManager` supports two generic parameters:

```ts
export class FlexTreeManager<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields
>
```

- `Fields`

By default, a tree has key fields such as `id`, `name`, `leftValue`, `rightValue`, and `treeId`. So when you operate on a tree through the `treeManager` instance, you can use these fields directly with type hints.

However, in real-world scenarios, each tree node may declare additional fields beyond these key fields. You can specify them via the `Fields` generic parameter so that you get the corresponding type hints.

```ts {4-6,12-14}
import { FlexTreeManager } from "felxtree"

const tree = new FlexTreeManager<{
    size:number,
    color:string
    icon:string
}>("tree",{ ...})

const node = await tree.getNode(1)

// node has type hints
node.size // number
node.color // string
node.icon // string


```

- `KeyFields`

By default, a tree has key fields such as `id`, `name`, `leftValue`, `rightValue`, and `treeId`. If you need to customize these key field names, you can specify them via the `KeyFields` generic parameter.

```ts
const tree = new FlexTreeManager<
  {
    size: number;
  },
  {
    id: ["pk", number];
    treeId: ["tree", number];
    name: "title";
    leftValue: "lft";
    rightValue: "rgt";
  }
>("org", {
  adapter: new PrismaAdapter(prisma),
  fields: {
    id: "pk",
    treeId: "tree",
    name: "title",
    leftValue: "lft",
    rightValue: "rgt",
  },
});
```

- You can specify only a subset of the key field names; unspecified field names will use their default values.
- The type of the `KeyFields` generic parameter is `CustomTreeKeyFields`, with a default value of `DefaultTreeKeyFields`.

### Singleton Mode 🎯

:::warning Important
Because trees based on the `Nested Set Model` strictly depend on left/right values, **concurrent writes and direct SQL modifications to the table are absolutely prohibited**.
Therefore, it is strongly recommended that there be only one `FlexTreeManager` instance per tree table in the entire application.
:::

`FlexTreeManager` allows creating table-level singletons, meaning trees with the same table name use the singleton pattern to obtain the `FlexTreeManager` instance, instead of creating one directly with `new FlexTreeManager`.

```ts
import { FlexTreeManager } from "flextree"

const manager1 = FlexTreeManager.getInstance("filesys",{....})
const manager2 = FlexTreeManager.getInstance("filesys",{....})
const manager3 = FlexTreeManager.getInstance("a",{....})
const manager4 = FlexTreeManager.getInstance("a",{....})

// manager1===manager2
// manager3===manager4
```

- `getInstance` always returns the same instance based on `tableName`; the same table name will not be created twice.
- When a singleton is no longer needed (for example, for test isolation), you can clear it with `clearInstance`:

```ts
// Clear the singleton for the specified table name
FlexTreeManager.clearInstance("filesys")
// Passing no value clears all singletons
FlexTreeManager.clearInstance()
```

## Events

`FlexTreeManager` provides an event mechanism based on [`mitt`](https://github.com/developit/mitt). You can subscribe to, remove, and trigger events via `on`/`off`/`emit`.

In addition to `beforeWrite` and `afterWrite` triggered before and after write operations, a series of node-level events have been added so that the business layer can perceive structural changes to the tree.

| Event           | When triggered                | Payload                  |
| --------------- | ----------------------------- | ------------------------ |
| `beforeWrite`   | Before a write operation      | None                     |
| `afterWrite`    | After a write operation       | None                     |
| `node:added`    | After nodes are added         | `{ tree, nodes, at, pos }` |
| `node:deleted`  | After a node is deleted       | `{ tree, node }`         |
| `node:cleared`  | After the tree is cleared     | `{ tree }`               |
| `node:updated`  | After a node is updated       | `{ tree, node }`         |
| `node:moved`    | After a node is moved         | `{ tree, from, to, pos }`|

- **Example**

```ts
import { FlexTreeManager } from "flextree"

const tree = FlexTreeManager.getInstance("tree", { adapter })

// Listen for node added event
tree.on("node:added", ({ nodes }) => {
    console.log(`Added ${nodes.length} nodes`)
})

// Listen for node deleted event
tree.on("node:deleted", ({ node }) => {
    console.log(`Deleted node ${node.name}`)
})

// Remove listener
const handler = ({ node }) => console.log("updated:", node.name)
tree.on("node:updated", handler)
tree.off("node:updated", handler)
```
