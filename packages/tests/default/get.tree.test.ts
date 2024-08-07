import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { DemoFlexTreeManager } from './createTree'
import { createDemoTree, createTreeManager, dumpTree } from './createTree'

describe('访问树', () => {
    let tree: DemoFlexTreeManager
    let nodeCount: number = 0
    beforeEach(async () => {
        tree = await createTreeManager()
        nodeCount = await createDemoTree(tree)
    })
    afterEach(async () => {
        //await dumpTree(tree.adapter.db, 'get.db')
    })
    test('检查根节点是否存在', async () => {
        expect(await tree.hasRoot()).toBe(true)
        const root = (await tree.getRoot())!
        expect(root).not.toBe(null)
        expect(root.level).toBe(0)
        expect(root.leftValue).toBe(1)
    })
    test('获取后代节点', async () => {
        const root = (await tree.getRoot())!
        let descendants = await tree.getDescendants(root)
        expect(descendants.length).toBe(nodeCount - 1)

        descendants = await tree.getDescendants(root, { includeSelf: true })
        expect(descendants.length).toBe(nodeCount)
        //
        descendants = await tree.getDescendants(root, { level: 1, includeSelf: true })
        expect(descendants.length).toBe(7)

        descendants = await tree.getDescendants(root, { level: 2 })
        expect(descendants.length).toBe(6 + 5 * 6)

        descendants = await tree.getDescendants(root, { level: 2, includeSelf: true })
        expect(descendants.length).toBe(6 + 5 * 6 + 1)

        descendants = await tree.getDescendants(root, { level: 3 })
        expect(descendants.length).toBe(6 + 5 * 6 + 5 * 5 * 6)

        descendants = await tree.getDescendants(root, { level: 3, includeSelf: true })
        expect(descendants.length).toBe(6 + 5 * 6 + 5 * 5 * 6 + 1)
    })

    test('获取后代节点数量', async () => {
        const root = (await tree.getRoot())!
        let descendantCount = await tree.getDescendantCount(root)
        expect(descendantCount).toBe(nodeCount - 1)

        descendantCount = await tree.getDescendantCount(root, { level: 1 })
        expect(descendantCount).toBe(6)

        descendantCount = await tree.getDescendantCount(root, { level: 2 })
        expect(descendantCount).toBe(6 + 5 * 6)

        descendantCount = await tree.getDescendantCount(root, { level: 3 })
        expect(descendantCount).toBe(6 + 5 * 6 + 5 * 5 * 6)

        const children = await tree.getChildren(root) // A,B,C,D,E,F

        for (let i = 0; i < children.length; i++) {
            const count = await tree.getDescendantCount(children[i])
            expect(count).toBe(5 + 5 * 5)
        }
        for (let i = 0; i < children.length; i++) {
            const count = await tree.getDescendantCount(children[i], { level: 1 })
            expect(count).toBe(5)
        }
    })

    test('获取子节点', async () => {
        const root = await tree.getRoot()
        const children = await tree.getChildren(root)
        expect(children.length).toBe(6)
        for (let i = 0; i < children.length; i++) {
            const subchildren = await tree.getChildren(children[i])
            expect(subchildren.length).toBe(5)
        }
    })

    test('获取祖先节点', async () => {
        const root = await tree.getRoot()
        const children = await tree.getChildren(root)
        for (let i = 0; i < children.length; i++) {
            const ancestors = await tree.getAncestors(children[i])
            expect(ancestors.length).toBe(1)
            expect(ancestors[0]).toStrictEqual(root)
        }
        for (let i = 0; i < children.length; i++) {
            const ancestors = await tree.getAncestors(children[i], { includeSelf: true })
            expect(ancestors.length).toBe(2)
            expect(ancestors[0]).toStrictEqual(root)
        }
        const names = ['A', 'B', 'C', 'D', 'E', 'F']

        for (const name of names) {
            for (let i = 0; i < 5; i++) {
                const node = await tree.findNode({ name: `${name}-1-${i + 1}` })
                const ancestors = await tree.getAncestors(node)
                expect(ancestors.length).toBe(3)
                expect(ancestors[0].name).toBe('root')
                expect(ancestors[1].name).toBe(name)
                expect(ancestors[2].name).toBe(`${name}-1`)
            }
        }
    })
    test('获取父节点', async () => {
        const root = await tree.getRoot()
        const a = await tree.findNode({ name: 'A' })
        const a1 = await tree.findNode({ name: 'A-1' })
        const a11 = await tree.findNode({ name: 'A-1-1' })
        const b = await tree.findNode({ name: 'B' })
        const b1 = await tree.findNode({ name: 'B-1' })
        const b11 = await tree.findNode({ name: 'B-1-1' })

        expect(await tree.getParent(a)).toStrictEqual(root)
        expect(await tree.getParent(a1)).toStrictEqual(a)
        expect(await tree.getParent(a11)).toStrictEqual(a1)

        expect(await tree.getParent(b)).toStrictEqual(root)
        expect(await tree.getParent(b1)).toStrictEqual(b)
        expect(await tree.getParent(b11)).toStrictEqual(b1)
    })

    test('获取兄弟节点', async () => {
        const a = await tree.findNode({ name: 'A' })
        let siblings = await tree.getSiblings(a)
        expect(siblings.length).toBe(5)
        expect(siblings.map(node => node.name).join(',')).toStrictEqual('B,C,D,E,F')

        siblings = await tree.getSiblings(a, { includeSelf: true })
        expect(siblings.length).toBe(6)
        expect(siblings.map(node => node.name).join(',')).toStrictEqual('A,B,C,D,E,F')
    })

    test('获取下一个兄弟节点', async () => {
        const a = await tree.findNode({ name: 'A' })
        const b = await tree.findNode({ name: 'B' })
        const c = await tree.findNode({ name: 'C' })
        const d = await tree.findNode({ name: 'D' })
        const e = await tree.findNode({ name: 'E' })
        const f = await tree.findNode({ name: 'F' })
        expect(await tree.getNextSibling(a)).toStrictEqual(b)
        expect(await tree.getNextSibling(b)).toStrictEqual(c)
        expect(await tree.getNextSibling(c)).toStrictEqual(d)
        expect(await tree.getNextSibling(d)).toStrictEqual(e)
        expect(await tree.getNextSibling(e)).toStrictEqual(f)
        expect(await tree.getNextSibling(f)).toBe(null)
    })

    test('获取上一个兄弟节点', async () => {
        const a = await tree.findNode({ name: 'A' })
        const b = await tree.findNode({ name: 'B' })
        const c = await tree.findNode({ name: 'C' })
        const d = await tree.findNode({ name: 'D' })
        const e = await tree.findNode({ name: 'E' })
        const f = await tree.findNode({ name: 'F' })
        expect(await tree.getPreviousSibling(a)).toBe(null)
        expect(await tree.getPreviousSibling(b)).toStrictEqual(a)
        expect(await tree.getPreviousSibling(c)).toStrictEqual(b)
        expect(await tree.getPreviousSibling(d)).toStrictEqual(c)
        expect(await tree.getPreviousSibling(e)).toStrictEqual(d)
        expect(await tree.getPreviousSibling(f)).toStrictEqual(e)
    })

    describe('获取第几个子节点', async () => {
        test('获取第n个子节点', async () => {
            const a = await tree.findNode({ name: 'A' })
            const a1 = await tree.findNode({ name: 'A-1' })
            const a2 = await tree.findNode({ name: 'A-2' })
            const a3 = await tree.findNode({ name: 'A-3' })
            const a4 = await tree.findNode({ name: 'A-4' })
            const a5 = await tree.findNode({ name: 'A-5' })
            expect(await tree.getNthChild(a, 1)).toStrictEqual(a1)
            expect(await tree.getNthChild(a, 2)).toStrictEqual(a2)
            expect(await tree.getNthChild(a, 3)).toStrictEqual(a3)
            expect(await tree.getNthChild(a, 4)).toStrictEqual(a4)
            expect(await tree.getNthChild(a, 5)).toStrictEqual(a5)
        })
        test('获取第n个子节点,但n值无效', async () => {
            const a = await tree.findNode({ name: 'A' })
            expect(await tree.getNthChild(a, 110)).toBe(undefined)
        })
        test('获取倒数第n个子节点', async () => {
            const a = await tree.findNode({ name: 'A' })
            const a1 = await tree.findNode({ name: 'A-1' })
            const a2 = await tree.findNode({ name: 'A-2' })
            const a3 = await tree.findNode({ name: 'A-3' })
            const a4 = await tree.findNode({ name: 'A-4' })
            const a5 = await tree.findNode({ name: 'A-5' })
            expect(await tree.getNthChild(a, -1)).toStrictEqual(a5)
            expect(await tree.getNthChild(a, -2)).toStrictEqual(a4)
            expect(await tree.getNthChild(a, -3)).toStrictEqual(a3)
            expect(await tree.getNthChild(a, -4)).toStrictEqual(a2)
            expect(await tree.getNthChild(a, -5)).toStrictEqual(a1)
        })
    })
})
