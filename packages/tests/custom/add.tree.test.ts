import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { FlexNodeRelPosition, FlexTreeNodeError, NextSibling, PreviousSibling } from 'flextree'
import type { CustomDemoFlexTreeManager } from './createCustomTree'
import { createCustomTreeManager, dumpCustomTree } from './createCustomTree'

describe('自定义-添加树节点', () => {
    describe('创建根节点', () => {
        let tree: CustomDemoFlexTreeManager
        beforeEach(async () => {
            tree = await createCustomTreeManager()
        })
        afterEach(async () => {
            await dumpCustomTree(tree.adapter.db, 'add.db')
        })
        test('单树表中创建根节点', async () => {
            await tree.write(async () => await tree.createRoot({ title: 'root' }))
            const root = await tree.getRoot()
            expect(root).not.toBeNull()
            expect(root.title).toBe('root')
            expect(root.level).toBe(0)
            expect(root.lft).toBe(1)
            expect(root.rgt).toBe(2)
        })

        test('单树表中创建根节点时如果已存在则触发错误', async () => {
            await tree.write(async () => await tree.createRoot({ title: 'root' }))
            expect(tree.write(async () => await tree.createRoot({ title: 'root2' }))).rejects.toThrow(FlexTreeNodeError)
        })
        test('判定是否存在根节点', async () => {
            await tree.write(async () => await tree.createRoot({ title: 'root' }))
            const result = await tree.hasRoot()
            expect(result).toBe(true)
        })
    })

    describe('添加最后的子节点', () => {
        let tree: CustomDemoFlexTreeManager
        beforeEach(async () => {
            tree = await createCustomTreeManager()
            await tree.write(async () => await tree.createRoot({ title: 'root' }))
        })

        afterEach(async () => {
            await dumpCustomTree(tree.adapter.db, 'create.lastchild.db')
        })
        test('在根节点下创建最后的子节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([
                    { title: 'A' },
                    { title: 'B' },
                    { title: 'C' },
                ])
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(4)
            expect(nodes[1].title).toBe('A')
            expect(nodes[2].title).toBe('B')
            expect(nodes[3].title).toBe('C')

            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(8)
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(3)
            expect(nodes[2].lft).toBe(4)
            expect(nodes[2].rgt).toBe(5)
            expect(nodes[3].lft).toBe(6)
            expect(nodes[3].rgt).toBe(7)

            expect(nodes[0].level).toBe(0)
            expect(nodes[1].level).toBe(1)
            expect(nodes[2].level).toBe(1)
            expect(nodes[3].level).toBe(1)
        })
        test('多次在根节点下创建最后的子节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ title: 'A' }])
                await tree.addNodes([{ title: 'B' }])
                await tree.addNodes([{ title: 'C' }])
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(4)
            expect(nodes[1].title).toBe('A')
            expect(nodes[2].title).toBe('B')
            expect(nodes[3].title).toBe('C')

            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(8)
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(3)
            expect(nodes[2].lft).toBe(4)
            expect(nodes[2].rgt).toBe(5)
            expect(nodes[3].lft).toBe(6)
            expect(nodes[3].rgt).toBe(7)

            expect(nodes[0].level).toBe(0)
            expect(nodes[1].level).toBe(1)
            expect(nodes[2].level).toBe(1)
            expect(nodes[3].level).toBe(1)
        })
        test('在多个节点下均创建最后的子节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ pk: 2, title: 'A' }])
                await tree.addNodes([{ pk: 3, title: 'B' }])
                await tree.addNodes([{ pk: 4, title: 'C' }])

                await tree.addNodes([{ title: 'C1' }], 4)
                await tree.addNodes([{ title: 'C2' }], 4)
                await tree.addNodes([{ title: 'C3' }], 4)

                await tree.addNodes([{ title: 'B1' }], 3)
                await tree.addNodes([{ title: 'B2' }], 3)
                await tree.addNodes([{ title: 'B3' }], 3)

                await tree.addNodes([{ title: 'A1' }], 2)
                await tree.addNodes([{ title: 'A2' }], 2)
                await tree.addNodes([{ title: 'A3' }], 2)
            })
            const nodes = await tree.getNodes()

            expect(nodes).toHaveLength(13)
            expect(nodes[0].title).toBe('root')
            expect(nodes[1].title).toBe('A')
            expect(nodes[2].title).toBe('A1')
            expect(nodes[3].title).toBe('A2')
            expect(nodes[4].title).toBe('A3')
            expect(nodes[5].title).toBe('B')
            expect(nodes[6].title).toBe('B1')
            expect(nodes[7].title).toBe('B2')
            expect(nodes[8].title).toBe('B3')
            expect(nodes[9].title).toBe('C')
            expect(nodes[10].title).toBe('C1')
            expect(nodes[11].title).toBe('C2')
            expect(nodes[12].title).toBe('C3')

            // Root
            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(26)
            expect(nodes[0].level).toBe(0)
            // A
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(9)
            expect(nodes[1].level).toBe(1)
            // A1
            expect(nodes[2].lft).toBe(3)
            expect(nodes[2].rgt).toBe(4)
            expect(nodes[3].level).toBe(2)
            // A2
            expect(nodes[3].lft).toBe(5)
            expect(nodes[3].rgt).toBe(6)
            expect(nodes[3].level).toBe(2)

            // A3
            expect(nodes[4].lft).toBe(7)
            expect(nodes[4].rgt).toBe(8)
            expect(nodes[4].level).toBe(2)
            // B
            expect(nodes[5].lft).toBe(10)
            expect(nodes[5].rgt).toBe(17)
            expect(nodes[5].level).toBe(1)
            // B1
            expect(nodes[6].lft).toBe(11)
            expect(nodes[6].rgt).toBe(12)
            expect(nodes[6].level).toBe(2)
            // B2
            expect(nodes[7].lft).toBe(13)
            expect(nodes[7].rgt).toBe(14)
            expect(nodes[7].level).toBe(2)
            // B3
            expect(nodes[8].lft).toBe(15)
            expect(nodes[8].rgt).toBe(16)
            expect(nodes[8].level).toBe(2)
            // C
            expect(nodes[9].lft).toBe(18)
            expect(nodes[9].rgt).toBe(25)
            expect(nodes[9].level).toBe(1)
            // C1
            expect(nodes[10].lft).toBe(19)
            expect(nodes[10].rgt).toBe(20)
            expect(nodes[10].level).toBe(2)
            // C2
            expect(nodes[11].lft).toBe(21)
            expect(nodes[11].rgt).toBe(22)
            expect(nodes[11].level).toBe(2)

            // C3
            expect(nodes[12].lft).toBe(23)
            expect(nodes[12].rgt).toBe(24)
            expect(nodes[12].level).toBe(2)
        })
    })
    describe('添加子节点集的最前面', () => {
        let tree: CustomDemoFlexTreeManager
        beforeEach(async () => {
            tree = await createCustomTreeManager()
            await tree.write(async () => await tree.createRoot({ title: 'root' }))
        })
        afterEach(async () => {
            await dumpCustomTree(tree.adapter.db, 'create.firstchild.db')
        })
        test('在根节点依次添加子节点到最前面', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ title: 'A' }], null, FlexNodeRelPosition.FirstChild)
                await tree.addNodes([{ title: 'B' }], null, FlexNodeRelPosition.FirstChild)
                await tree.addNodes([{ title: 'C' }], null, FlexNodeRelPosition.FirstChild)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(4)
            expect(nodes[1].title).toBe('C')
            expect(nodes[2].title).toBe('B')
            expect(nodes[3].title).toBe('A')

            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(8)
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(3)
            expect(nodes[2].lft).toBe(4)
            expect(nodes[2].rgt).toBe(5)
            expect(nodes[3].lft).toBe(6)
            expect(nodes[3].rgt).toBe(7)

            expect(nodes[0].level).toBe(0)
            expect(nodes[1].level).toBe(1)
            expect(nodes[2].level).toBe(1)
            expect(nodes[3].level).toBe(1)
        })
        test('一次性在根节点添加子节点到最前面', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ title: 'A' }, { title: 'B' }, { title: 'C' }], null, FlexNodeRelPosition.FirstChild)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(4)
            expect(nodes[1].title).toBe('A')
            expect(nodes[2].title).toBe('B')
            expect(nodes[3].title).toBe('C')

            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(8)
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(3)
            expect(nodes[2].lft).toBe(4)
            expect(nodes[2].rgt).toBe(5)
            expect(nodes[3].lft).toBe(6)
            expect(nodes[3].rgt).toBe(7)

            expect(nodes[0].level).toBe(0)
            expect(nodes[1].level).toBe(1)
            expect(nodes[2].level).toBe(1)
            expect(nodes[3].level).toBe(1)
        })
        test('在多级节点下添加多个子节点到最前面', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ pk: 2, title: 'A' }, { pk: 3, title: 'B' }, { pk: 4, title: 'C' }])
                await tree.addNodes([{ title: 'A1' }, { title: 'A2' }, { title: 'A3' }], 2, FlexNodeRelPosition.FirstChild)
                await tree.addNodes([{ title: 'B1' }, { title: 'B2' }, { title: 'B3' }], 3, FlexNodeRelPosition.FirstChild)
                await tree.addNodes([{ title: 'C1' }, { title: 'C2' }, { title: 'C3' }], 4, FlexNodeRelPosition.FirstChild)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(13)
            expect(nodes[0].title).toBe('root')
            expect(nodes[1].title).toBe('A')
            expect(nodes[2].title).toBe('A1')
            expect(nodes[3].title).toBe('A2')
            expect(nodes[4].title).toBe('A3')
            expect(nodes[5].title).toBe('B')
            expect(nodes[6].title).toBe('B1')
            expect(nodes[7].title).toBe('B2')
            expect(nodes[8].title).toBe('B3')
            expect(nodes[9].title).toBe('C')
            expect(nodes[10].title).toBe('C1')
            expect(nodes[11].title).toBe('C2')
            expect(nodes[12].title).toBe('C3')

            // Root
            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(26)
            expect(nodes[0].level).toBe(0)
            // A
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(9)
            expect(nodes[1].level).toBe(1)
            // A1
            expect(nodes[2].lft).toBe(3)
            expect(nodes[2].rgt).toBe(4)
            expect(nodes[2].level).toBe(2)
            // A2
            expect(nodes[3].lft).toBe(5)
            expect(nodes[3].rgt).toBe(6)
            expect(nodes[3].level).toBe(2)
            // A3
            expect(nodes[4].lft).toBe(7)
            expect(nodes[4].rgt).toBe(8)
            expect(nodes[4].level).toBe(2)
            // B
            expect(nodes[5].lft).toBe(10)
            expect(nodes[5].rgt).toBe(17)
            expect(nodes[5].level).toBe(1)
            // B1
            expect(nodes[6].lft).toBe(11)
            expect(nodes[6].rgt).toBe(12)
            expect(nodes[6].level).toBe(2)
            // B2
            expect(nodes[7].lft).toBe(13)
            expect(nodes[7].rgt).toBe(14)
            expect(nodes[7].level).toBe(2)
            // B3
            expect(nodes[8].lft).toBe(15)
            expect(nodes[8].rgt).toBe(16)
            expect(nodes[8].level).toBe(2)
            // C
            expect(nodes[9].lft).toBe(18)
            expect(nodes[9].rgt).toBe(25)
            expect(nodes[9].level).toBe(1)
            // C1
            expect(nodes[10].lft).toBe(19)
            expect(nodes[10].rgt).toBe(20)
            expect(nodes[10].level).toBe(2)
            // C2
            expect(nodes[11].lft).toBe(21)
            expect(nodes[11].rgt).toBe(22)
            expect(nodes[11].level).toBe(2)
            // C3
            expect(nodes[12].lft).toBe(23)
            expect(nodes[12].rgt).toBe(24)
            expect(nodes[12].level).toBe(2)
        })
    })

    describe('添加节点为目标节点的兄弟节点', () => {
        let tree: CustomDemoFlexTreeManager
        beforeEach(async () => {
            tree = await createCustomTreeManager()
            await tree.write(async () => {
                await tree.createRoot({ title: 'root' })
                await tree.addNodes([{ pk: 2, title: 'X' }])
            })
        })

        afterEach(async () => {
            await dumpCustomTree(tree.adapter.db, 'create.next.sibling.db')
        })
        test('一性能添加多个兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ title: 'A' }, { title: 'B' }, { title: 'C' }], 2, NextSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(5)
            expect(nodes[1].title).toBe('X')
            expect(nodes[2].title).toBe('A')
            expect(nodes[3].title).toBe('B')
            expect(nodes[4].title).toBe('C')
            // Root
            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(10)
            expect(nodes[0].level).toBe(0)
            // X
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(3)
            expect(nodes[1].level).toBe(1)
            // A
            expect(nodes[2].lft).toBe(4)
            expect(nodes[2].rgt).toBe(5)
            expect(nodes[2].level).toBe(1)
            // B
            expect(nodes[3].lft).toBe(6)
            expect(nodes[3].rgt).toBe(7)
            expect(nodes[3].level).toBe(1)
            // C
            expect(nodes[4].lft).toBe(8)
            expect(nodes[4].rgt).toBe(9)
            expect(nodes[4].level).toBe(1)
        })
        test('多次添加多个兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ title: 'A' }], 2, NextSibling)
                await tree.addNodes([{ title: 'B' }], 2, NextSibling)
                await tree.addNodes([{ title: 'C' }], 2, NextSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(5)
            expect(nodes[1].title).toBe('X')
            expect(nodes[2].title).toBe('C')
            expect(nodes[3].title).toBe('B')
            expect(nodes[4].title).toBe('A')
            // Root
            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(10)
            expect(nodes[0].level).toBe(0)
            // X
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(3)
            expect(nodes[1].level).toBe(1)
            // A
            expect(nodes[2].lft).toBe(4)
            expect(nodes[2].rgt).toBe(5)
            expect(nodes[2].level).toBe(1)
            // B
            expect(nodes[3].lft).toBe(6)
            expect(nodes[3].rgt).toBe(7)
            expect(nodes[3].level).toBe(1)
            // C
            expect(nodes[4].lft).toBe(8)
            expect(nodes[4].rgt).toBe(9)
            expect(nodes[4].level).toBe(1)
        })
        test('顺序多次添加多个兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ pk: 100, title: 'A' }], 2, NextSibling)
                await tree.addNodes([{ pk: 101, title: 'B' }], 100, NextSibling)
                await tree.addNodes([{ title: 'C' }], 101, NextSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(5)
            expect(nodes[1].title).toBe('X')
            expect(nodes[2].title).toBe('A')
            expect(nodes[3].title).toBe('B')
            expect(nodes[4].title).toBe('C')
            // Root
            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(10)
            expect(nodes[0].level).toBe(0)
            // X
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(3)
            expect(nodes[1].level).toBe(1)
            // A
            expect(nodes[2].lft).toBe(4)
            expect(nodes[2].rgt).toBe(5)
            expect(nodes[2].level).toBe(1)
            // B
            expect(nodes[3].lft).toBe(6)
            expect(nodes[3].rgt).toBe(7)
            expect(nodes[3].level).toBe(1)
            // C
            expect(nodes[4].lft).toBe(8)
            expect(nodes[4].rgt).toBe(9)
            expect(nodes[4].level).toBe(1)
        })

        test('在多级树中多次添加多个兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ pk: 3, title: 'A' }])
                await tree.addNodes([{ pk: 4, title: 'B' }])
                await tree.addNodes([{ pk: 5, title: 'C' }])

                await tree.addNodes([{ title: 'A1' }], 3, NextSibling)
                await tree.addNodes([{ title: 'A2' }], 3, NextSibling)
                await tree.addNodes([{ title: 'A3' }], 3, NextSibling)

                await tree.addNodes([{ title: 'B1' }], 4, NextSibling)
                await tree.addNodes([{ title: 'B2' }], 4, NextSibling)
                await tree.addNodes([{ title: 'B3' }], 4, NextSibling)

                await tree.addNodes([{ title: 'C1' }], 5, NextSibling)
                await tree.addNodes([{ title: 'C2' }], 5, NextSibling)
                await tree.addNodes([{ title: 'C3' }], 5, NextSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(14)
            expect(nodes[0].title).toBe('root')
            expect(nodes[1].title).toBe('X')
            expect(nodes[2].title).toBe('A')
            expect(nodes[3].title).toBe('A3')
            expect(nodes[4].title).toBe('A2')
            expect(nodes[5].title).toBe('A1')
            expect(nodes[6].title).toBe('B')
            expect(nodes[7].title).toBe('B3')
            expect(nodes[8].title).toBe('B2')
            expect(nodes[9].title).toBe('B1')
            expect(nodes[10].title).toBe('C')
            expect(nodes[11].title).toBe('C3')
            expect(nodes[12].title).toBe('C2')
            expect(nodes[13].title).toBe('C1')

            for (let i = 1; i < 13; i++) {
                expect(nodes[i].level).toBe(1)
                expect(nodes[i].lft).toBe(i * 2)
                expect(nodes[i].rgt).toBe(i * 2 + 1)
            }
        })
        test('在多级树中添加兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ pk: 3, title: 'A' }], 2)
                await tree.addNodes([{ pk: 4, title: 'AA' }], 3)
                await tree.addNodes([{ pk: 5, title: 'AAA' }], 4)
                await tree.addNodes([{ pk: 6, title: 'X1' }], 5)
                await tree.addNodes([{ title: 'X5' }], 6, NextSibling)
                await tree.addNodes([{ title: 'X4' }], 6, NextSibling)
                await tree.addNodes([{ title: 'X3' }], 6, NextSibling)
                await tree.addNodes([{ title: 'X2' }], 6, NextSibling)
            })
        })
    })
    describe('添加节点为目标节点的上一个兄弟节点', () => {
        let tree: CustomDemoFlexTreeManager
        beforeEach(async () => {
            tree = await createCustomTreeManager()
            await tree.write(async () => {
                await tree.createRoot({ title: 'root' })
                await tree.addNodes([{ pk: 2, title: 'X' }])
            })
        })
        afterEach(async () => {
            await dumpCustomTree(tree.adapter.db, 'create.previous.sibling.db')
        })
        test('一性次添加多个节点到X节点前', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ title: 'A' }, { title: 'B' }, { title: 'C' }], 2, PreviousSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(5)
            expect(nodes[1].title).toBe('A')
            expect(nodes[2].title).toBe('B')
            expect(nodes[3].title).toBe('C')
            expect(nodes[4].title).toBe('X')
            // Root
            expect(nodes[0].lft).toBe(1)
            expect(nodes[0].rgt).toBe(10)
            expect(nodes[0].level).toBe(0)
            // A
            expect(nodes[1].lft).toBe(2)
            expect(nodes[1].rgt).toBe(3)
            expect(nodes[1].level).toBe(1)
            // B
            expect(nodes[2].lft).toBe(4)
            expect(nodes[2].rgt).toBe(5)
            expect(nodes[2].level).toBe(1)
            // C
            expect(nodes[3].lft).toBe(6)
            expect(nodes[3].rgt).toBe(7)
            expect(nodes[3].level).toBe(1)
            // X
            expect(nodes[4].lft).toBe(8)
            expect(nodes[4].rgt).toBe(9)
            expect(nodes[4].level).toBe(1)
        })
        test('多次添加多个节点到X节点前', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ title: 'A' }], 2, PreviousSibling)
                await tree.addNodes([{ title: 'B' }], 2, PreviousSibling)
                await tree.addNodes([{ title: 'C' }], 2, PreviousSibling)

                const nodes = await tree.getNodes()
                expect(nodes).toHaveLength(5)
                expect(nodes[1].title).toBe('A')
                expect(nodes[2].title).toBe('B')
                expect(nodes[3].title).toBe('C')
                expect(nodes[4].title).toBe('X')
                // Root
                expect(nodes[0].lft).toBe(1)
                expect(nodes[0].rgt).toBe(10)
                expect(nodes[0].level).toBe(0)
                // C
                expect(nodes[1].lft).toBe(2)
                expect(nodes[1].rgt).toBe(3)
                expect(nodes[1].level).toBe(1)
                // B
                expect(nodes[2].lft).toBe(4)
                expect(nodes[2].rgt).toBe(5)
                expect(nodes[2].level).toBe(1)
                // A
                expect(nodes[3].lft).toBe(6)
                expect(nodes[3].rgt).toBe(7)
                expect(nodes[3].level).toBe(1)
                // X
                expect(nodes[4].lft).toBe(8)
                expect(nodes[4].rgt).toBe(9)
                expect(nodes[4].level).toBe(1)
            })
        })
    })
})
