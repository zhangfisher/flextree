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
    describe("toJson导出树", () => {

        test("导出整棵树为JSON嵌套格式",async ()=>{
            const data = tree.root!.toJson()
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
        
        test("导出整棵树为JSON嵌套格式时限定级别",async ()=>{
            let data = tree.root!.toJson({level:1})
            expect(data.name).toBe("root")
            expect(data.children).toBeUndefined()
    
            data = tree.root!.toJson({level:2})
            expect(data.name).toBe("root")
            expect(data.children?.length).toBe(tree.root?.children?.length)
            data.children!.forEach(child=>{
                expect(child.children).toBeUndefined()
            })
    
            data = tree.root!.toJson({level:3})
            expect(data.name).toBe("root")
            expect(data.children?.length).toBe(tree.root?.children?.length)
            data.children!.forEach(child=>{
                expect(child.children?.length).toBe(5)
                child.children!.forEach(subChild=>{
                    expect(subChild.children).toBeUndefined()
                })
            })
    
    
    
    
        })
        test("导出整棵树为JSON嵌套格式时指定输出字段",async ()=>{
            const data = tree.root!.toJson({
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
    })
    describe("toList导出树", () => {
        test("导出整棵树为PID格式",async ()=>{
            const nodes  = tree.root!.toList()       
    
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
            
        })
        test("导出整棵树为List格式时限定级别",async ()=>{
            let nodes = tree.root!.toList({level:1})
            expect(nodes[0].name).toBe("root")

            nodes = tree.root!.toList({level:2})

            expect(nodes[0].name).toBe("root")
            expect(nodes[0].pid).toBe(0)
            expect(nodes[1].name).toBe("A")
            expect(nodes[1].pid).toBe(nodes[0].id)
            expect(nodes[2].name).toBe("B")
            expect(nodes[2].pid).toBe(nodes[0].id)
            expect(nodes[3].name).toBe("C")
            expect(nodes[3].pid).toBe(nodes[0].id)            
            expect(nodes[4].name).toBe("D")
            expect(nodes[4].pid).toBe(nodes[0].id)
            expect(nodes[5].name).toBe("E")
            expect(nodes[5].pid).toBe(nodes[0].id)
            expect(nodes[6].name).toBe("F")
            expect(nodes[6].pid).toBe(nodes[0].id)



            nodes = tree.root!.toList({level:3})


            expect(nodes[0].name).toBe("root")
            expect(nodes[0].pid).toBe(0)
            expect(nodes[1].name).toBe("A")
            expect(nodes[1].pid).toBe(nodes[0].id)
                expect(nodes[2].name).toBe("A-1")
                expect(nodes[2].pid).toBe(nodes[1].id) 
                expect(nodes[3].name).toBe("A-2")
                expect(nodes[3].pid).toBe(nodes[1].id)
                expect(nodes[4].name).toBe("A-3")
                expect(nodes[4].pid).toBe(nodes[1].id)
                expect(nodes[5].name).toBe("A-4")
                expect(nodes[5].pid).toBe(nodes[1].id)
                expect(nodes[6].name).toBe("A-5")
                expect(nodes[6].pid).toBe(nodes[1].id)

            expect(nodes[7].name).toBe("B")
            expect(nodes[7].pid).toBe(nodes[0].id)
                expect(nodes[8].name).toBe("B-1")
                expect(nodes[8].pid).toBe(nodes[7].id)
                expect(nodes[9].name).toBe("B-2")
                expect(nodes[9].pid).toBe(nodes[7].id)
                expect(nodes[10].name).toBe("B-3")
                expect(nodes[10].pid).toBe(nodes[7].id)
                expect(nodes[11].name).toBe("B-4")
                expect(nodes[11].pid).toBe(nodes[7].id)
                expect(nodes[12].name).toBe("B-5")
                expect(nodes[12].pid).toBe(nodes[7].id)

            expect(nodes[13].name).toBe("C")
            expect(nodes[13].pid).toBe(nodes[0].id)            
                expect(nodes[14].name).toBe("C-1")
                expect(nodes[14].pid).toBe(nodes[13].id)
                expect(nodes[15].name).toBe("C-2")
                expect(nodes[15].pid).toBe(nodes[13].id)
                expect(nodes[16].name).toBe("C-3")
                expect(nodes[16].pid).toBe(nodes[13].id)
                expect(nodes[17].name).toBe("C-4")
                expect(nodes[17].pid).toBe(nodes[13].id)
                expect(nodes[18].name).toBe("C-5")
                expect(nodes[18].pid).toBe(nodes[13].id)


            expect(nodes[19].name).toBe("D")
            expect(nodes[19].pid).toBe(nodes[0].id)
                expect(nodes[20].name).toBe("D-1")
                expect(nodes[20].pid).toBe(nodes[19].id)
                expect(nodes[21].name).toBe("D-2")
                expect(nodes[21].pid).toBe(nodes[19].id)
                expect(nodes[22].name).toBe("D-3")
                expect(nodes[22].pid).toBe(nodes[19].id)
                expect(nodes[23].name).toBe("D-4")
                expect(nodes[23].pid).toBe(nodes[19].id)
                expect(nodes[24].name).toBe("D-5")
                expect(nodes[24].pid).toBe(nodes[19].id)

            expect(nodes[25].name).toBe("E")
            expect(nodes[25].pid).toBe(nodes[0].id)
                expect(nodes[26].name).toBe("E-1")
                expect(nodes[26].pid).toBe(nodes[25].id)
                expect(nodes[27].name).toBe("E-2")
                expect(nodes[27].pid).toBe(nodes[25].id)
                expect(nodes[28].name).toBe("E-3")
                expect(nodes[28].pid).toBe(nodes[25].id)
                expect(nodes[29].name).toBe("E-4")
                expect(nodes[29].pid).toBe(nodes[25].id)
                expect(nodes[30].name).toBe("E-5")
                expect(nodes[30].pid).toBe(nodes[25].id)

            expect(nodes[31].name).toBe("F")
            expect(nodes[31].pid).toBe(nodes[0].id)
                expect(nodes[32].name).toBe("F-1")
                expect(nodes[32].pid).toBe(nodes[31].id)
                expect(nodes[33].name).toBe("F-2")
                expect(nodes[33].pid).toBe(nodes[31].id)
                expect(nodes[34].name).toBe("F-3")
                expect(nodes[34].pid).toBe(nodes[31].id)
                expect(nodes[35].name).toBe("F-4")
                expect(nodes[35].pid).toBe(nodes[31].id)
                expect(nodes[36].name).toBe("F-5")
                expect(nodes[36].pid).toBe(nodes[31].id) 
    
        })
        test("导出A节点为List格式时",async ()=>{
            let nodes = tree.getByPath("A")!.toList()
            let nodeCount = await tree.manager.getDescendantCount(nodes[0].id)

            expect(nodes[0].name).toBe("A")
            expect(nodes[0].pid).toBe(tree.root!.id)    

            for(let i=1;i<6;i++){
                const name = "A"+ "-" + i    
                expect(nodes[i + 5*(i-1)].name).toBe(name)          
                expect(nodes[i + 5*(i-1)].pid).toBe(nodes[0].id)

                for(let j=1;j<6;j++){
                    const name = "A" + "-" + i + "-" + j
                    expect(nodes[i + 5*(i-1) + j].name).toBe(name)
                    expect(nodes[i + 5*(i-1) + j].pid).toBe(nodes[i + 5*(i-1)].id)
                }
                
            }
        })
        test("导出A节点为List格式时限定层级",async ()=>{
            let nodes = tree.getByPath("A")!.toList()
            expect(nodes[0].name).toBe("A")
            expect(nodes[0].pid).toBe(tree.root!.id)    

            for(let i=1;i<6;i++){
                const name = "A"+ "-" + i    
                expect(nodes[i + 5*(i-1)].name).toBe(name)          
                expect(nodes[i + 5*(i-1)].pid).toBe(nodes[0].id)

                for(let j=1;j<6;j++){
                    const name = "A" + "-" + i + "-" + j
                    expect(nodes[i + 5*(i-1) + j].name).toBe(name)
                    expect(nodes[i + 5*(i-1) + j].pid).toBe(nodes[i + 5*(i-1)].id)
                }
                
            }
        })
    })
    

})