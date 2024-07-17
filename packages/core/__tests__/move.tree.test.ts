/**
 * 更新树
 */
import { test,describe,beforeEach, expect, beforeAll } from "vitest" 
import { FlexNodeRelPosition, FlexTreeManager, FlexTreeNodeError, NextSibling, PreviousSibling } from "../src/index"; 
import { createDemoTree, createTreeManager } from "./common";
 


describe("移动树节点", () => {
    let tree:FlexTreeManager 
    beforeEach(async () => {
        tree = await createTreeManager()      
        await createDemoTree(tree)
    })
    test("移动节点",async ()=>{
        
    })

})