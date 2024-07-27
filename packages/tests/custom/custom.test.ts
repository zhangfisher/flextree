/**
 * 自定义关键字段名称
 * 
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { CustomDemoFlexTreeManager, createCustomDemoTree, createCustomFlexTree, createCustomTreeManager, dumpCustomTree } from "../utils/createCustomTree";


describe("自定义关键字段名称",async ()=>{
    let tree:CustomDemoFlexTreeManager
    beforeEach(async ()=>{
        tree = await createCustomTreeManager()
        await createCustomDemoTree(tree)
    })

    afterEach(async ()=>{
        await dumpCustomTree(tree.adapter.db)
    })

    test("使用管理器访问节点",async ()=>{
        
        const root  = await tree.getRoot()

        expect(root.title).toBe("root")
        expect('pk' in root).toBe(true)
        expect('level' in root).toBe(true)
        expect('lft' in root).toBe(true)
        expect('rgt' in root).toBe(true)
        expect('title' in root).toBe(true)
        expect('size' in root).toBe(true) 

    })

    test("使用树对象访问子节点",async ()=>{
        const treeobj = await createCustomFlexTree()
        await createCustomDemoTree(treeobj.manager) 
        await treeobj.load() 

        const root = treeobj.root!

        expect(root).not.toBe(null)
        expect(root.id).toBe(1)
        expect(root.name).toBe("root")
        expect(root.level).toBe(0)
        expect(root.leftValue).toBe(1)




    })

})