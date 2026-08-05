# 常见问题

## FlexTree 适合什么场景？什么时候不该用？

`FlexTree` 是**查询优先**的存储结构，最适合**读多写少**的树形数据，例如：

- 组织架构、部门层级
- 商品 / 内容分类目录
- 导航菜单
- 评论嵌套楼
- 文件系统目录

因为任何添加、删除、移动操作都需要重排相关节点的左右值（可能影响 `1-N` 行），所以**不适合高频写入、频繁结构调整**的场景——此时传统的邻接列表可能更合适。

详见 [功能优势](./features.md)。

## 为什么 FlexTree 不支持并发写？

`FlexTree` 基于左右值算法，树结构的正确性**严格依赖所有节点左右值的一致性**。如果两个写操作并发执行，彼此会读到对方未提交的中间态，导致左右值错乱、树结构损坏。

因此同一棵树**同一时刻只允许一个写操作**，并发写会被拒绝并抛出异常。读操作虽然可以并发，但写操作进行时，外部的并发读取会自动等待写完成，避免读到中间态。

这是左右值算法的固有约束，并非实现缺陷。

## 可以直接用 SQL 修改树表吗？

**不可以。** 任何绕过 `FlexTree`、直接以 `SQL` 修改树表的操作——尤其是改动 `leftValue`、`rightValue`、`level` 字段——都可能破坏树结构。

正确的做法是始终通过 `FlexTreeManager` 提供的方法（`addNodes`、`deleteNode`、`moveNode` 等）操作树，这些方法会在内部维护左右值的一致性，并包裹在事务中。

如果不慎直接修改了表导致结构损坏，可以使用 [`verify`](../guide/verify.md) 检测、[`repair`](../guide/repair.md) 修复。

## 左右值是什么？查询为什么这么快？

`FlexTree` 采用**嵌套集合模型（Nested Set Model）**，为每个节点分配两个整数字段 `leftValue`（左值）和 `rightValue`（右值）。节点的左右值形成一个区间：**一个节点的所有后代，其左右值都落在该节点的区间内**。

于是，查询后代、祖先、子节点、兄弟等关系，都能转化为对左右值的**范围查询**，单条 `SQL` 即可完成，**无需递归**。树的层级越深，相比邻接列表的递归查询优势越明显。

详见 [工作原理](./principle.md)。

## 树结构被破坏了怎么办？

`FlexTreeManager` 提供了校验与修复能力：

- **[`verify`](../guide/verify.md)**：基于纯 `SQL` 校验树结构的完整性（节点总数、值完整性、层级关系等），无需将所有节点加载到内存，适合大规模树。
- **[`repair`](../guide/repair.md)**：当 `verify` 检测到损坏时，可重建被破坏的左右值与层级。

::: tip 建议
在生产环境中，若怀疑树表被外部程序误改（例如直接 SQL 操作、数据库故障），可定期或在异常后执行 `verify` 做健康检查。
:::

## 如何在一张表里存储多棵树？

`FlexTree` 支持**单表多树**：只需在表中增加一个 `treeId` 字段来区分不同的树，并在创建 `FlexTreeManager` 时通过 `treeId` 选项指定当前管理的是哪一棵树。

```ts
const treeA = new FlexTreeManager('org', {
    adapter,
    treeId: 1,        // 数字 treeId
})

const treeB = new FlexTreeManager('org', {
    adapter,
    treeId: 'dept-x', // 字符串 treeId
})
```

`treeId` 既可以是数字，也可以是字符串。当使用字符串 `treeId` 时，表中对应的 `treeId` 字段类型应为字符串类型（如 `VARCHAR`）。

详见 [多树表](../guide/multitree.md)。

## 为什么推荐用单例模式创建管理器？

由于嵌套集合模型严格依赖左右值，`FlexTree` **禁止并发写和直接 SQL 修改**。如果在应用中为同一个树表创建了多个 `FlexTreeManager` 实例，它们彼此无法感知，容易触发并发写冲突。

因此强烈建议**每个树表在整个应用中只保留一个 `FlexTreeManager` 实例**，通过静态方法 `FlexTreeManager.getInstance(tableName, options)` 获取——相同表名始终返回同一个实例。

```ts
const a = FlexTreeManager.getInstance('filesys', { adapter })
const b = FlexTreeManager.getInstance('filesys', { adapter })
// a === b（同一个实例）
```

详见 [树管理器](../guide/manager.md)。

## 左右值有数量上限吗？超大树能用吗？

`leftValue` 与 `rightValue` 是整数字段，理论上受整型取值范围限制。当单棵树的节点数接近整型上限时，可能触及限制。

但在实际业务中这**极少遇到**——绝大多数树形数据（组织架构、分类、菜单等）的节点规模远低于该上限。如果你的场景属于超大规模树，可结合 `level` 分层或单表多树（`treeId`）进行拆分。

详见 [功能优势](./features.md)。

## 基于 pid 的邻接列表树，为什么查询不友好且不可优化？

邻接列表（Adjacency List）每个节点只存一个 `pid` 指向**直接父节点**，即只记录了"一跳"的父子关系。而树形查询（后代、祖先、子树）需要的是**任意深度的传递关系**——这种关系邻接列表**根本没有存储**，必须在查询时沿 `pid` 链逐层重建，这正是它查询不友好的根源。

**具体表现：**

- **查后代 / 祖先必须递归。** 例如"查出某节点的所有后代"，由于事先不知道树的深度，标准 `SQL` 无法用一条语句表达，只能靠应用层循环或多次自连接。
- **`WITH RECURSIVE` 也救不了。** 递归 CTE 虽能表达任意深度，但本质是逐层迭代，深度为 `N` 就要迭代 `N` 次；且兼容性差（早期 MySQL、旧版 SQLite 不支持），数据库优化器对它的优化也非常有限。

**为什么"不可优化"——这是存储模型决定的，不是工程问题：**

- `pid` 上的索引（B-tree）只能加速**单跳**查找——快速定位"直接子节点"。但**索引无法跨越深度**：每深入一层都要重新走一次索引查找，查 `N` 层后代就是 `N` 次索引访问，无法折叠成一次范围扫描。
- 本质上，邻接列表**没有编码任何全局信息**（深度、路径、区间都没有），所以查询深度关系时必须把这些信息**现场算出来**。无论加多少索引、怎么调优，都绕不开"沿链迭代"这一步。

::: tip 对比 FlexTree
`FlexTree` 用 `leftValue` / `rightValue` 把"祖先—后代关系"**编码进了两个整数的大小关系**：后代的左右值必然落在祖先的区间内。于是查后代退化为一次**范围查询**，可走索引、单条 `SQL` 完成，复杂度 `O(log N + 结果数)`，与树深无关。

两种模型是经典的**写入-查询权衡**：邻接列表写入快（改一个 `pid`）、查询慢；FlexTree 写入慢（需重排左右值）、查询快。FlexTree 正是面向**读多写少**场景而设计。
:::

详见 [工作原理](./principle.md) 中与邻接列表的详细对比。

## FlexTree 如何在不同的数据库访问框架下使用？开发适配器很难吗？

`FlexTree` 通过**适配器模式**把树逻辑与数据库访问彻底解耦：`FlexTreeManager` 只负责生成 `SQL`，**所有数据库交互都交给适配器**（`IFlexTreeAdapter`）。因此无论你用的是原生驱动、ORM 还是查询构建器，只要写一个适配器把它们桥接起来即可。

**开发一个适配器非常简单**——接口只有寥寥几个方法：

```ts
interface IFlexTreeAdapter {
    connected: boolean                                              // 是否已连接
    type?: DatabaseType                                             // 数据库方言类型
    bind: (treeManager: FlexTreeManager) => void
    open: (config?: any) => Promise<any>                            // 初始化连接
    exec: (sqls: string | string[]) => Promise<void>                // 执行写操作（自身不自带事务）
    getRows: (sql: string) => Promise<any[]>                        // 查询多行
    getScalar: <T = number>(sql: string) => Promise<T>              // 查询单个标量
    transaction: (callback: () => Promise<void>) => Promise<void>   // 事务：写操作原子性的承载者
}
```

**为什么简单？** 因为适配器**只负责"执行 SQL"，不负责"生成 SQL"**。`FlexTree` 内置多方言 `SQL` 生成器（支持 `SQLite`、`MySQL`、`PostgreSQL`、`Oracle`、`SQL Server` 等差异），所有左右值计算、转义都已由 `FlexTreeManager` 处理好，适配器拿到的就是一条条可以直接执行的 `SQL`。

唯一需要适配器自己实现的是 **`transaction`**——它承载写操作的原子性：`FlexTreeManager` 的 `write(fn)` 会调用 `transaction`，把 `fn` 内的多个操作包成一个事务，任一失败整体回滚。好在它通常只是 `BEGIN` / `COMMIT` / `ROLLBACK` 的薄封装（注意处理嵌套调用——内层应复用外层事务，不要重复开事务）。

下面是一个接入手写数据库驱动的最小示例：

```ts
// @noErrors
import { FlexTreeManager } from 'flextree'
import type { IFlexTreeAdapter } from 'flextree'

class MyAdapter implements IFlexTreeAdapter {
    connected = false
    db: any
    type = 'sqlite' as const              // 告诉 FlexTree 生成哪种方言的 SQL

    async open() {
        // 初始化你的数据库连接，例如：
        // this.db = await createMyDbConnection()
        this.connected = true
    }

    bind() { /* 通常留空即可 */ }

    async exec(sqls) {
        // 执行写操作（原子性由外层 transaction 保证，exec 自身不自带事务）
        for (const sql of ([] as string[]).concat(sqls)) {
            await this.db.run(sql)
        }
    }

    async getRows(sql) {
        return this.db.all(sql)           // 返回多行
    }

    async getScalar<T>(sql: string): Promise<T> {
        const rows = await this.db.all(sql)
        return Object.values(rows[0])[0] as T   // 返回首行首列
    }

    private _inTx = false
    async transaction(callback: () => Promise<void>) {
        // 用 BEGIN/COMMIT/ROLLBACK 包裹 callback：原子提交，抛错整体回滚
        if (this._inTx) {                 // 嵌套调用：复用外层事务
            await callback()
            return
        }
        this._inTx = true
        await this.db.run('BEGIN')
        try {
            await callback()
            await this.db.run('COMMIT')
        } catch (e) {
            await this.db.run('ROLLBACK')
            throw e
        } finally {
            this._inTx = false
        }
    }
}

// 使用：与其他内置适配器完全一样
const tree = new FlexTreeManager('my_tree', {
    adapter: new MyAdapter(),
})
```

**内置适配器**已覆盖常见场景，可直接使用或作为开发参考：

- `flextree-sqlite-adapter`（基于 better-sqlite3）
- `flextree-prisma-adapter`（基于 Prisma ORM）
- `flextree-bun-sqlite-adapter`（基于 Bun 内置 sqlite）

详见 [数据库适配](../guide/adapters.md)。
