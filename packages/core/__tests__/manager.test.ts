import { test,describe,beforeAll } from "vitest"
import sqlite3 from "sqlite3"
import {open,Database} from "sqlite"


async function createDb(){
    let db = await open({ filename: ":memory:", driver: sqlite3.Database });
    await db.exec(`
        CREATE TABLE fs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tree_id INTEGER, 
            tree_left INTEGER, 
            tree_right INTEGER, 
            tree_level INTEGER,  
            name VARCHAR(60) 
        );
    `)
    await db.exec('CREATE TABLE tbl (col TEXT)')
await db.exec('INSERT INTO tbl VALUES ("test")')
    return db
}

async function insertData(db:Database){
    const sql =`INSERT INTO fs (id, tree_id, tree_left, tree_right, tree_level, name ) VALUES
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

describe("Manager", () => {

    let db:Database
    beforeAll(async () => {
        db = await createDb()
        await insertData(db) 

 
    })

  test("should be able to add a new user", () => {
    // test code here
  })

})