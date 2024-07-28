import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { ReturnPromiseType } from '../utils/createTree'
import { createDemoTree, createFlexTree, dumpTree } from '../utils/createTree'
import { createCustomDemoTree, createCustomFlexTree, dumpCustomTree } from './createCustomTree'

describe('自定义关键字段-导出树', () => {
    let tree: ReturnPromiseType<typeof createCustomFlexTree>
    beforeEach(async () => {
        tree = await createCustomFlexTree()
        await createCustomDemoTree(tree.manager)
        await tree.load()
    })
    afterEach(async () => {
        await dumpCustomTree(tree.manager.adapter.db, 'export.db')
    })
    describe('自定义关键字段-toJson导出树', () => {
        test('导出整棵树为JSON嵌套格式', async () => {
            const data = tree.root!.toJson()
            expect(data.title).toBe('root')

            expect(data.children?.length).toBe(tree.root?.children?.length)

            // 比较导出的数据与tree树的数据是否一致
            data.children?.forEach((child, index) => {
                expect(child.title).toBe(tree.root?.children![index].name)
            })

            const keys = Object.keys(data)
            expect(keys.length).toBe(4)
            expect(keys.includes('title')).toBe(true)
            expect(keys.includes('pk')).toBe(true)
            expect(keys.includes('children')).toBe(true)
            expect(keys.includes('size')).toBe(true)
        })

        test('自定义关键字段-导出整棵树为JSON嵌套格式时限定级别', async () => {
            let data = tree.root!.toJson({ level: 1 })
            expect(data.title).toBe('root')
            expect(data.children).toBeUndefined()

            data = tree.root!.toJson({ level: 2 })
            expect(data.title).toBe('root')
            expect(data.children?.length).toBe(tree.root?.children?.length)
            data.children!.forEach((child) => {
			    expect(child.children).toBeUndefined()
            })

            data = tree.root!.toJson({ level: 3 })
            expect(data.title).toBe('root')
            expect(data.children?.length).toBe(tree.root?.children?.length)
            data.children!.forEach((child) => {
			    expect(child.children?.length).toBe(5)
                child.children!.forEach((subChild) => {
                    expect(subChild.children).toBeUndefined()
                })
            })
        })
        test('自定义关键字段-导出整棵树为JSON嵌套格式时指定输出字段', async () => {
            const data = tree.root!.toJson({
                fields: ['title', 'pk'],
            })
            expect(data.title).toBe('root')
            expect(data.children?.length).toBe(tree.root?.children?.length)
            // 比较导出的数据与tree树的数据是否一致
            data.children?.forEach((child, index) => {
                expect(child.title).toBe(tree.root?.children![index].name)
            })
            const keys = Object.keys(data)
            expect(keys.length).toBe(3)
            expect(keys.includes('title')).toBe(true)
            expect(keys.includes('pk')).toBe(true)
            expect(keys.includes('children')).toBe(true)
        })
    })
    describe('自定义关键字段-toList导出树', () => {
        test('自定义关键字段-导出整棵树为PID格式', async () => {
            const nodes = tree.root!.toList()

            expect(nodes[0].title).toBe('root')
            expect(nodes[0].pid).toBe(0)

            expect(nodes[1].title).toBe('A')
            expect(nodes[1].pid).toBe(nodes[0].pk)

            expect(nodes[2].title).toBe('A-1')
            expect(nodes[2].pid).toBe(nodes[1].pk)
            expect(nodes[3].title).toBe('A-1-1')
            expect(nodes[3].pid).toBe(nodes[2].pk)
            expect(nodes[4].title).toBe('A-1-2')
            expect(nodes[4].pid).toBe(nodes[2].pk)
            expect(nodes[5].title).toBe('A-1-3')
            expect(nodes[5].pid).toBe(nodes[2].pk)
            expect(nodes[6].title).toBe('A-1-4')
            expect(nodes[6].pid).toBe(nodes[2].pk)
            expect(nodes[7].title).toBe('A-1-5')
            expect(nodes[7].pid).toBe(nodes[2].pk)

            expect(nodes[8].title).toBe('A-2')
            expect(nodes[8].pid).toBe(nodes[1].pk)
            expect(nodes[9].title).toBe('A-2-1')
            expect(nodes[9].pid).toBe(nodes[8].pk)
            expect(nodes[10].title).toBe('A-2-2')
            expect(nodes[10].pid).toBe(nodes[8].pk)
            expect(nodes[11].title).toBe('A-2-3')
            expect(nodes[11].pid).toBe(nodes[8].pk)
            expect(nodes[12].title).toBe('A-2-4')
            expect(nodes[12].pid).toBe(nodes[8].pk)
            expect(nodes[13].title).toBe('A-2-5')
            expect(nodes[13].pid).toBe(nodes[8].pk)
        })
        test('自定义关键字段-导出整棵树为List格式时限定级别', async () => {
            let nodes = tree.root!.toList({ level: 1 })
            expect(nodes[0].title).toBe('root')

            nodes = tree.root!.toList({ level: 2 })

            expect(nodes[0].title).toBe('root')
            expect(nodes[0].pid).toBe(0)
            expect(nodes[1].title).toBe('A')
            expect(nodes[1].pid).toBe(nodes[0].pk)
            expect(nodes[2].title).toBe('B')
            expect(nodes[2].pid).toBe(nodes[0].pk)
            expect(nodes[3].title).toBe('C')
            expect(nodes[3].pid).toBe(nodes[0].pk)
            expect(nodes[4].title).toBe('D')
            expect(nodes[4].pid).toBe(nodes[0].pk)
            expect(nodes[5].title).toBe('E')
            expect(nodes[5].pid).toBe(nodes[0].pk)
            expect(nodes[6].title).toBe('F')
            expect(nodes[6].pid).toBe(nodes[0].pk)

            nodes = tree.root!.toList({ level: 3 })

            expect(nodes[0].title).toBe('root')
            expect(nodes[0].pid).toBe(0)
            expect(nodes[1].title).toBe('A')
            expect(nodes[1].pid).toBe(nodes[0].pk)
            expect(nodes[2].title).toBe('A-1')
            expect(nodes[2].pid).toBe(nodes[1].pk)
            expect(nodes[3].title).toBe('A-2')
            expect(nodes[3].pid).toBe(nodes[1].pk)
            expect(nodes[4].title).toBe('A-3')
            expect(nodes[4].pid).toBe(nodes[1].pk)
            expect(nodes[5].title).toBe('A-4')
            expect(nodes[5].pid).toBe(nodes[1].pk)
            expect(nodes[6].title).toBe('A-5')
            expect(nodes[6].pid).toBe(nodes[1].pk)

            expect(nodes[7].title).toBe('B')
            expect(nodes[7].pid).toBe(nodes[0].pk)
            expect(nodes[8].title).toBe('B-1')
            expect(nodes[8].pid).toBe(nodes[7].pk)
            expect(nodes[9].title).toBe('B-2')
            expect(nodes[9].pid).toBe(nodes[7].pk)
            expect(nodes[10].title).toBe('B-3')
            expect(nodes[10].pid).toBe(nodes[7].pk)
            expect(nodes[11].title).toBe('B-4')
            expect(nodes[11].pid).toBe(nodes[7].pk)
            expect(nodes[12].title).toBe('B-5')
            expect(nodes[12].pid).toBe(nodes[7].pk)

            expect(nodes[13].title).toBe('C')
            expect(nodes[13].pid).toBe(nodes[0].pk)
            expect(nodes[14].title).toBe('C-1')
            expect(nodes[14].pid).toBe(nodes[13].pk)
            expect(nodes[15].title).toBe('C-2')
            expect(nodes[15].pid).toBe(nodes[13].pk)
            expect(nodes[16].title).toBe('C-3')
            expect(nodes[16].pid).toBe(nodes[13].pk)
            expect(nodes[17].title).toBe('C-4')
            expect(nodes[17].pid).toBe(nodes[13].pk)
            expect(nodes[18].title).toBe('C-5')
            expect(nodes[18].pid).toBe(nodes[13].pk)

            expect(nodes[19].title).toBe('D')
            expect(nodes[19].pid).toBe(nodes[0].pk)
            expect(nodes[20].title).toBe('D-1')
            expect(nodes[20].pid).toBe(nodes[19].pk)
            expect(nodes[21].title).toBe('D-2')
            expect(nodes[21].pid).toBe(nodes[19].pk)
            expect(nodes[22].title).toBe('D-3')
            expect(nodes[22].pid).toBe(nodes[19].pk)
            expect(nodes[23].title).toBe('D-4')
            expect(nodes[23].pid).toBe(nodes[19].pk)
            expect(nodes[24].title).toBe('D-5')
            expect(nodes[24].pid).toBe(nodes[19].pk)

            expect(nodes[25].title).toBe('E')
            expect(nodes[25].pid).toBe(nodes[0].pk)
            expect(nodes[26].title).toBe('E-1')
            expect(nodes[26].pid).toBe(nodes[25].pk)
            expect(nodes[27].title).toBe('E-2')
            expect(nodes[27].pid).toBe(nodes[25].pk)
            expect(nodes[28].title).toBe('E-3')
            expect(nodes[28].pid).toBe(nodes[25].pk)
            expect(nodes[29].title).toBe('E-4')
            expect(nodes[29].pid).toBe(nodes[25].pk)
            expect(nodes[30].title).toBe('E-5')
            expect(nodes[30].pid).toBe(nodes[25].pk)

            expect(nodes[31].title).toBe('F')
            expect(nodes[31].pid).toBe(nodes[0].pk)
            expect(nodes[32].title).toBe('F-1')
            expect(nodes[32].pid).toBe(nodes[31].pk)
            expect(nodes[33].title).toBe('F-2')
            expect(nodes[33].pid).toBe(nodes[31].pk)
            expect(nodes[34].title).toBe('F-3')
            expect(nodes[34].pid).toBe(nodes[31].pk)
            expect(nodes[35].title).toBe('F-4')
            expect(nodes[35].pid).toBe(nodes[31].pk)
            expect(nodes[36].title).toBe('F-5')
            expect(nodes[36].pid).toBe(nodes[31].pk)
        })
        test('自定义关键字段-导出A节点为List格式时', async () => {
            const nodes = tree.getByPath('A')!.toList()
            const nodeCount = await tree.manager.getDescendantCount(nodes[0].pk)
            expect(nodes.length).toBe(nodeCount + 1)
            expect(nodes[0].title).toBe('A')
            expect(nodes[0].pid).toBe(tree.root!.id)

            for (let i = 1; i < 6; i++) {
                const name = `A-${i}`
                expect(nodes[i + 5 * (i - 1)].title).toBe(name)
                expect(nodes[i + 5 * (i - 1)].pid).toBe(nodes[0].pk)

                for (let j = 1; j < 6; j++) {
                    const name = `A-${i}-${j}`
                    expect(nodes[i + 5 * (i - 1) + j].title).toBe(name)
                    expect(nodes[i + 5 * (i - 1) + j].pid).toBe(nodes[i + 5 * (i - 1)].pk)
                }
            }
        })
        test('自定义关键字段-导出A节点为List格式时限定层级', async () => {
            const nodes = tree.getByPath('A')!.toList()
            expect(nodes[0].title).toBe('A')
            expect(nodes[0].pid).toBe(tree.root!.id)

            for (let i = 1; i < 6; i++) {
                const name = `A-${i}`
                expect(nodes[i + 5 * (i - 1)].title).toBe(name)
                expect(nodes[i + 5 * (i - 1)].pid).toBe(nodes[0].pk)

                for (let j = 1; j < 6; j++) {
                    const name = `A-${i}-${j}`
                    expect(nodes[i + 5 * (i - 1) + j].title).toBe(name)
                    expect(nodes[i + 5 * (i - 1) + j].pid).toBe(nodes[i + 5 * (i - 1)].pk)
                }
            }
        })
    })
})
