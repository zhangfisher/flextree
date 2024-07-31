import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createCustomDemoTree, createCustomTreeManager, CustomDemoFlexTreeManager, dumpCustomTree } from './createCustomTree'

describe('自定义关键字段-删除树节点', () => {
    let tree: CustomDemoFlexTreeManager
    beforeEach(async () => {
        tree = await createCustomTreeManager()
        await createCustomDemoTree(tree, { level: 2 })
    })
    afterEach(async () => {
       // await dumpCustomTree(tree.adapter.db, 'delete.db')
    })
    test('自定义关键字段-依次删除所有子节点', async () => {
        // 删除A_1
        const a1 = await tree.findNode({ title: 'A-1' })
        await tree.write(async () => {
            await tree.deleteNode(a1)
        })
        let a = await tree.findNode({ title: 'A' })
        expect((a.rgt - a.lft - 1) / 2).toBe(4)

        let aChildren = await tree.getChildren(a.pk)
        expect(aChildren.length).toBe(4)

        // 删除A_2
        const a2 = await tree.findNode({ title: 'A-2' })
        await tree.write(async () => {
            await tree.deleteNode(a2)
        })
        a = await tree.findNode({ title: 'A' }) // 由于删除了A_2节点会导致A节点的左右值变化，所以需要重新获取A节点
        expect((a.rgt - a.lft - 1) / 2).toBe(3)
        aChildren = await tree.getChildren(a.pk)
        expect(aChildren.length).toBe(3)

        // 删除A_3
        const a3 = await tree.findNode({ title: 'A-3' })
        await tree.write(async () => {
            await tree.deleteNode(a3)
        })
        a = await tree.findNode({ title: 'A' }) // 由于删除了A_3节点会导致A节点的左右值变化，所以需要重新获取A节点
        expect((a.rgt - a.lft - 1) / 2).toBe(2)
        aChildren = await tree.getChildren(a.pk)
        expect(aChildren.length).toBe(2)

        // 删除A_4
        const a4 = await tree.findNode({ title: 'A-4' })
        await tree.write(async () => {
            await tree.deleteNode(a4)
        })
        a = await tree.findNode({ title: 'A' }) // 由于删除了A_4节点会导致A节点的左右值变化，所以需要重新获取A节点
        expect((a.rgt - a.lft - 1) / 2).toBe(1)
        aChildren = await tree.getChildren(a.pk)
        expect(aChildren.length).toBe(1)

        // 删除A_5
        const a5 = await tree.findNode({ title: 'A-5' })
        await tree.write(async () => {
            await tree.deleteNode(a5)
        })
        a = await tree.findNode({ title: 'A' }) // 由于删除了A_5节点会导致A节点的左右值变化，所以需要重新获取A节点
        expect((a.rgt - a.lft - 1) / 2).toBe(0)
        aChildren = await tree.getChildren(a.pk)
        expect(aChildren.length).toBe(0)
    })
    test('自定义关键字段-删除节点及所有子节点', async () => {
        // 删除A
        let nodes = await tree.getNodes()
        const oldCount = nodes.length
        const a = await tree.findNode({ title: 'A' })
        const deleteCount = (a.rgt - a.lft - 1) / 2 + 1
        await tree.write(async () => {
            await tree.deleteNode(a)
        })
        nodes = await tree.getNodes()
        expect(nodes.length).toBe(oldCount - deleteCount)
    })
    test('自定义关键字段-删除所有节点包括根节点', async () => {
        const root = await tree.findNode({ title: 'root' })
        await tree.write(async () => {
            await tree.deleteNode(root)
        })
        const nodes = await tree.getNodes()
        expect(nodes.length).toBe(0)
    })
    test('自定义关键字段-只标注删除节点及所有子节点', async () => {
        // 删除A
        let nodes = await tree.getNodes()
        const oldCount = nodes.length
        const a = await tree.findNode({ title: 'A' })
        const deleteCount = (a.rgt - a.lft - 1) / 2 + 1
        await tree.write(async () => {
            await tree.deleteNode(a, { onlyMark: true })
        })
        nodes = await tree.getNodes()
        expect(nodes.length).toBe(oldCount - deleteCount)
        const rows = await tree.adapter.getRows('select * from tree where lft<0 and rgt<0')
        expect(rows.length).toBe(deleteCount)
    })
})
