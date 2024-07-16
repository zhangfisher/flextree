import {Database} from "sqlite"
import { FlexTreeManager } from "../src/index";
import SqliteDriver  from "../../sqlite/src/index"

export async function createTreeTable(driver:SqliteDriver){
    await driver.exec(`
        CREATE TABLE tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),  
            level INTEGER,  
            leftValue INTEGER UNIQUE, 
            rightValue INTEGER
        );
    `)
}
export async function createMultiTreeTable(driver:SqliteDriver){
    await driver.exec(`
        CREATE TABLE tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60), 
            treeId INTEGER, 
            level INTEGER,  
            leftValue INTEGER, 
            rightValue INTEGER,
            UNIQUE(treeId, leftValue)
        );
    `) 
}

export async function createTreeManager(treeId?:any){
    const sqliteDriver = new SqliteDriver()
    await sqliteDriver.open()
    if(treeId){
        await createMultiTreeTable(sqliteDriver)
    }else{
        await createTreeTable(sqliteDriver)
    } 
    return new FlexTreeManager("tree",{
        treeId,
        driver: sqliteDriver
    })    
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