import { test,describe,beforeEach, expect,  afterEach } from "vitest" 
import { createDemoTree, createFlexTree, dumpTree,ReturnPromiseType } from "../common";
 

describe("访问树节点实例", () => {
    
    let tree:ReturnPromiseType<typeof createFlexTree>
    beforeEach(async () => {
        tree = await createFlexTree()        
        await createDemoTree(tree.manager)
        await tree.load()
    })    
    afterEach(async ()=>{ 
        await dumpTree(tree.manager.driver.db,"create.root.db")
    })
 
    test("同步节点数据",async ()=>{ 
        await tree.load()
        const root = tree.root!
        expect(root.name).toBe("root") 
        await tree.manager.write(async ()=>{            
            await tree.manager.update({...root.data,name:"ROOT"})
            expect(root.name).toBe("root")
            await root.sync()
            expect(root.name).toBe("ROOT")
        })        
    })
 
    test("根据路径获取节点实例",async ()=>{  
        const root = tree.root!        
        expect(root.getByPath("/")).toBe(root)
        expect(root.getByPath("./")).toBe(root)
        expect(root.getByPath("./A")?.name).toBe("A")
        expect(root.getByPath("./A/A-1")?.name).toBe("A-1")
        expect(root.getByPath("./A/A-1/A-1-1")?.name).toBe("A-1-1")
        expect(root.getByPath("A")?.name).toBe("A")
        expect(root.getByPath("A/A-1")?.name).toBe("A-1")
        expect(root.getByPath("A/A-1/A-1-1")?.name).toBe("A-1-1")

        const a11 = root.getByPath("A/A-1/A-1-1")!

        expect(a11.getByPath("./")?.name).toBe(a11.name)
        expect(a11.getByPath("../")?.name).toBe("A-1")
        expect(a11.getByPath("../../")?.name).toBe("A")
        expect(a11.getByPath("../../../")?.name).toBe("root")

        const b1 = root.getByPath("B")!
        expect(b1.getByPath("../A")?.name).toBe("A")
        expect(b1.getByPath("../A/A-1")?.name).toBe("A-1")
        expect(b1.getByPath("../A/A-1/A-1-1")?.name).toBe("A-1-1")

        expect(b1.getByPath("B-1")?.name).toBe("B-1")
        expect(b1.getByPath("B-1/B-1-1")?.name).toBe("B-1-1")
    })

    test("更新节点数据",async ()=>{  
        const root = tree.root!
        expect(root.name).toBe("root")
        await root.update({name:"ROOT"})
        expect(root.name).toBe("ROOT")
    })
    test("根据节点id获取节点实例",async ()=>{ 
        const a = tree.find(node=>node.name=="A")[0]
        expect(tree.get(a!.id)).toBe(a)
        const anodes = tree.find(node=>node.name.startsWith("A"))
        for(let node of anodes){
            const n = tree.get(node.id)!            
            expect(n.name.startsWith("A")).toBe(true)
        }
    })

    test("在节点后代中根据id获取节点实例",async ()=>{ 
        const a = tree.find(node=>node.name=="A")[0]
        const a11 = tree.find(node=>node.name=="A-1-1")[0]
        expect(a.get(a11.id)).toBe(undefined) 
        expect(a.get(a11.id,true)).toBe(a11) 
    })

    test("访问节点的兄弟节点",async ()=>{
        const a = tree.find(node=>node.name=="A-1")[0]

        const siblings =  a.siblings!

        expect(siblings.length).toBe(4)
        expect(siblings[0].name).toBe("A-2")
        expect(siblings[1].name).toBe("A-3")
        expect(siblings[2].name).toBe("A-4")
        expect(siblings[3].name).toBe("A-5")
    })
    test("访问节点的祖先节点",async ()=>{
        
        const a12 = tree.find(node=>node.name=="A-1-2")[0]

        const ancestors =  a12.ancestors!
        expect(ancestors.length).toBe(3) 
        expect(ancestors[0].name).toBe("root")
        expect(ancestors[1].name).toBe("A")
        expect(ancestors[2].name).toBe("A-1") 
    })
    test("访问节点的后代节点",async ()=>{
        
        const a = tree.find(node=>node.name=="A")[0]

        const descendants =  a.descendants!
        for(let node of descendants){
            expect(node.name.startsWith("A")).toBe(true)
        }
    })

})


