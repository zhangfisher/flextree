import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { FlexTreeNodeRelation } from 'flextree'
import type { DemoFlexTreeManager } from '../utils/createTree'
import { createDemoTree, createTreeManager, dumpTree, verifyTree } from '../utils/createTree'

describe('查询节点关系', () => {
    let tree: DemoFlexTreeManager
    beforeEach(async () => {
        tree = await createTreeManager()
        await createDemoTree(tree)
        await verifyTree(tree)
    })
    afterEach(async () => {
        await dumpTree(tree.adapter.db, 'relation.db')
    })
    test('返回自己关系', async () => {
        const a1 = await tree.findNode({ name: 'A-1' })
        expect(await tree.getNodeRelation(a1, a1)).toBe(FlexTreeNodeRelation.Self)
    })
    test('返回后代关系', async () => {
        const a = await tree.findNode({ name: 'A' })
        const a1 = await tree.findNode({ name: 'A-1-1' })
        const a2 = await tree.findNode({ name: 'A-2-1' })
        const a3 = await tree.findNode({ name: 'A-3-1' })
        expect(await tree.getNodeRelation(a1, a)).toBe(FlexTreeNodeRelation.Descendants)
        expect(await tree.getNodeRelation(a2, a)).toBe(FlexTreeNodeRelation.Descendants)
        expect(await tree.getNodeRelation(a3, a)).toBe(FlexTreeNodeRelation.Descendants)
    })
    test('返回祖先关系', async () => {
        const a = await tree.findNode({ name: 'A' })
        const a1 = await tree.findNode({ name: 'A-1-1' })
        const a2 = await tree.findNode({ name: 'A-2-1' })
        const a3 = await tree.findNode({ name: 'A-3-1' })
        expect(await tree.getNodeRelation(a, a1)).toBe(FlexTreeNodeRelation.Ancestors)
        expect(await tree.getNodeRelation(a, a2)).toBe(FlexTreeNodeRelation.Ancestors)
        expect(await tree.getNodeRelation(a, a3)).toBe(FlexTreeNodeRelation.Ancestors)
    })
    test('返回兄弟节点关系', async () => {
        const a1 = await tree.findNode({ name: 'A-1' })
        const a2 = await tree.findNode({ name: 'A-2' })
        const a3 = await tree.findNode({ name: 'A-3' })

        expect(await tree.getNodeRelation(a1, a2)).toBe(FlexTreeNodeRelation.Siblings)
        expect(await tree.getNodeRelation(a2, a3)).toBe(FlexTreeNodeRelation.Siblings)
        expect(await tree.getNodeRelation(a1, a3)).toBe(FlexTreeNodeRelation.Siblings)

        const a11 = await tree.findNode({ name: 'A-1-1' })
        const a12 = await tree.findNode({ name: 'A-1-2' })
        const a13 = await tree.findNode({ name: 'A-1-3' })

        expect(await tree.getNodeRelation(a11, a12)).toBe(FlexTreeNodeRelation.Siblings)
        expect(await tree.getNodeRelation(a12, a13)).toBe(FlexTreeNodeRelation.Siblings)

        const nonSiblings = [
            await tree.getRoot(),
            await tree.findNode({ name: 'A' }),
            await tree.findNode({ name: 'A-1-1' }),
            await tree.findNode({ name: 'A-1-2' }),
            await tree.findNode({ name: 'B' }),
            await tree.findNode({ name: 'B-1' }),
            await tree.findNode({ name: 'B-1-1' }),
        ]
        // a1跟所有非兄弟节点的关系都不是兄弟
        for (const node of nonSiblings) {
            expect(await tree.getNodeRelation(a1, node)).not.toBe(FlexTreeNodeRelation.Siblings)
        }
    })
    test('返回同级节点关系', async () => {
        const a1 = await tree.findNode({ name: 'A-1' })
        const b2 = await tree.findNode({ name: 'B-2' })
        const c3 = await tree.findNode({ name: 'C-3' })
        expect(await tree.getNodeRelation(a1, b2)).toBe(FlexTreeNodeRelation.SameLevel)
        expect(await tree.getNodeRelation(b2, c3)).toBe(FlexTreeNodeRelation.SameLevel)
        expect(await tree.getNodeRelation(a1, c3)).toBe(FlexTreeNodeRelation.SameLevel)
    })

    test('返回同一棵树关系', async () => {
        const a = await tree.findNode({ name: 'A-1' })
        const b = await tree.findNode({ name: 'B-1-1' })
        expect(await tree.getNodeRelation(a, b)).toBe(FlexTreeNodeRelation.SameTree)
    })

    // test("返回父节点关系",async ()=>{
    //     const a = await tree.findNode({name:"A"})
    //     const a1 = await  tree.findNode({name:"A-1"})
    //     const a2 = await  tree.findNode({name:"A-2"})
    //     const a3 = await  tree.findNode({name:"A-3"})
    //     expect(await tree.getNodeRelation(a,a1)).toBe(FlexTreeNodeRelation.Parent)
    //     expect(await tree.getNodeRelation(a,a2)).toBe(FlexTreeNodeRelation.Parent)
    //     expect(await tree.getNodeRelation(a,a3)).toBe(FlexTreeNodeRelation.Parent)
    // })
    // test("返回子节点关系",async ()=>{
    //     const a = await tree.findNode({name:"A"})
    //     const a1 = await  tree.findNode({name:"A-1"})
    //     const a2 = await  tree.findNode({name:"A-2"})
    //     const a3 = await  tree.findNode({name:"A-3"})
    //     expect(await tree.getNodeRelation(a1,a)).toBe(FlexTreeNodeRelation.Child)
    //     expect(await tree.getNodeRelation(a2,a)).toBe(FlexTreeNodeRelation.Child)
    //     expect(await tree.getNodeRelation(a3,a)).toBe(FlexTreeNodeRelation.Child)
    // })
})
