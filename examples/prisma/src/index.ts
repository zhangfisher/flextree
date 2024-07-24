import { FlexTreeManager } from "flextree"
import  PrismaDriver from "@flextree/prisma"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()


async function main() {

    const tree = new FlexTreeManager("fs",{
        driver: new PrismaDriver(prisma)
    })
    // 所有涉及到修改树的操作需要放在write方法里面执行
    await tree.write(async ()=>{
        await tree.clear()
        await tree.createRoot({name:"root"})
        await tree.addNodes([
            {name:"A"},
            {name:"B"},
            {name:"C"},
            {name:"D"}
        ])        
    })    
    const nodes = await tree.getNodes()

    console.log(nodes)
}

main().then(()=>{
    console.log("tree done.")
})

export {}