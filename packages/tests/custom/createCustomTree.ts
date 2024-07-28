import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { FlexTreeManager,FlexTree } from 'flextree'
import SqliteAdapter from '@flextree/sqlite' 

export async function createTreeTable(driver: SqliteAdapter) {
    await driver.exec([`
        CREATE TABLE IF NOT EXISTS  tree (
            pk INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60), 
            tree INTEGER, 
            level INTEGER,  
            lft INTEGER, 
            rgt INTEGER,  
            size INTEGER
        );
    `])
}
export async function createMultiTreeTable(driver: SqliteAdapter) {
    await driver.exec([`
        CREATE TABLE IF NOT EXISTS  tree (
            pk INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60), 
            tree INTEGER, 
            level INTEGER,  
            lft INTEGER, 
            rgt INTEGER,      
            size INTEGER
            UNIQUE(tree, lft)
        );
    `])
}
async function clearAllTables(driver: SqliteAdapter) {
    await driver.exec([`DELETE FROM tree`])
}

export async function createCustomTreeManager(treeId?: any) {
    const sqliteAdapter = new SqliteAdapter()
    await sqliteAdapter.open()
    if (treeId) {
        await createMultiTreeTable(sqliteAdapter)
    } else {
        await createTreeTable(sqliteAdapter)
    }
    await clearAllTables(sqliteAdapter)
    return new FlexTreeManager<{ 
            size: number
        },
        {
            id:['pk',number],
            treeId:['tree',number],
            name:"title",
            leftValue:'lft',
            rightValue:'rgt'
        }>('tree', {
	    treeId,
        adapter: sqliteAdapter,        
        fields:{
            id:'pk',
            treeId:'tree',
            name:"title",
            leftValue:'lft',
            rightValue:'rgt'
        }
    })
}

export type CustomDemoFlexTreeManager = FlexTreeManager<{ 
    size: number
},
{
    id:['pk',number],
    treeId:['tree',number],
    name:"title",
    leftValue:'lft',
    rightValue:'rgt'
}>

export type CustomDemoFlexTree = FlexTree<{ 
    size: number
},
{
    id:['pk',number],
    treeId:['tree',number],
    name:"title",
    leftValue:'lft',
    rightValue:'rgt'
}>

export async function createCustomFlexTree(treeId?: any) {
    const sqliteDriver = new SqliteAdapter()
    await sqliteDriver.open()
    if (treeId) {
        await createMultiTreeTable(sqliteDriver)
    } else {
        await createTreeTable(sqliteDriver)
    }
    await clearAllTables(sqliteDriver)
    const tree = new FlexTree<{ 
        size: number
    },
    {
        id:['pk',number],
        treeId:['tree',number],
        name:"title",
        leftValue:'lft',
        rightValue:'rgt'
    }>('tree', {
	    treeId,
	    adapter: sqliteDriver,
        fields:{
            id:'pk',
            treeId:'tree',
            name:"title",
            leftValue:'lft',
            rightValue:'rgt'
        }
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
export async function createCustomDemoTree(tree: CustomDemoFlexTreeManager, options?: { level?: number, treeCount?: number }): Promise<number> {
    const { level, treeCount } = Object.assign({ level: 3, treeCount: 1 }, options)
    const names = ['A', 'B', 'C', 'D', 'E', 'F']
    let count: number = 0
    for (let treeId = 1; treeId <= treeCount; treeId++) {
        await tree.write(async () => {
            await tree.createRoot({ pk: 1, title: 'root', tree:treeId, size: Math.floor(Math.random() * 1000) })
            count++
            // level=1:   id=100,200,300,400,500,600,700
            await tree.addNodes(names.map((name, index) => {
                count++
                return {  pk: (index + 1) * 100, tree:treeId, title: name, size: Math.floor(Math.random() * 1000) }
            }))
            async function createNodes(pid: number, pname: string, lv: number) {
                const nodes = Array.from({ length: 5 }).fill(0).map<any>((_, i) => {
                    count++
                    const name = `${pname}-${i + 1}`
                    return {
                        title:name,
                        pk: Number.parseInt(`${pid}${Number(i) + 1}`),
                        tree:treeId,
                        size: Math.floor(Math.random() * 1000),
                    }
                })
                await tree.addNodes(nodes, pid)
                if (lv < level) {
                    for (const node of nodes) {
                        await createNodes(node.pk, node.title, lv + 1) 
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
export async function dumpCustomTree(srcDb: any, dbFile: string = 'tree.db') {
    const dumpDir = path.join(__dirname, './dumps')
    if (!fs.existsSync(dumpDir)) {
        fs.mkdirSync(dumpDir)
    }
    const dbFilename = path.join(dumpDir, `custom.${dbFile}`) 
    const destDb = new Database(dbFilename)
    await destDb.exec(`
        CREATE TABLE IF NOT EXISTS tree (        
            pk INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(60), 
            tree INTEGER, 
            level INTEGER,  
            lft INTEGER, 
            rgt INTEGER,      
            size INTEGER 
    )`)
    const rows = srcDb.prepare('SELECT * FROM tree').all()
    await destDb.exec('BEGIN')
    await destDb.prepare('DELETE FROM tree').run()
    for (const row of rows) {
        await destDb.prepare('INSERT INTO tree (title,level,lft,rgt) VALUES (?,?,?,?)').run(row.title, row.level, row.lft, row.rgt)
    }
    await destDb.exec('COMMIT')
}
 
export type ReturnPromiseType<T extends (...args: any) => any> = ReturnType<T> extends Promise<infer U> ? U : ReturnType<T>
