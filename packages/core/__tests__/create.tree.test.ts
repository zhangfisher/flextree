import { test,describe,beforeAll,beforeEach, expect } from "vitest"
import sqlite3 from "sqlite3"
import {open,Database} from "sqlite"
import { FlexTreeManager } from "../src/index";


async function createTreeDb(){
    let db = await open({ filename: ":memory:", driver: sqlite3.Database });
    await db.exec(`
        CREATE TABLE tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),  
            level INTEGER,  
            leftValue INTEGER UNIQUE, 
            rightValue INTEGER
        );
    `)
    return db
}
async function createMultiTreeDb(){
    let db = await open({ filename: ":memory:", driver: sqlite3.Database });
    await db.exec(`
        CREATE TABLE tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60), 
            tree INTEGER, 
            level INTEGER,  
            leftValue INTEGER, 
            rightValue INTEGER,
            UNIQUE(tree, leftValue)
        );
    `)
    return db
}

async function insertData(db:Database){
    const sql =`INSERT INTO tree (id, tree_id, tree_left, tree_right, tree_level, name ) VALUES
    (1, 0, 1, 16, 1, 'root1'),
    (2, 0, 2, 3, 2, 'A'),
    (3, 0, 4, 13, 2, 'B'),
    (4, 0, 5, 12, 3, 'B1'),
    (5, 0, 14, 15, 2, 'C'),
    (6, 0, 6, 7, 4, 'B1_1'),
    (7, 0, 8, 9, 4, 'B1_2'),
    (8, 0, 10, 11, 4, 'B1_3'),
    (9, 1, 1, 8, 1, 'root2'),
    (10, 1, 2, 3, 2, '2-A'),
    (11, 1, 4, 5, 2, '2-B'),
    (12, 1, 6, 7, 2, '2-C');`
    await db.exec(sql)
}

describe("创建单树表根节点", () => {

    let db:Database
    beforeEach(async () => {
        db = await createTreeDb()  
    })

    test('单树表中创建根节点', async () => {
        const tree = new FlexTreeManager("tree",{
            async onRead(sql:string){
                return await db.all(sql)
            },
            async onWrite(sqls:string[]){
                return await db.run(sqls.join(';'))
            }
        })
        let r = await tree.createRoot({name:"root"})
        const root = await tree.getRoot()
        expect(root).not.toBeNull()
        expect(root?.name).toBe("root")
        expect(root?.level).toBe(0)
        expect(root?.leftValue).toBe(1)
        expect(root?.rightValue).toBe(2)
    })
    test('单树表中创建根节点时如果已存在，则触发错误', async () => {
        const tree = new FlexTreeManager("tree",{
            async onRead(sql:string){
                return await db.all(sql)
            },
            async onWrite(sqls:string[]){
                await db.exec(sqls.join(';'))
            }
        })
        await tree.createRoot({name:"root"})
        try{
            await tree.createRoot({name:"root"})
        }catch(e:any){
            expect(e).toBeInstanceOf(Error)
        }
    })

    test('单树表中创建根节点时如果已存在则更新，不存在则创建', async () => {
        const tree = new FlexTreeManager("tree",{
            async onRead(sql:string){
                return await db.all(sql)
            },
            async onWrite(sqls:string[]){
                await db.exec(sqls.join(';'))
            }
        })
        await tree.createRoot({name:"root"}) 
        await tree.createRoot({name:"root2"},{upsert:true})
        let root = await tree.getRoot()        
        expect(root).not.toBeNull()
        expect(root?.name).toBe("root2") 
    })


})
 
describe("创建多树表根节点", () => {

    let db:Database
    beforeEach(async () => {
        db = await createTreeDb()  
    })

    test('多树表中创建根节点', async () => {
        const tree = new FlexTreeManager("tree",{
            treeId:10,
            async onRead(sql:string){
                return await db.all(sql)
            },
            async onWrite(sqls:string[]){
                await db.exec(sqls.join(';'))
            }
        })
        await tree.createRoot({name:"root"})
        const root = await tree.getRoot()
        expect(root).not.toBeNull()
        expect(root?.treeId).toBe(10)
        expect(root?.name).toBe("root")
        expect(root?.level).toBe(0)
        expect(root?.leftValue).toBe(1)
        expect(root?.rightValue).toBe(2)
    })
    test('多树表中创建根节点时如果已存在，则触发错误', async () => {
        const tree = new FlexTreeManager("tree",{
            treeId:10,
            async onRead(sql:string){
                return await db.all(sql)
            },
            async onWrite(sqls:string[]){
                await db.exec(sqls.join(';'))
            }
        })
        await tree.createRoot({name:"root"})
        try{
            await tree.createRoot({name:"root"})
        }catch(e:any){
            expect(e).toBeInstanceOf(Error)
        }
    })

    test('多树表中创建根节点时如果已存在则更新，不存在则创建', async () => {
        const tree = new FlexTreeManager("tree",{
            treeId:10,
            async onRead(sql:string){
                return await db.all(sql)
            },
            async onWrite(sqls:string[]){
                await db.exec(sqls.join(';'))
            }
        })
        await tree.createRoot({name:"root"}) 
        await tree.createRoot({name:"root2"},{upsert:true})
        let root = await tree.getRoot()        
        expect(root).not.toBeNull()
        expect(root?.name).toBe("root2") 
    })


})
 