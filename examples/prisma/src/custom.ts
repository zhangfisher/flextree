import { FlexTreeManager } from 'flextree'
import PrismaAdapter from '@flextree/prisma'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const tree = new FlexTreeManager<{ 
        size: number
    },
    {
        id:['pk',number],
        treeId:['tree',number],
        name:"title",
        leftValue:'lft',
        rightValue:'rgt'
    }>('org', {
        adapter: new PrismaAdapter(prisma),
        fields:{
            id:'pk',
            treeId:'tree',
            name:'title',
            leftValue:'lft',
            rightValue:"rgt"
        }
    })
    // 所有涉及到修改树的操作需要放在write方法里面执行
    await tree.write(async () => {
        await tree.clear()
        await tree.createRoot({ title: 'root' })
        await tree.addNodes([
            { title: 'A' },
            { title: 'B' },
            { title: 'C' },
            { title: 'D' },
        ])
    })
    const nodes = await tree.getNodes()

    console.log(nodes)
}

main().then(() => {
    console.log('tree done.')
})

export {}
