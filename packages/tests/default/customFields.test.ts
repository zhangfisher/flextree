/**
 * 自定义关键字段名称
 * 
 */

import { afterEach, beforeEach, describe } from "vitest";
import { CustomDemoFlexTreeManager, createCustomDemoTree, createCustomTreeManager, dumpCustomTree } from "../utils/createCustomTree";


describe("自定义关键字段名称",async ()=>{
    let tree:CustomDemoFlexTreeManager
    beforeEach(async ()=>{
        tree = await createCustomTreeManager()
        await createCustomDemoTree(tree)
    })

    afterEach(async ()=>{
        await dumpCustomTree(tree.adapter.db)
    })

})