import { test,describe,beforeEach, expect, afterEach } from "vitest" 
import { FlexNodeRelPosition, FlexTreeManager, FlexTreeNodeError, NextSibling, PreviousSibling } from "../src/index"; 
import { createTreeManager,createDemoTree,dumpTree, verifyTree } from "./common";
 


describe("删除树节点", () => {
    let tree:FlexTreeManager
    beforeEach(async ()=>{
        tree = await createTreeManager()
        await createDemoTree(tree,{level:2})
    })    
    afterEach(async ()=>{ 
        let nodes = await tree.getNodes()
        expect(verifyTree(nodes)).toBe(true)
        await dumpTree(tree.driver.db,"delete.db")
    })
    test("依次删除所有子节点",async ()=>{
        
        // 删除A_1        
        const a1 = await  tree.findNode({name:"A_1"})
        await tree.deleteNode(a1)        
        let a = await  tree.findNode({name:"A"})     
        expect((a.rightValue - a.leftValue -1)/2).toBe(4)

        let aChildren = await tree.getChildren(a.id)
        expect(aChildren.length).toBe(4)

        // 删除A_2        
        const a2 = await  tree.findNode({name:"A_2"})
        await tree.deleteNode(a2)
        a = await  tree.findNode({name:"A"})     // 由于删除了A_2节点会导致A节点的左右值变化，所以需要重新获取A节点
        expect((a.rightValue - a.leftValue -1)/2).toBe(3)
        aChildren = await tree.getChildren(a.id)
        expect(aChildren.length).toBe(3)


        // 删除A_3
        const a3 = await  tree.findNode({name:"A_3"})
        await tree.deleteNode(a3)
        a = await  tree.findNode({name:"A"})     // 由于删除了A_3节点会导致A节点的左右值变化，所以需要重新获取A节点
        expect((a.rightValue - a.leftValue -1)/2).toBe(2)
        aChildren = await tree.getChildren(a.id)
        expect(aChildren.length).toBe(2)

        // 删除A_4
        const a4 = await  tree.findNode({name:"A_4"})
        await tree.deleteNode(a4)
        a = await  tree.findNode({name:"A"})     // 由于删除了A_4节点会导致A节点的左右值变化，所以需要重新获取A节点
        expect((a.rightValue - a.leftValue -1)/2).toBe(1)
        aChildren = await tree.getChildren(a.id)
        expect(aChildren.length).toBe(1)

        // 删除A_5
        const a5 = await  tree.findNode({name:"A_5"})
        await tree.deleteNode(a5)
        a = await  tree.findNode({name:"A"})     // 由于删除了A_5节点会导致A节点的左右值变化，所以需要重新获取A节点
        expect((a.rightValue - a.leftValue -1)/2).toBe(0)
        aChildren = await tree.getChildren(a.id)
        expect(aChildren.length).toBe(0)
    })
    test("删除节点及所有子节点",async ()=>{
         // 删除A        
         let nodes = await  tree.getNodes()
         const oldCount = nodes.length
         const a = await  tree.findNode({name:"A"})
         const deleteCount =  (a.rightValue - a.leftValue - 1)/2 + 1
         await tree.deleteNode(a)        
         nodes = await  tree.getNodes()
         expect(nodes.length).toBe(oldCount - deleteCount) 
    })
    test("删除所有节点包括根节点",async ()=>{  
        const root = await  tree.findNode({name:"root"})        
        await tree.deleteNode(root)        
        let nodes = await  tree.getNodes()
        expect(nodes.length).toBe(0) 
   })
   test("只标注删除节点及所有子节点",async ()=>{
        // 删除A        
        let nodes = await  tree.getNodes()
        const oldCount = nodes.length
        const a = await  tree.findNode({name:"A"})
        const deleteCount =  (a.rightValue - a.leftValue - 1)/2 + 1
        await tree.deleteNode(a,{onlyMark:true})        
        nodes = await  tree.getNodes()
        expect(nodes.length).toBe(oldCount - deleteCount) 

        const rows = await tree.driver.getRows("select * from tree where leftValue<0 and rightValue<0")
        expect(rows.length).toBe(deleteCount)

    })
})