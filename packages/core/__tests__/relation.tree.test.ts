import { test,describe,beforeEach, expect, beforeAll, afterEach } from "vitest" 
import { FlexNodeRelPosition, FlexTreeManager, FlexTreeNodeError, FlexTreeNodeRelation, NextSibling, PreviousSibling } from "../src/index"; 
import { createDemoTree, createTreeManager, dumpTree } from "./common";
 


describe("查询节点关系", () => {
    let tree:FlexTreeManager
    beforeEach(async ()=>{
        tree = await createTreeManager()
        await createDemoTree(tree)
    })    
    afterEach(async ()=>{ 
        await dumpTree(tree.driver.db,"relation.db")
    })
    test("返回自己关系",async ()=>{
        const a1 = await  tree.findNode({name:"A_1"})
        expect(await tree.getNodeRelation(a1,a1)).toBe(FlexTreeNodeRelation.Self)
    })
    test("返回子节点关系",async ()=>{
        const a = await tree.findNode({name:"A"})
        const a1 = await  tree.findNode({name:"A_1"})
        const a2 = await  tree.findNode({name:"A_2"})
        const a3 = await  tree.findNode({name:"A_3"})
        expect(await tree.getNodeRelation(a1,a)).toBe(FlexTreeNodeRelation.Child)
        expect(await tree.getNodeRelation(a2,a)).toBe(FlexTreeNodeRelation.Child)
        expect(await tree.getNodeRelation(a3,a)).toBe(FlexTreeNodeRelation.Child)
    })
    test("返回后代关系",async ()=>{
        const a = await tree.findNode({name:"A"})
        const a1 = await  tree.findNode({name:"A_1_1"})
        const a2 = await  tree.findNode({name:"A_2_1"})
        const a3 = await  tree.findNode({name:"A_3_1"})
        expect(await tree.getNodeRelation(a1,a)).toBe(FlexTreeNodeRelation.Descendants)
        expect(await tree.getNodeRelation(a2,a)).toBe(FlexTreeNodeRelation.Descendants)
        expect(await tree.getNodeRelation(a3,a)).toBe(FlexTreeNodeRelation.Descendants)
    })
    test("返回父节点关系",async ()=>{
        const a = await tree.findNode({name:"A"})
        const a1 = await  tree.findNode({name:"A_1"})
        const a2 = await  tree.findNode({name:"A_2"})
        const a3 = await  tree.findNode({name:"A_3"})
        expect(await tree.getNodeRelation(a,a1)).toBe(FlexTreeNodeRelation.Parent)
        expect(await tree.getNodeRelation(a,a2)).toBe(FlexTreeNodeRelation.Parent)
        expect(await tree.getNodeRelation(a,a3)).toBe(FlexTreeNodeRelation.Parent)
    }) 
    test("返回祖先关系",async ()=>{
        const a = await tree.findNode({name:"A"})
        const a1 = await  tree.findNode({name:"A_1_1"})
        const a2 = await  tree.findNode({name:"A_2_1"})
        const a3 = await  tree.findNode({name:"A_3_1"})
        expect(await tree.getNodeRelation(a,a1)).toBe(FlexTreeNodeRelation.Ancestors)
        expect(await tree.getNodeRelation(a,a2)).toBe(FlexTreeNodeRelation.Ancestors)
        expect(await tree.getNodeRelation(a,a3)).toBe(FlexTreeNodeRelation.Ancestors)
    })
    test("返回兄弟节点关系",async ()=>{
        const a1 = await  tree.findNode({name:"A_1"})
        const a2 = await  tree.findNode({name:"A_2"})
        const a3 = await  tree.findNode({name:"A_3"})
        
        expect(await tree.getNodeRelation(a1,a2)).toBe(FlexTreeNodeRelation.Siblings)
        expect(await tree.getNodeRelation(a2,a3)).toBe(FlexTreeNodeRelation.Siblings)
        expect(await tree.getNodeRelation(a1,a3)).toBe(FlexTreeNodeRelation.Siblings)

        const a11 = await  tree.findNode({name:"A_1_1"})
        const a12 = await  tree.findNode({name:"A_1_2"})
        const a13 = await  tree.findNode({name:"A_1_3"})
        
        expect(await tree.getNodeRelation(a11,a12)).toBe(FlexTreeNodeRelation.Siblings)
        expect(await tree.getNodeRelation(a12,a13)).toBe(FlexTreeNodeRelation.Siblings) 



        const nonSiblings =  [ 
            await tree.getRoot(),
            await tree.findNode({name:"A"}),
            await tree.findNode({name:"A_1_1"}), 
            await tree.findNode({name:"A_1_2"}),                         
            await tree.findNode({name:"B"}),
            await tree.findNode({name:"B_1"}),
            await tree.findNode({name:"B_1_1"})
        ] 
        // a1跟所有非兄弟节点的关系都不是兄弟
        for(const node of nonSiblings){
            expect(await tree.getNodeRelation(a1,node)).not.toBe(FlexTreeNodeRelation.Siblings)
        }
    })
    test("返回同级节点关系",async ()=>{        
        const a1 = await  tree.findNode({name:"A_1"})
        const b2 = await  tree.findNode({name:"B_2"})
        const c3 = await  tree.findNode({name:"C_3"})        
        expect(await tree.getNodeRelation(a1,b2)).toBe(FlexTreeNodeRelation.SameLevel)
        expect(await tree.getNodeRelation(b2,c3)).toBe(FlexTreeNodeRelation.SameLevel)
        expect(await tree.getNodeRelation(a1,c3)).toBe(FlexTreeNodeRelation.SameLevel)
    })

    test("返回同一棵树关系",async ()=>{
        const a = await  tree.findNode({name:"A_1"})
        const b = await  tree.findNode({name:"B_1_1"})
        const c = await  tree.findNode({name:"C_2_2"})
        expect(await tree.getNodeRelation(a,b)).toBe(FlexTreeNodeRelation.SameTree)
    })


})