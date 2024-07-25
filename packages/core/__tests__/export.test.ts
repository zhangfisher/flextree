import { test,describe,beforeEach, afterEach,expect} from "vitest" 
import { createDemoTree, createFlexTree,ReturnPromiseType,dumpTree } from "./common";
 


describe("导出树", () => {
    let tree:ReturnPromiseType<typeof createFlexTree>
    beforeEach(async () => {
        tree = await createFlexTree()        
        await createDemoTree(tree.manager)
        await tree.load()
    })     
    afterEach(async ()=>{ 
        await dumpTree(tree.manager.driver.db,"export.db")
    })
    test("导出整棵树为NESTED嵌套格式",async ()=>{
        const data = tree.root!.export()
        expect(data.name).toBe("root")

        expect(data.children?.length).toBe(tree.root?.children?.length)

        // 比较导出的数据与tree树的数据是否一致
        data.children?.forEach((child,index)=>{
            expect(child.name).toBe(tree.root?.children![index].name)
        })

        const keys = Object.keys(data)
        expect(keys.length).toBe(5)
        expect(keys.includes("name")).toBe(true)
        expect(keys.includes("id")).toBe(true)
        expect(keys.includes("children")).toBe(true)
        expect(keys.includes("size")).toBe(true)
        expect(keys.includes("title")).toBe(true)
    })
    
    test("导出整棵树为NESTED嵌套格式时限定级别",async ()=>{
        let data = tree.root!.export({level:1})
        expect(data.name).toBe("root")
        expect(data.children).toBeUndefined()

        data = tree.root!.export({level:2})
        expect(data.name).toBe("root")
        expect(data.children?.length).toBe(tree.root?.children?.length)
        data.children!.forEach(child=>{
            expect(child.children).toBeUndefined()
        })

        data = tree.root!.export({level:3})
        expect(data.name).toBe("root")
        expect(data.children?.length).toBe(tree.root?.children?.length)
        data.children!.forEach(child=>{
            expect(child.children?.length).toBe(5)
            child.children!.forEach(subChild=>{
                expect(subChild.children).toBeUndefined()
            })
        })




    })
    test("导出整棵树为NESTED嵌套格式时指定输出字段",async ()=>{
        const data = tree.root!.export({
            fields:["name","id"]
        })
        expect(data.name).toBe("root")
        expect(data.children?.length).toBe(tree.root?.children?.length)
        // 比较导出的数据与tree树的数据是否一致
        data.children?.forEach((child,index)=>{
            expect(child.name).toBe(tree.root?.children![index].name)
        })
        const keys = Object.keys(data)
        expect(keys.length).toBe(3)
        expect(keys.includes("name")).toBe(true)
        expect(keys.includes("id")).toBe(true)
        expect(keys.includes("children")).toBe(true) 
    })
    test("导出整棵树为PID格式",async ()=>{
        const nodes  = tree.root!.export<'pid'>({
            format:'pid'
        })       

        expect(nodes[0].name).toBe("root")
        expect(nodes[0].pid).toBe(0)
        
        expect(nodes[1].name).toBe("A")
        expect(nodes[1].pid).toBe(nodes[0].id)

        expect(nodes[2].name).toBe("A-1")
        expect(nodes[2].pid).toBe(nodes[1].id)
        expect(nodes[3].name).toBe("A-1-1")
        expect(nodes[3].pid).toBe(nodes[2].id)
        expect(nodes[4].name).toBe("A-1-2")
        expect(nodes[4].pid).toBe(nodes[2].id)
        expect(nodes[5].name).toBe("A-1-3")
        expect(nodes[5].pid).toBe(nodes[2].id)
        expect(nodes[6].name).toBe("A-1-4")
        expect(nodes[6].pid).toBe(nodes[2].id)
        expect(nodes[7].name).toBe("A-1-5")
        expect(nodes[7].pid).toBe(nodes[2].id)

        expect(nodes[8].name).toBe("A-2")
        expect(nodes[8].pid).toBe(nodes[1].id)
        expect(nodes[9].name).toBe("A-2-1")
        expect(nodes[9].pid).toBe(nodes[8].id)
        expect(nodes[10].name).toBe("A-2-2")
        expect(nodes[10].pid).toBe(nodes[8].id)
        expect(nodes[11].name).toBe("A-2-3")
        expect(nodes[11].pid).toBe(nodes[8].id)
        expect(nodes[12].name).toBe("A-2-4")
        expect(nodes[12].pid).toBe(nodes[8].id)
        expect(nodes[13].name).toBe("A-2-5")
        expect(nodes[13].pid).toBe(nodes[8].id)





        // 比较导出的数据与tree树的数据是否一致
        
        
    })

})