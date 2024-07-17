import {Database} from "sqlite"
import { FlexTreeManager } from "../src/index";
import SqliteDriver  from "../../sqlite/src/index" 

 

export async function createTreeTable(driver:SqliteDriver){
    await driver.exec([`
        CREATE TABLE tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),  
            level INTEGER,  
            leftValue INTEGER, 
            rightValue INTEGER
        );
    `])
}
export async function createMultiTreeTable(driver:SqliteDriver){
    await driver.exec([`
        CREATE TABLE tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60), 
            treeId INTEGER, 
            level INTEGER,  
            leftValue INTEGER, 
            rightValue INTEGER,
            UNIQUE(treeId, leftValue)
        );
    `]) 
}
async function clearAllTables(driver: SqliteDriver) {   
    await driver.exec([`DELETE FROM tree`]); 
}

async function isTableExists(driver: SqliteDriver,table:string){
    try{
        await driver.exec([`SELECT * FROM ${table}`])
        return true
    }catch(e){
        return false
    }
}

export async function createTreeManager(treeId?:any){
    const sqliteDriver = new SqliteDriver("tree.db")
    await sqliteDriver.open()    
    if(!(await isTableExists(sqliteDriver,'tree'))){
        if(treeId){
            await createMultiTreeTable(sqliteDriver)
        }else{
            await createTreeTable(sqliteDriver)
        } 
    }
    await clearAllTables(sqliteDriver)
    return new FlexTreeManager("tree",{
        treeId,
        driver: sqliteDriver
    })    
}


export async function createDemoTree(tree:FlexTreeManager,level:number=3){
    await tree.update(async ()=>{
        await tree.createRoot({id:1,name:"root"})
        const nodes=["A","B","C","D","E","F","G"]
        await tree.addNodes(nodes.map((name,index)=>{
            return {name,id:index+2}
        }))       
        for(let [index,name] of Object.entries(nodes)){
            await tree.addNodes([
                {name:`${name}1`},
                {name:`${name}2`},
                {name:`${name}3`},
                {name:`${name}4`},
                {name:`${name}5`}
            ],Number(index)+2)
        }
    })
     
}
/**
 * 随机生成树
 * 
 * - level
 * - 每个节点具有随机数量的子节点
 * 
 */
async function createRandomTree(tree:FlexTreeManager,level:number=3){
    await tree.update(async ()=>{
        await tree.createRoot({id:1,name:"root"})
        const nodes=["A","B","C","D","E","F","G"]
        await tree.addNodes(nodes.map((name,index)=>{
            return {name,id:index+2}
        }))        
    })
     
}