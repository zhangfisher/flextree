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

### 更新节点

`update`方法用来更新树的节点，支持更新一个或多个节点。

```ts
async updateNode(node: Partial<TreeNode> | Partial<TreeNode>[]): Promise<TreeNode>
```


