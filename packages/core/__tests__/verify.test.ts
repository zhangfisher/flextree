import { test,describe,beforeEach, expect, beforeAll, afterEach } from "vitest" 
import { FlexNodeRelPosition, FlexTreeManager, FlexTreeNodeError, FlexTreeNodeRelation, NextSibling, PreviousSibling } from "../src/index"; 
import { createDemoTree, createTreeManager, dumpTree,verifyTree } from "./common";
 


describe("检查树的完整性", () => {
    let tree:FlexTreeManager
    beforeEach(async ()=>{
        tree = await createTreeManager()
        await createDemoTree(tree)        
    })    
    afterEach(async ()=>{ 
    })
    test("检查树的完整性",async ()=>{
        expect(await tree.verify()).toBe(true)
    })

})