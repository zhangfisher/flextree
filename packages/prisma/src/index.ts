import type { DefaultTreeKeyFields, FlexTreeManager, IFlexTreeAdapter, IFlexTreeNodeFields } from 'flextree'

export default class PrismaAdapter implements IFlexTreeAdapter {
    ready: boolean = true
    db: any
    _treeManager?: FlexTreeManager
    constructor(public prismaClient: any) {
        this.db = prismaClient
    }

    bind(treeManager: FlexTreeManager<object, DefaultTreeKeyFields, IFlexTreeNodeFields<object, DefaultTreeKeyFields>, number, number>): void {
        this._treeManager = treeManager
    }

    async exec(sqls: string | string[]): Promise<void> {
        if (typeof sqls === 'string') { sqls = [sqls] }
        await this.db.$transaction(sqls.map(sql => this.db.$queryRawUnsafe(sql)))
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
}
