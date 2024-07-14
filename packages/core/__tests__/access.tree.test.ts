// import { test,describe,beforeAll,beforeEach } from "vitest"
// import sqlite3 from "sqlite3"
// import {open,Database} from "sqlite"


// async function createTreeDb(){
//     let db = await open({ filename: ":memory:", driver: sqlite3.Database });
//     await db.exec(`
//         CREATE TABLE tree (
//             id INTEGER PRIMARY KEY AUTOINCREMENT,
//             name VARCHAR(60), 
//             tree INTEGER, 
//             node_level INTEGER,  
//             node_left INTEGER, 
//             node_right INTEGER
//         );
//     `)
//     return db
// }
 
// describe("创建树", () => {

//     let db:Database
//     beforeEach(async () => {
//         db = await createTreeDb()  
//     })

//   test("create root node on single tree", () => {
    
//   })

// })
// describe("访问树", () => {

//     let db:Database
//     beforeAll(async () => {
//         db = await createDb()
//         await insertData(db) 

 
//     })

//   test("should be able to add a new user", () => {
//     // test code here
//   })

// })