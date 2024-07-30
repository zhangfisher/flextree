import path from 'node:path'
import fs from "node:fs"
import Database from 'better-sqlite3'
import type { IFlexTreeNode } from 'flextree'
import { FlexTreeManager,FlexTree, FlexTreeVerifyError } from 'flextree'
import SqliteAdapter from 'flextree-sqlite-adapter' 

export async function createTreeTable(driver: SqliteAdapter) {
    await driver.exec([`
        CREATE TABLE IF NOT EXISTS  tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),              
            treeId INTEGER, 
            level INTEGER,  
            leftValue INTEGER, 
            rightValue INTEGER,
            title VARCHAR(60),
            size INTEGER
        );
    `])
}
export async function createMultiTreeTable(driver: SqliteAdapter) {
    await driver.exec([`
        CREATE TABLE IF NOT EXISTS  tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60), 
            treeId INTEGER, 
            level INTEGER,  
            leftValue INTEGER, 
            rightValue INTEGER,            
            title VARCHAR(60),
            size INTEGER
            UNIQUE(treeId, left)
        );
    `])
}
async function clearAllTables(driver: SqliteAdapter) {
    await driver.exec([`DELETE FROM tree`])
}

export async function createTreeManager(treeId?: any) {
    const sqliteAdapter = new SqliteAdapter()
    await sqliteAdapter.open()
    if (treeId) {
        await createMultiTreeTable(sqliteAdapter)
    } else {
        await createTreeTable(sqliteAdapter)
    }
    await clearAllTables(sqliteAdapter)
    return new FlexTreeManager<{
        title: string
        size: number
    }>('tree', {
	    treeId,
        adapter: sqliteAdapter,
    })
}

export type DemoFlexTreeManager = FlexTreeManager<{
    title: string
    size: number
}>
export type DemoFlexTree = FlexTree<{
    title: string
    size: number
}>

export async function createFlexTree(treeId?: any) {
    const sqliteDriver = new SqliteAdapter()
    await sqliteDriver.open()
    if (treeId) {
        await createMultiTreeTable(sqliteDriver)
    } else {
        await createTreeTable(sqliteDriver)
    }
    await clearAllTables(sqliteDriver)
    const tree = new FlexTree<{
        title: string
        size: number
    }>('tree', {
	    treeId,
	    adapter: sqliteDriver,
    })
    return tree
}
/**
 *
 * 生成一个 demo 树
 *
 * @description
 * 树的结构如下：
 * root:
 * - A:
 *  - A1:
 *     - A11
 * - A12
 *      - A13
 *      - A14
 *      - A15
 *  - B
 */
export async function createDemoTree(tree: DemoFlexTreeManager, options?: { level?: number, treeCount?: number }): Promise<number> {
    const { level, treeCount } = Object.assign({ level: 3, treeCount: 1 }, options)
    const names = ['A', 'B', 'C', 'D', 'E', 'F']
    let count: number = 0
    for (let treeId = 1; treeId <= treeCount; treeId++) {
        await tree.write(async () => {
            await tree.createRoot({ id: 1, name: 'root', treeId, title: 'root-title', size: Math.floor(Math.random() * 1000) })
            count++
            // level=1:   id=100,200,300,400,500,600,700
            await tree.addNodes(names.map((name, index) => {
                count++
                return { name, id: (index + 1) * 100, treeId, title: `${name}-title`, size: Math.floor(Math.random() * 1000) }
            }))
            async function createNodes(pid: number, pname: string, lv: number) {
                const nodes = Array.from({ length: 5 }).fill(0).map<any>((_, i) => {
                    count++
                    const name = `${pname}-${i + 1}`
                    return {
                        name,
                        id: Number.parseInt(`${pid}${Number(i) + 1}`),
                        treeId,
                        title: `${name}-title`,
                        size: Math.floor(Math.random() * 1000),
                    }
                })
                await tree.addNodes(nodes, pid)
                if (lv < level) {
                    for (const node of nodes) {
                        await createNodes(node.id, node.name, lv + 1)
                    }
                }
            }
            for (const [index, name] of Object.entries(names)) {
                await createNodes((Number(index) + 1) * 100, name, 2)
            }
        })
    }
    return count
}

/**
 * 将srceDb的树复制到destDb
 *
 * 单元测试使用内存数据库，调试过程中不方便查看表数据
 * 所以在每个Case后将数据转存到数据库文件以便查看
 *
 * @param srcDb
 */
export async function dumpTree(srcDb: any, dbFile: string = 'tree.db') {
    const dumpDir = path.join(__dirname, './dumps')
    if (!fs.existsSync(dumpDir)) {
        fs.mkdirSync(dumpDir)
    }
    const dbFilename = path.join(dumpDir, dbFile)
    const destDb = new Database(dbFilename)
    await destDb.exec(`
        CREATE TABLE IF NOT EXISTS tree (        
            id INTEGER PRIMARY KEY,
            treeId INTEGER, 
            level INTEGER,  
            name VARCHAR(60),  
            leftValue INTEGER, 
            rightValue INTEGER,            
            title VARCHAR(60),
            size INTEGER
    )`)
    const rows = srcDb.prepare('SELECT * FROM tree').all()
    await destDb.exec('BEGIN')
    await destDb.prepare('DELETE FROM tree').run()
    for (const row of rows) {
        await destDb.prepare('INSERT INTO tree (name,level,leftValue,rightValue) VALUES (?,?,?,?)').run(row.name, row.level, row.leftValue, row.rightValue)
    }
    await destDb.exec('COMMIT')
}

/**
 *
 * 对通过createDemoTree生成的树进行全树验证
 *
 * 主要验证左右值是否正确，如果不正确则抛出异常
 */
export async function verifyTree(tree: FlexTreeManager): Promise<boolean> {
    const nodes = await tree.getNodes()

    const pnodes: IFlexTreeNode[] = []
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (node.rightValue - node.leftValue === 1) { // 无子节点
            if (pnodes.length > 0) {
                const pnode = pnodes[pnodes.length - 1]
                if (pnode.level !== node.level - 1) {
                    throw new FlexTreeVerifyError(`level error ${node.name}(${node.id})`)
                } else if (!(node.leftValue > pnode.leftValue)) {
                    throw new FlexTreeVerifyError(`leftValue error ${node.name}(${node.id})`)
                } else if (!(node.rightValue < pnode.rightValue)) {
                    throw new FlexTreeVerifyError(`rightValue error ${node.name}(${node.id})`)
                }
                // 子节点结束
                if (node.rightValue + 1 === pnode.rightValue) {
                    let preNode = pnodes.pop()
                    if (pnodes.length > 0) {
                        while (preNode!.rightValue + 1 === pnodes[pnodes.length - 1]?.rightValue) {
                            preNode = pnodes.pop()
                            if (pnodes.length === 0) {
                                break
                            }
                        }
                    }
                }
            }
            if ((node.rightValue - node.leftValue - 1) % 2 !== 0) {
                throw new FlexTreeVerifyError(`${node.name}(${node.id}) rightValue - leftValue error `)
            }
        } else if (node.rightValue - node.leftValue >= 3) { // 有子节点
            //  rightValue-leftValue一定是奇数,否则说明有问题
            if ((node.rightValue - node.leftValue - 1) % 2 === 0) {
                pnodes.push(node) // 先保存父节点
            } else {
                throw new FlexTreeVerifyError(`${node.name}(${node.id}) rightValue - leftValue error `)
            }
        } else {
            throw new FlexTreeVerifyError()
        }
    }
    if (pnodes.length > 0) {
        throw new FlexTreeVerifyError()
    }
    return true
}

export type ReturnPromiseType<T extends (...args: any) => any> = ReturnType<T> extends Promise<infer U> ? U : ReturnType<T>
