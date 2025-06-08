import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { ReturnPromiseType } from './createTree'
import { createDemoTree, createFlexTree, dumpTree } from './createTree'

describe('查找树节点实例', () => {
    let tree: ReturnPromiseType<typeof createFlexTree>
    beforeEach(async () => {
        tree = await createFlexTree()
        await createDemoTree(tree.manager)
        await tree.load()
    })
    afterEach(async () => {
        //  await dumpTree(tree.manager.adapter.db, 'create.root.db')
    })

    test('find查找节点 ', async () => {
        const root = tree.root!
        expect(root.name).toBe('root')
        const node = tree.find(node => {
            return node.name === 'A-1-3'
        })
        expect(node!.name).toBe('A-1-3')
    })
    test('find查找不存在的节点 ', async () => {
        const root = tree.root!
        expect(root.name).toBe('root')
        const node = tree.find(node => {
            return node.name === 'A13'
        })
        expect(node).toBeUndefined()
    })
    test('findAll查找多个 ', async () => {
        const root = tree.root!
        const nodes = tree.findAll(node => {
            return node.name.startsWith('A-1')
        })
        expect(nodes.length).toBe(6)
        expect(nodes[0].name).toBe('A-1')
        expect(nodes[1].name).toBe('A-1-1')
        expect(nodes[2].name).toBe('A-1-2')
        expect(nodes[3].name).toBe('A-1-3')
        expect(nodes[4].name).toBe('A-1-4')
        expect(nodes[5].name).toBe('A-1-5')
    })
    test('forEachDFS', () => {
        const nodes: string[] = []
        tree.forEach(node => {
            nodes.push(node.name)
        }, { mode: 'dfs' })
        expect(nodes.length).toBe(186)
        const items = ['A', 'B', 'C', 'D', 'E', 'F']
        for (let i = 0; i < items.length; i++) {
            expect(nodes[i * 31]).toBe(items[i])
            for (let j = 1; j < 6; j++) {
                expect(nodes[i * 31 + (j - 1) * 6 + 1]).toBe(items[i] + '-' + j)
                for (let k = 1; k < 6; k++) {
                    expect(nodes[i * 31 + (j - 1) * 6 + 1 + k]).toBe(items[i] + '-' + j + '-' + k)
                }
            }
        }
    })
    test('forEachBFS', () => {
        const nodes: string[] = []
        tree.forEach(node => {
            nodes.push(node.name)
        }, { mode: 'bfs' })
        const items = ['A', 'B', 'C', 'D', 'E', 'F']
        for (let i = 0; i < items.length; i++) {
            expect(nodes[i]).toBe(items[i])
        }
        for (let i = 0; i < 6; i++) {
            for (let j = 1; j < 6; j++) {
                expect(nodes[items.length - 1 + i * 5 + j]).toBe(items[i] + '-' + j)
            }
        }

        expect(nodes.length).toBe(186)
    })

})
