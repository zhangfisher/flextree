/**
 * 更新树
 */
import { test,describe,beforeEach, expect, beforeAll, afterEach } from "vitest" 
import { FlexNodeRelPosition, FlexTreeManager, FlexTreeNodeError, NextSibling, PreviousSibling } from "../src/index"; 
import { createDemoTree, createTreeManager, dumpTree } from "./common";
 


describe("移动树节点", () => {
    let tree:FlexTreeManager 
    beforeEach(async () => {
        tree = await createTreeManager()      
        await createDemoTree(tree)
    })
    
    afterEach(async ()=>{ 
        await dumpTree(tree.driver.db,"move.root.db")
    })
    
    test("判定节点是否可以其他节点的指定位置", async () => {
        const root = await tree.getNode({})
        const a =await  tree.getNode(2)
        // 允许移动
        expect(await tree.canMoveTo(node, FlexNodeRelPosition.Child, target)).toBe(true)
        expect(await tree.canMoveTo(node, FlexNodeRelPosition.PreviousSibling, target)).toBe(false)
        expect(await tree.canMoveTo(node, FlexNodeRelPosition.NextSibling, target)).toBe(true)
        // 不允许移动        
        expect(await tree.canMoveTo(node, FlexNodeRelPosition.Child, target)).toBe(true)
        expect(await tree.canMoveTo(node, FlexNodeRelPosition.PreviousSibling, target)).toBe(false)
        expect(await tree.canMoveTo(node, FlexNodeRelPosition.NextSibling, target)).toBe(true)
    })

})