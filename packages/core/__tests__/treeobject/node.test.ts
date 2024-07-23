import { test,describe,beforeEach, expect, beforeAll, afterEach } from "vitest" 
import { FlexNodeRelPosition, FlexTreeManager, FlexTreeNodeError, FlexTreeNodeRelation, NextSibling, PreviousSibling } from "../../src/index"; 
import { createDemoTree, createFlexTree, dumpTree,verifyTree } from "../common";
import { FlexTree} from "../../src/tree";


describe("访问树节点实例", () => {
    
    let tree:FlexTree 
    beforeEach(async () => {
        tree = await createFlexTree()        
        await createDemoTree(tree.manager)
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
        await tree.load()
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
        await tree.load()
        const root = tree.root!
        expect(root.name).toBe("root")
        await root.update({name:"ROOT"})
        expect(root.name).toBe("ROOT")
    })

    


})


