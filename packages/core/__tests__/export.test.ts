import { test,describe,beforeEach, afterEach,expect} from "vitest" 
import {  FlexTree } from "../src/index"; 
import { createDemoTree, createFlexTree } from "./common";
 


describe("导出树", () => {
    let tree:FlexTree 
    beforeEach(async () => {
        tree = await createFlexTree()        
        await createDemoTree(tree.manager)
        await tree.load()
    })     
    afterEach(async ()=>{ 
    })
    test("导出整棵树为NESTED嵌套格式",async ()=>{
        const data = tree.root!.export()
        expect(data.name).toBe("root")

        expect(data.children?.length).toBe(tree.root?.children?.length)

        // 比较导出的数据与tree树的数据是否一致
        

    })

    test("导出整棵树为PID格式",async ()=>{
        const nodes  = tree.root!.export<'pid'>({
            format:'pid'
        })
        expect(nodes[0].name).toBe("root")

        expect(nodes[0].pid).toBe(0)

        // 比较导出的数据与tree树的数据是否一致
        

    })

})