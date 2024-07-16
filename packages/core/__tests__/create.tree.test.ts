import { test,describe,beforeEach, expect } from "vitest" 
import { FlexTreeManager } from "../src/index"; 
import { createTreeManager } from "./common";
 


describe("创建单树表根节点", () => {

    let tree:FlexTreeManager 
    beforeEach(async () => {
        tree = await createTreeManager()
        
    })

    test('单树表中创建根节点', async () => { 
        let r = await tree.createRoot({name:"root"})
        const root = await tree.getRoot()
        expect(root).not.toBeNull()
        expect(root?.name).toBe("root")
        expect(root?.level).toBe(0)
        expect(root?.leftValue).toBe(1)
        expect(root?.rightValue).toBe(2)
    })
    test('单树表中创建根节点时如果已存在，则触发错误', async () => {
        await tree.createRoot({name:"root"})
        try{
            await tree.createRoot({name:"root"})
        }catch(e:any){
            expect(e).toBeInstanceOf(Error)
        }
    })

    test('单树表中创建根节点时如果已存在则更新，不存在则创建', async () => { 
        await tree.createRoot({name:"root"}) 
        await tree.createRoot({name:"root2"},{upsert:true})
        let root = await tree.getRoot()        
        expect(root).not.toBeNull()
        expect(root?.name).toBe("root2") 
    })


})
 
describe("创建多树表根节点", () => {

    let tree:FlexTreeManager  
    beforeEach(async () => {
        tree = await createTreeManager(10)
        
    })

    test('多树表中创建根节点', async () => { 
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
        await tree.createRoot({name:"root"})
        try{
            await tree.createRoot({name:"root"})
        }catch(e:any){
            expect(e).toBeInstanceOf(Error)
        }
    })

    test('多树表中创建根节点时如果已存在则更新，不存在则创建', async () => { 
        await tree.createRoot({name:"root"}) 
        await tree.createRoot({name:"root2"},{upsert:true})
        let root = await tree.getRoot()        
        expect(root).not.toBeNull()
        expect(root?.name).toBe("root2") 
    })


})
describe("单树表创建节点", () => {
    let tree:FlexTreeManager  
    beforeEach(async () => {
        tree = await createTreeManager()
        await tree.createRoot({name:"root"})
    })
    test("在根节点下创建最后的子节点", async () => {
        await tree.addNodes([
            {name:"A"},
            {name:"B"},
            {name:"C"},
        ])
        let nodes = await tree.getNodes()
        expect(nodes).toHaveLength(4) 
        expect(nodes[1].name).toBe("A")
        expect(nodes[2].name).toBe("B")
        expect(nodes[3].name).toBe("C")

        expect(nodes[0].leftValue).toBe(1)
        expect(nodes[0].rightValue).toBe(8)
        expect(nodes[1].leftValue).toBe(2)
        expect(nodes[1].rightValue).toBe(3)
        expect(nodes[2].leftValue).toBe(4)
        expect(nodes[2].rightValue).toBe(5)
        expect(nodes[3].leftValue).toBe(6)
        expect(nodes[3].rightValue).toBe(7)

        expect(nodes[0].level).toBe(0)
        expect(nodes[1].level).toBe(1)
        expect(nodes[2].level).toBe(1)
        expect(nodes[3].level).toBe(1)
    })
    test("多次在根节点下创建最后的子节点", async () => {
        await tree.addNodes([
            {name:"A"}
        ])
        await tree.addNodes([
            {name:"B"}
        ])
        await tree.addNodes([
            {name:"C"}
        ])
        let nodes = await tree.getNodes()
        expect(nodes).toHaveLength(4) 
        expect(nodes[1].name).toBe("A")
        expect(nodes[2].name).toBe("B")
        expect(nodes[3].name).toBe("C")

        expect(nodes[0].leftValue).toBe(1)
        expect(nodes[0].rightValue).toBe(8)
        expect(nodes[1].leftValue).toBe(2)
        expect(nodes[1].rightValue).toBe(3)
        expect(nodes[2].leftValue).toBe(4)
        expect(nodes[2].rightValue).toBe(5)
        expect(nodes[3].leftValue).toBe(6)
        expect(nodes[3].rightValue).toBe(7)

        expect(nodes[0].level).toBe(0)
        expect(nodes[1].level).toBe(1)
        expect(nodes[2].level).toBe(1)
        expect(nodes[3].level).toBe(1)
    })


    

})
