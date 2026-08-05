# 更新操作

基于`左右值`算法结构而言，查询是比较高效的，但是更新是比较低效的。任何树的`添加`、`删除`、`移动`节点，均需要更新相关联的节点的左右值。
 

更新树本质上就是需要更新数据库中的相关节点记录，这个过程可能会涉及到多次的数据库操作，比如我们要删除一个节点,则需要以下的数据库操作：

```sql
DELETE FROM tree WHERE leftValue>=2 AND rightValue<=13
UPDATE tree SET leftValue = leftValue - (13 - 2 + 1) WHERE leftValue>2
UPDATE tree SET rightValue = rightValue - (13 - 2 + 1)  WHERE rightValue>13
```

**此操作可能影响更新数据库表的`1-N`行记录**，如果在删除节点的过程中，有其他的操作也在进行，可能会导致数据并发冲突问题。

为了避免**数据并发冲突**问题，我们可以通过`事务`来保证操作的原子性，并且确保所有更新操作不能并发执行，因此：

- 必须在一个数据库事务执行更新操作
- 更新锁必须是`表级排他锁`


**在`API`层面，我们提供了一个`write`方法，用于执行更新操作，所有更新操作都需要放在其内部执行**


```ts {4-9}
import { FlexTreeManager } from 'flextree';
const tree = new FlexTreeManager("tree",{...})

await tree.write(async ()=>{
    // 在此执行所有树的更新操作
    tree.deleteNode()
    tree.addNodes()
    tree.moveNode()
})
```

### 事务与并发安全

`write`从多个层面保障树操作的数据安全：

**1. 事务化写入**

`write`内部的整个回调会被适配器的`transaction`方法包裹，同一次`write`中执行的所有数据库操作（无论调用多少次`addNodes`/`moveNode`/`deleteNode`等）都共享同一个数据库事务——任一步失败都会**整体回滚**，不会残留半成品树结构。

**2. 并发脏读修复**

基于左右值算法的树，在写入过程中会短暂地破坏左右值。如果此时存在并发读取（如`getAncestors`、`getChildren`），可能会读到错误的中间态。

为此，引入了基于`AsyncLocalStorage`的写事务上下文隔离与读守卫：

- **写调用链内的读**（即在`write`回调内部触发的查询）：直接放行，读取的是同一事务内的最新状态；
- **外部的并发读**：会自动等待当前的`write`事务完成后才执行，从而避免读到中间态。

:::tip 提示
得益于这一机制，应用层在并发读写时无需额外加锁——同一棵树的并发读不必担心读到写操作的中间结果。当然，并发的`write`仍然不被允许（会抛出异常），因为基于左右值的树不支持并发写。
:::

### 更新节点

`update`方法用来更新树的节点，支持更新一个或多个节点。

```ts
async updateNode(node: Partial<TreeNode> | Partial<TreeNode>[]): Promise<TreeNode>
```


