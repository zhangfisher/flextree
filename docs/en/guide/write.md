# Update Operations

For a structure based on the `left-right value` algorithm, querying is relatively efficient, but updating is relatively inefficient. Any `add`, `delete`, or `move` operation on a tree requires updating the left/right values of the related nodes.
 

Updating a tree essentially means updating the related node records in the database. This process may involve multiple database operations. For example, to delete a node, the following database operations are required:

```sql
DELETE FROM tree WHERE leftValue>=2 AND rightValue<=13
UPDATE tree SET leftValue = leftValue - (13 - 2 + 1) WHERE leftValue>2
UPDATE tree SET rightValue = rightValue - (13 - 2 + 1)  WHERE rightValue>13
```

**This operation may affect `1-N` rows of records in the database table.** If other operations are also in progress while the node is being deleted, data concurrency conflicts may occur.

To avoid **data concurrency conflicts**, we can use a `transaction` to guarantee the atomicity of operations and ensure that all update operations cannot be executed concurrently. Therefore:

- Update operations must be executed within a database transaction
- The update lock must be a `table-level exclusive lock`


**At the `API` level, we provide a `write` method to execute update operations. All update operations must be placed inside it.**


```ts {4-9}
import { FlexTreeManager } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    // Execute all tree update operations here
    tree.deleteNode()
    tree.addNodes()
    tree.moveNode()
})
```

### Transactions and Concurrency Safety

`write` ensures the data safety of tree operations on multiple levels:

**1. Transactional Writes**

The entire callback inside `write` is wrapped by the adapter's `transaction` method. All database operations executed within the same `write` (no matter how many times `addNodes`/`moveNode`/`deleteNode` etc. are called) share the same database transaction — any step failing will **roll back the entire operation**, leaving no half-finished tree structure behind.

**2. Concurrent Dirty-Read Repair**

Trees based on the left-right value algorithm briefly corrupt the left/right values during writing. If concurrent reads (such as `getAncestors`, `getChildren`) occur at this moment, they may read an incorrect intermediate state.

To address this, write-transaction context isolation and a read guard based on `AsyncLocalStorage` are introduced:

- **Reads within the write call chain** (i.e. queries triggered inside the `write` callback): pass through directly, reading the latest state within the same transaction;
- **External concurrent reads**: automatically wait for the current `write` transaction to complete before executing, thereby avoiding reading intermediate states.

:::tip Note
Thanks to this mechanism, the application layer does not need additional locking during concurrent reads and writes — concurrent reads of the same tree do not have to worry about reading intermediate results of a write operation. Of course, concurrent `write`s are still not allowed (an exception will be thrown), because trees based on left-right values do not support concurrent writes.
:::

### Updating Nodes

The `update` method is used to update tree nodes and supports updating one or more nodes.

```ts
async updateNode(node: Partial<TreeNode> | Partial<TreeNode>[]): Promise<TreeNode>
```
