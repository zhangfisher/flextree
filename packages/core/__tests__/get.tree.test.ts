import { test,describe,beforeAll,beforeEach, afterEach, expect } from "vitest"
import { createDemoTree, createTreeManager, dumpTree } from "./common"
import { FlexTreeManager } from "../src"


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
describe("访问树", () => {
  let tree:FlexTreeManager
  let nodeCount:number = 0
  beforeEach(async ()=>{
    tree = await createTreeManager()
    nodeCount = await createDemoTree(tree)    
  })    
  afterEach(async ()=>{ 
      await dumpTree(tree.driver.db,"get.db")
  })
  test("检查根节点是否存在", async () => {
      expect(await tree.hasRoot()).toBe(true)
      let root = await tree.getRoot()
      expect(root).not.toBe(null)
      expect(root.level).toBe(0)
      expect(root.leftValue).toBe(1)    
  })
  test("获取后代节点", async () => {
    let root = await tree.getRoot()
    let descendants = await tree.getDescendants(root)
    expect(descendants.length).toBe(nodeCount-1)
    
    descendants = await tree.getDescendants(root,{includeSelf:true})
    expect(descendants.length).toBe(nodeCount)
    // 
    descendants = await tree.getDescendants(root,{level:1,includeSelf:true})
    expect(descendants.length).toBe(7)
   
    
    descendants = await tree.getDescendants(root,{level:2})
    expect(descendants.length).toBe(6+5*6)

    
    descendants = await tree.getDescendants(root,{level:2,includeSelf:true})
    expect(descendants.length).toBe(6+5*6 + 1)

    descendants = await tree.getDescendants(root,{level:3})
    expect(descendants.length).toBe(6+5*6 + 5*5*6)

    
    descendants = await tree.getDescendants(root,{level:3,includeSelf:true})
    expect(descendants.length).toBe(6+5*6 + 5*5*6 + 1)

  })

  test("获取后代节点数量", async () => {
    let root = await tree.getRoot()
    let descendantCount = await tree.getDescendantCount(root)
    expect(descendantCount).toBe(nodeCount-1)

    descendantCount = await tree.getDescendantCount(root,{level:1})
    expect(descendantCount).toBe(6)

    descendantCount = await tree.getDescendantCount(root,{level:2})
    expect(descendantCount).toBe(6 + 5*6)

    descendantCount = await tree.getDescendantCount(root,{level:3})
    expect(descendantCount).toBe(6 + 5*6 + 5*5*6)


    let children = await tree.getChildren(root) // A,B,C,D,E,F

    for(let i = 0; i < children.length; i++){ 
      let count = await tree.getDescendantCount(children[i])
      expect(count).toBe(5 + 5*5)
    }
    for(let i = 0; i < children.length; i++){ 
      let count = await tree.getDescendantCount(children[i],{level:1})
      expect(count).toBe(5 )
    }
  })

  test("获取子节点", async () => {
    let root = await tree.getRoot()
    let children = await tree.getChildren(root)
    expect(children.length).toBe(6)
    for(let i = 0; i < children.length; i++){ 
      let subchildren = await tree.getChildren(children[i])
      expect(subchildren.length).toBe(5)
    }
  })

  test("获取祖先节点", async () => {
    let root = await tree.getRoot()
    let children = await tree.getChildren(root)
    for(let i = 0; i < children.length; i++){ 
      let ancestors = await tree.getAncestors(children[i])
      expect(ancestors.length).toBe(1)
      expect(ancestors[0]).toStrictEqual(root)
    }
    for(let i = 0; i < children.length; i++){ 
      let ancestors = await tree.getAncestors(children[i],{includeSelf:true})
      expect(ancestors.length).toBe(2)
      expect(ancestors[0]).toStrictEqual(root)
    }
    const names=["A","B","C","D","E","F"]

    for(let name of names){
      for(let i = 0; i < 5; i++){         
        let node = await tree.findNode({name:`${name}-1-${i+1}`})
        let ancestors = await tree.getAncestors(node)
        expect(ancestors.length).toBe(3)
        expect(ancestors[0].name).toBe("root")
        expect(ancestors[1].name).toBe(name)
        expect(ancestors[2].name).toBe(`${name}-1`)
      }
    }
 
  })




})