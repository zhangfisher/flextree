import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { DemoFlexTree } from './createTree'
import { createDemoTree, createFlexTree, dumpTree, verifyTree } from './createTree'

describe('访问树对象实例', () => {
    let tree: DemoFlexTree
    beforeEach(async () => {
        tree = await createFlexTree()
        await createDemoTree(tree.manager)
    })
    afterEach(async () => {
        await dumpTree(tree.manager.adapter.db, 'create.root.db')
    })

    test('加载树到树对象实例中', async () => {
        await tree.load()
        expect(tree.root).not.toBe(null)
        expect(tree.root!.name).toBe('root')
        expect(tree.root!.level).toBe(0)

        const names = ['A', 'B', 'C', 'D', 'E', 'F']

        for (let i = 0; i < names.length; i++) {
            const node = tree.root!.children![i]
            expect(node).not.toBe(null)
            expect(node!.name).toBe(names[i])
            expect(node!.level).toBe(tree.root!.level + 1)

            const children = node.children!
            // A-1,A-2,A-3,A-4,A-5
            for (let j = 0; j < children.length; j++) {
                const child = children[j]
                expect(child).not.toBe(null)
                expect(child!.name).toBe(`${names[i]}-${j + 1}`)
                expect(child!.level).toBe(node.level + 1)

                const gchildren = child.children!
                // A-1-1,A-1-2,A-1-3,A-1-4,A-1-5
                for (let k = 0; k < gchildren.length; k++) {
                    const gchild = gchildren[k]
                    expect(gchild).not.toBe(null)
                    expect(gchild!.name).toBe(`${names[i]}-${j + 1}-${k + 1}`)
                    expect(gchild!.level).toBe(child.level + 1)
                }
            }
        }
        await verifyTree(tree.manager)
    })

    test('同步节点数据', async () => {
        await tree.load()
        const root = tree.root!
        expect(root.name).toBe('root')
        await tree.manager.write(async () => {
            await tree.manager.update({ ...root.data, name: 'ROOT' })
            expect(root.name).toBe('root')
            await root.sync()
            expect(root.name).toBe('ROOT')
        })
    })

    test('根据路径获取节点实例', async () => {
        await tree.load()
        const root = tree.root!
        expect(root.getByPath('/')).toBe(root)
        expect(root.getByPath('./')).toBe(root)
        expect(root.getByPath('./A')?.name).toBe('A')
        expect(root.getByPath('./A/A-1')?.name).toBe('A-1')
        expect(root.getByPath('./A/A-1/A-1-1')?.name).toBe('A-1-1')
        expect(root.getByPath('A')?.name).toBe('A')
        expect(root.getByPath('A/A-1')?.name).toBe('A-1')
        expect(root.getByPath('A/A-1/A-1-1')?.name).toBe('A-1-1')

        const a11 = root.getByPath('A/A-1/A-1-1')!

        expect(a11.getByPath('./')?.name).toBe(a11.name)
        expect(a11.getByPath('../')?.name).toBe('A-1')
        expect(a11.getByPath('../../')?.name).toBe('A')
        expect(a11.getByPath('../../../')?.name).toBe('root')

        const b1 = root.getByPath('B')!
        expect(b1.getByPath('../A')?.name).toBe('A')
        expect(b1.getByPath('../A/A-1')?.name).toBe('A-1')
        expect(b1.getByPath('../A/A-1/A-1-1')?.name).toBe('A-1-1')

        expect(b1.getByPath('B-1')?.name).toBe('B-1')
        expect(b1.getByPath('B-1/B-1-1')?.name).toBe('B-1-1')
    })
    test('根据节点id获取节点实例', async () => {
        await tree.load()
        const nodes = await tree.manager.getNodes()
        for (const node of nodes) {
            const n = tree.get(node.id)!
            expect(n).not.toBe(null)
            expect(n.name).toBe(node.name)
            expect(n.id).toBe(node.id)
        }
    })
    test('更新节点数据', async () => {
        await tree.load()
        const root = tree.root!
        expect(root.name).toBe('root')
        await root.update({ name: 'ROOT' })
        expect(root.name).toBe('ROOT')
    })
})
