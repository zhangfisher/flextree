# Verifying the Tree

`FlexTree` is a tree structure based on the Left-Right Value algorithm. Its **tree structural integrity strictly depends on the correctness of the `leftValue` and `rightValue` values of every node in the database**.

However, if some abnormal or incorrect operations cause the `leftValue` and `rightValue` values of the tree structure to become incorrect, the tree structure will be corrupted.

`FlexTreeManager` provides a `verify` method to check the integrity of the tree structure.

```ts
import type { FlexTreeOptions, IFlexTreeNode } from 'flextree'
import { FlexTreeManager,FlexTree, FlexTreeVerifyError } from 'flextree'

import SqliteAdapter from 'flextree-sqlite-adapter' 
const sqliteDriver = new SqliteAdapter()
await sqliteDriver.open()

const tree = new FlexTree('tree', {
    adapter: sqliteDriver,
})
await tree.load()
 // Verify whether the tree structure is correct
tree.verify() // true/false     // [!code ++]
 
```


- **Notes**

    - The `verify` method checks the integrity of the tree structure. It returns `true` if the tree structure is intact, otherwise it returns `false`.
    - If the tree structure is not intact, a `FlexTreeVerifyError` exception will be thrown, containing the information of the nodes that failed verification.
    - The `verify` method does not repair the tree structure; it only checks the integrity of the tree structure.
- **Verification Mechanism**

    `verify` is implemented with pure `SQL`, with no need to load all nodes into memory, making it suitable for verifying large-scale trees. It performs the following checks in sequence. If any check fails, a `FlexTreeVerifyError` is thrown:

| Check item | Description |
| --- | --- |
| Total node count | The root node's `rightValue / 2` should equal the actual total number of nodes in the tree |
| Value integrity | The union of all `leftValue`/`rightValue` is exactly `{1, 2, ..., 2n}`, with no missing values |
| Basic relationship | Every node's `rightValue` must be greater than its `leftValue` |
| Uniqueness | `leftValue` and `rightValue` each have no duplicate values |
| Level relationship | The root node's `level` is `0`, and the `level` difference between any parent and child node must be `1` |

:::tip Note
If `verify` fails, it means the tree structure has been corrupted. You can use the [repair](./repair.md) feature to rebuild the tree structure.
:::
