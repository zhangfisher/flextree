import type { FlexTreeManager, IFlexTreeAdapter } from 'flextree'

/**
 * Prisma 底层数据库类型。
 *
 * Prisma 客户端不直接暴露底层数据库类型，需由调用方根据实际连接的数据库显式指定，
 * 以便 FlexTree 生成正确的 SQL（标识符/字符串转义因数据库而异）。默认 postgresql。
 */
export type PrismaDatabaseType = "sqlite" | "mysql" | "postgresql" | "oracle" | "sqlserver"

export default class PrismaAdapter implements IFlexTreeAdapter {
    db: any
    _treeManager?: FlexTreeManager
    type: PrismaDatabaseType
    constructor(public prismaClient: any, type: PrismaDatabaseType = "postgresql") {
        this.db = prismaClient
        this.type = type
    }

    get connected() { return true }

    bind(treeManager: FlexTreeManager) {
        this._treeManager = treeManager
    }

    /**
     * 执行多条 SQL（不自带事务）。
     *
     * 原子性由外层 transaction 保证。exec 本身只负责顺序执行。
     */
    async exec(sqls: string | string[]): Promise<void> {
        if (typeof sqls === 'string') { sqls = [sqls] }
        for (const sql of sqls) {
            await this.db.$queryRawUnsafe(sql)
        }
    }

    async getRows(sql: string): Promise<any[]> {
        return await this.db.$queryRawUnsafe(sql)
    }

    async getScalar<T = number>(sql: string): Promise<T> {
        const result: any = await this.db.$queryRawUnsafe(sql)
        if (Array.isArray(result) && result.length === 0) { return undefined as unknown as T }
        return result[0] as unknown as T
    }

    async open(_config?: any): Promise<any> {
    }

    private _inTransaction = false
    /**
     * 在数据库事务中执行异步回调。
     *
     * 用 Prisma 的 $transaction(async cb) 包裹：原子提交，抛错整体回滚（$transaction 自管理）。
     * 嵌套调用时复用外层事务，不重复 $transaction（Prisma 不支持嵌套 $transaction）。
     */
    async transaction(callback: () => Promise<void>): Promise<void> {
        if (this._inTransaction) {
            await callback()
            return
        }
        this._inTransaction = true
        try {
            await this.db.$transaction(async () => {
                await callback()
            })
        } finally {
            this._inTransaction = false
        }
    }
}
