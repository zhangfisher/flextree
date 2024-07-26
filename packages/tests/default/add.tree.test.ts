import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { FlexTreeManager } from 'flextree'
import { FlexNodeRelPosition, FlexTreeNodeError, NextSibling, PreviousSibling } from 'flextree'
import type { DemoFlexTreeManager } from '../common'
import { createTreeManager, dumpTree } from '../common'

describe('添加树节点', () => {
    describe('创建根节点', () => {
        let tree: DemoFlexTreeManager
        beforeEach(async () => {
            tree = await createTreeManager()
        })
        afterEach(async () => {
            await dumpTree(tree.driver.db, 'create.root.db')
        })
        test('单树表中创建根节点', async () => {
            await tree.write(async () => await tree.createRoot({ name: 'root' }))
            const root = await tree.getRoot()
            expect(root).not.toBeNull()
            expect(root.name).toBe('root')
            expect(root.level).toBe(0)
            expect(root.leftValue).toBe(1)
            expect(root.rightValue).toBe(2)
        })

        test('单树表中创建根节点时如果已存在则触发错误', async () => {
            await tree.write(async () => await tree.createRoot({ name: 'root' }))
            expect(tree.write(async () => await tree.createRoot({ name: 'root2' }))).rejects.toThrow(FlexTreeNodeError)
        })
        test('判定是否存在根节点', async () => {
            await tree.write(async () => await tree.createRoot({ name: 'root' }))
            const result = await tree.hasRoot()
            expect(result).toBe(true)
        })
    })

    describe('添加最后的子节点', () => {
        let tree: FlexTreeManager
        beforeEach(async () => {
            tree = await createTreeManager()
            await tree.write(async () => await tree.createRoot({ name: 'root' }))
        })

        afterEach(async () => {
            await dumpTree(tree.driver.db, 'create.lastchild.db')
        })
        test('在根节点下创建最后的子节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([
                    { name: 'A' },
                    { name: 'B' },
                    { name: 'C' },
                ])
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(4)
            expect(nodes[1].name).toBe('A')
            expect(nodes[2].name).toBe('B')
            expect(nodes[3].name).toBe('C')

            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(8)
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(3)
            expect(nodes[2].leftValue).toBe(4)
            expect(nodes[2].rightValue).toBe(5)
            expect(nodes[3].leftValue).toBe(6)
            expect(nodes[3].rightValue).toBe(7)

            expect(nodes[0].level).toBe(0)
            expect(nodes[1].level).toBe(1)
            expect(nodes[2].level).toBe(1)
            expect(nodes[3].level).toBe(1)
        })
        test('多次在根节点下创建最后的子节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ name: 'A' }])
                await tree.addNodes([{ name: 'B' }])
                await tree.addNodes([{ name: 'C' }])
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(4)
            expect(nodes[1].name).toBe('A')
            expect(nodes[2].name).toBe('B')
            expect(nodes[3].name).toBe('C')

            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(8)
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(3)
            expect(nodes[2].leftValue).toBe(4)
            expect(nodes[2].rightValue).toBe(5)
            expect(nodes[3].leftValue).toBe(6)
            expect(nodes[3].rightValue).toBe(7)

            expect(nodes[0].level).toBe(0)
            expect(nodes[1].level).toBe(1)
            expect(nodes[2].level).toBe(1)
            expect(nodes[3].level).toBe(1)
        })
        test('在多个节点下均创建最后的子节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ id: 2, name: 'A' }])
                await tree.addNodes([{ id: 3, name: 'B' }])
                await tree.addNodes([{ id: 4, name: 'C' }])

                await tree.addNodes([{ name: 'C1' }], 4)
                await tree.addNodes([{ name: 'C2' }], 4)
                await tree.addNodes([{ name: 'C3' }], 4)

                await tree.addNodes([{ name: 'B1' }], 3)
                await tree.addNodes([{ name: 'B2' }], 3)
                await tree.addNodes([{ name: 'B3' }], 3)

                await tree.addNodes([{ name: 'A1' }], 2)
                await tree.addNodes([{ name: 'A2' }], 2)
                await tree.addNodes([{ name: 'A3' }], 2)
            })
            const nodes = await tree.getNodes()

            expect(nodes).toHaveLength(13)
            expect(nodes[0].name).toBe('root')
            expect(nodes[1].name).toBe('A')
            expect(nodes[2].name).toBe('A1')
            expect(nodes[3].name).toBe('A2')
            expect(nodes[4].name).toBe('A3')
            expect(nodes[5].name).toBe('B')
            expect(nodes[6].name).toBe('B1')
            expect(nodes[7].name).toBe('B2')
            expect(nodes[8].name).toBe('B3')
            expect(nodes[9].name).toBe('C')
            expect(nodes[10].name).toBe('C1')
            expect(nodes[11].name).toBe('C2')
            expect(nodes[12].name).toBe('C3')

            // Root
            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(26)
            expect(nodes[0].level).toBe(0)
            // A
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(9)
            expect(nodes[1].level).toBe(1)
            // A1
            expect(nodes[2].leftValue).toBe(3)
            expect(nodes[2].rightValue).toBe(4)
            expect(nodes[3].level).toBe(2)
            // A2
            expect(nodes[3].leftValue).toBe(5)
            expect(nodes[3].rightValue).toBe(6)
            expect(nodes[3].level).toBe(2)

            // A3
            expect(nodes[4].leftValue).toBe(7)
            expect(nodes[4].rightValue).toBe(8)
            expect(nodes[4].level).toBe(2)
            // B
            expect(nodes[5].leftValue).toBe(10)
            expect(nodes[5].rightValue).toBe(17)
            expect(nodes[5].level).toBe(1)
            // B1
            expect(nodes[6].leftValue).toBe(11)
            expect(nodes[6].rightValue).toBe(12)
            expect(nodes[6].level).toBe(2)
            // B2
            expect(nodes[7].leftValue).toBe(13)
            expect(nodes[7].rightValue).toBe(14)
            expect(nodes[7].level).toBe(2)
            // B3
            expect(nodes[8].leftValue).toBe(15)
            expect(nodes[8].rightValue).toBe(16)
            expect(nodes[8].level).toBe(2)
            // C
            expect(nodes[9].leftValue).toBe(18)
            expect(nodes[9].rightValue).toBe(25)
            expect(nodes[9].level).toBe(1)
            // C1
            expect(nodes[10].leftValue).toBe(19)
            expect(nodes[10].rightValue).toBe(20)
            expect(nodes[10].level).toBe(2)
            // C2
            expect(nodes[11].leftValue).toBe(21)
            expect(nodes[11].rightValue).toBe(22)
            expect(nodes[11].level).toBe(2)

            // C3
            expect(nodes[12].leftValue).toBe(23)
            expect(nodes[12].rightValue).toBe(24)
            expect(nodes[12].level).toBe(2)
        })
    })
    describe('添加子节点集的最前面', () => {
        let tree: FlexTreeManager
        beforeEach(async () => {
            tree = await createTreeManager()
            await tree.write(async () => await tree.createRoot({ name: 'root' }))
        })
        afterEach(async () => {
            await dumpTree(tree.driver.db, 'create.firstchild.db')
        })
        test('在根节点依次添加子节点到最前面', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ name: 'A' }], null, FlexNodeRelPosition.FirstChild)
                await tree.addNodes([{ name: 'B' }], null, FlexNodeRelPosition.FirstChild)
                await tree.addNodes([{ name: 'C' }], null, FlexNodeRelPosition.FirstChild)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(4)
            expect(nodes[1].name).toBe('C')
            expect(nodes[2].name).toBe('B')
            expect(nodes[3].name).toBe('A')

            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(8)
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(3)
            expect(nodes[2].leftValue).toBe(4)
            expect(nodes[2].rightValue).toBe(5)
            expect(nodes[3].leftValue).toBe(6)
            expect(nodes[3].rightValue).toBe(7)

            expect(nodes[0].level).toBe(0)
            expect(nodes[1].level).toBe(1)
            expect(nodes[2].level).toBe(1)
            expect(nodes[3].level).toBe(1)
        })
        test('一次性在根节点添加子节点到最前面', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ name: 'A' }, { name: 'B' }, { name: 'C' }], null, FlexNodeRelPosition.FirstChild)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(4)
            expect(nodes[1].name).toBe('A')
            expect(nodes[2].name).toBe('B')
            expect(nodes[3].name).toBe('C')

            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(8)
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(3)
            expect(nodes[2].leftValue).toBe(4)
            expect(nodes[2].rightValue).toBe(5)
            expect(nodes[3].leftValue).toBe(6)
            expect(nodes[3].rightValue).toBe(7)

            expect(nodes[0].level).toBe(0)
            expect(nodes[1].level).toBe(1)
            expect(nodes[2].level).toBe(1)
            expect(nodes[3].level).toBe(1)
        })
        test('在多级节点下添加多个子节点到最前面', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ id: 2, name: 'A' }, { id: 3, name: 'B' }, { id: 4, name: 'C' }])
                await tree.addNodes([{ name: 'A1' }, { name: 'A2' }, { name: 'A3' }], 2, FlexNodeRelPosition.FirstChild)
                await tree.addNodes([{ name: 'B1' }, { name: 'B2' }, { name: 'B3' }], 3, FlexNodeRelPosition.FirstChild)
                await tree.addNodes([{ name: 'C1' }, { name: 'C2' }, { name: 'C3' }], 4, FlexNodeRelPosition.FirstChild)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(13)
            expect(nodes[0].name).toBe('root')
            expect(nodes[1].name).toBe('A')
            expect(nodes[2].name).toBe('A1')
            expect(nodes[3].name).toBe('A2')
            expect(nodes[4].name).toBe('A3')
            expect(nodes[5].name).toBe('B')
            expect(nodes[6].name).toBe('B1')
            expect(nodes[7].name).toBe('B2')
            expect(nodes[8].name).toBe('B3')
            expect(nodes[9].name).toBe('C')
            expect(nodes[10].name).toBe('C1')
            expect(nodes[11].name).toBe('C2')
            expect(nodes[12].name).toBe('C3')

            // Root
            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(26)
            expect(nodes[0].level).toBe(0)
            // A
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(9)
            expect(nodes[1].level).toBe(1)
            // A1
            expect(nodes[2].leftValue).toBe(3)
            expect(nodes[2].rightValue).toBe(4)
            expect(nodes[2].level).toBe(2)
            // A2
            expect(nodes[3].leftValue).toBe(5)
            expect(nodes[3].rightValue).toBe(6)
            expect(nodes[3].level).toBe(2)
            // A3
            expect(nodes[4].leftValue).toBe(7)
            expect(nodes[4].rightValue).toBe(8)
            expect(nodes[4].level).toBe(2)
            // B
            expect(nodes[5].leftValue).toBe(10)
            expect(nodes[5].rightValue).toBe(17)
            expect(nodes[5].level).toBe(1)
            // B1
            expect(nodes[6].leftValue).toBe(11)
            expect(nodes[6].rightValue).toBe(12)
            expect(nodes[6].level).toBe(2)
            // B2
            expect(nodes[7].leftValue).toBe(13)
            expect(nodes[7].rightValue).toBe(14)
            expect(nodes[7].level).toBe(2)
            // B3
            expect(nodes[8].leftValue).toBe(15)
            expect(nodes[8].rightValue).toBe(16)
            expect(nodes[8].level).toBe(2)
            // C
            expect(nodes[9].leftValue).toBe(18)
            expect(nodes[9].rightValue).toBe(25)
            expect(nodes[9].level).toBe(1)
            // C1
            expect(nodes[10].leftValue).toBe(19)
            expect(nodes[10].rightValue).toBe(20)
            expect(nodes[10].level).toBe(2)
            // C2
            expect(nodes[11].leftValue).toBe(21)
            expect(nodes[11].rightValue).toBe(22)
            expect(nodes[11].level).toBe(2)
            // C3
            expect(nodes[12].leftValue).toBe(23)
            expect(nodes[12].rightValue).toBe(24)
            expect(nodes[12].level).toBe(2)
        })
    })

    describe('添加节点为目标节点的兄弟节点', () => {
        let tree: FlexTreeManager
        beforeEach(async () => {
            tree = await createTreeManager()
            await tree.write(async () => {
                await tree.createRoot({ name: 'root' })
                await tree.addNodes([{ id: 2, name: 'X' }])
            })
        })

        afterEach(async () => {
            await dumpTree(tree.driver.db, 'create.next.sibling.db')
        })
        test('一性能添加多个兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 2, NextSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(5)
            expect(nodes[1].name).toBe('X')
            expect(nodes[2].name).toBe('A')
            expect(nodes[3].name).toBe('B')
            expect(nodes[4].name).toBe('C')
            // Root
            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(10)
            expect(nodes[0].level).toBe(0)
            // X
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(3)
            expect(nodes[1].level).toBe(1)
            // A
            expect(nodes[2].leftValue).toBe(4)
            expect(nodes[2].rightValue).toBe(5)
            expect(nodes[2].level).toBe(1)
            // B
            expect(nodes[3].leftValue).toBe(6)
            expect(nodes[3].rightValue).toBe(7)
            expect(nodes[3].level).toBe(1)
            // C
            expect(nodes[4].leftValue).toBe(8)
            expect(nodes[4].rightValue).toBe(9)
            expect(nodes[4].level).toBe(1)
        })
        test('多次添加多个兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ name: 'A' }], 2, NextSibling)
                await tree.addNodes([{ name: 'B' }], 2, NextSibling)
                await tree.addNodes([{ name: 'C' }], 2, NextSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(5)
            expect(nodes[1].name).toBe('X')
            expect(nodes[2].name).toBe('C')
            expect(nodes[3].name).toBe('B')
            expect(nodes[4].name).toBe('A')
            // Root
            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(10)
            expect(nodes[0].level).toBe(0)
            // X
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(3)
            expect(nodes[1].level).toBe(1)
            // A
            expect(nodes[2].leftValue).toBe(4)
            expect(nodes[2].rightValue).toBe(5)
            expect(nodes[2].level).toBe(1)
            // B
            expect(nodes[3].leftValue).toBe(6)
            expect(nodes[3].rightValue).toBe(7)
            expect(nodes[3].level).toBe(1)
            // C
            expect(nodes[4].leftValue).toBe(8)
            expect(nodes[4].rightValue).toBe(9)
            expect(nodes[4].level).toBe(1)
        })
        test('顺序多次添加多个兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ id: 100, name: 'A' }], 2, NextSibling)
                await tree.addNodes([{ id: 101, name: 'B' }], 100, NextSibling)
                await tree.addNodes([{ name: 'C' }], 101, NextSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(5)
            expect(nodes[1].name).toBe('X')
            expect(nodes[2].name).toBe('A')
            expect(nodes[3].name).toBe('B')
            expect(nodes[4].name).toBe('C')
            // Root
            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(10)
            expect(nodes[0].level).toBe(0)
            // X
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(3)
            expect(nodes[1].level).toBe(1)
            // A
            expect(nodes[2].leftValue).toBe(4)
            expect(nodes[2].rightValue).toBe(5)
            expect(nodes[2].level).toBe(1)
            // B
            expect(nodes[3].leftValue).toBe(6)
            expect(nodes[3].rightValue).toBe(7)
            expect(nodes[3].level).toBe(1)
            // C
            expect(nodes[4].leftValue).toBe(8)
            expect(nodes[4].rightValue).toBe(9)
            expect(nodes[4].level).toBe(1)
        })

        test('在多级树中多次添加多个兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ id: 3, name: 'A' }])
                await tree.addNodes([{ id: 4, name: 'B' }])
                await tree.addNodes([{ id: 5, name: 'C' }])

                await tree.addNodes([{ name: 'A1' }], 3, NextSibling)
                await tree.addNodes([{ name: 'A2' }], 3, NextSibling)
                await tree.addNodes([{ name: 'A3' }], 3, NextSibling)

                await tree.addNodes([{ name: 'B1' }], 4, NextSibling)
                await tree.addNodes([{ name: 'B2' }], 4, NextSibling)
                await tree.addNodes([{ name: 'B3' }], 4, NextSibling)

                await tree.addNodes([{ name: 'C1' }], 5, NextSibling)
                await tree.addNodes([{ name: 'C2' }], 5, NextSibling)
                await tree.addNodes([{ name: 'C3' }], 5, NextSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(14)
            expect(nodes[0].name).toBe('root')
            expect(nodes[1].name).toBe('X')
            expect(nodes[2].name).toBe('A')
            expect(nodes[3].name).toBe('A3')
            expect(nodes[4].name).toBe('A2')
            expect(nodes[5].name).toBe('A1')
            expect(nodes[6].name).toBe('B')
            expect(nodes[7].name).toBe('B3')
            expect(nodes[8].name).toBe('B2')
            expect(nodes[9].name).toBe('B1')
            expect(nodes[10].name).toBe('C')
            expect(nodes[11].name).toBe('C3')
            expect(nodes[12].name).toBe('C2')
            expect(nodes[13].name).toBe('C1')

            for (let i = 1; i < 13; i++) {
                expect(nodes[i].level).toBe(1)
                expect(nodes[i].leftValue).toBe(i * 2)
                expect(nodes[i].rightValue).toBe(i * 2 + 1)
            }
        })
        test('在多级树中添加兄弟节点', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ id: 3, name: 'A' }], 2)
                await tree.addNodes([{ id: 4, name: 'AA' }], 3)
                await tree.addNodes([{ id: 5, name: 'AAA' }], 4)
                await tree.addNodes([{ id: 6, name: 'X1' }], 5)
                await tree.addNodes([{ name: 'X5' }], 6, NextSibling)
                await tree.addNodes([{ name: 'X4' }], 6, NextSibling)
                await tree.addNodes([{ name: 'X3' }], 6, NextSibling)
                await tree.addNodes([{ name: 'X2' }], 6, NextSibling)
            })
        })
    })
    describe('添加节点为目标节点的上一个兄弟节点', () => {
        let tree: FlexTreeManager
        beforeEach(async () => {
            tree = await createTreeManager()
            await tree.write(async () => {
                await tree.createRoot({ name: 'root' })
                await tree.addNodes([{ id: 2, name: 'X' }])
            })
        })
        afterEach(async () => {
            await dumpTree(tree.driver.db, 'create.previous.sibling.db')
        })
        test('一性次添加多个节点到X节点前', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ name: 'A' }, { name: 'B' }, { name: 'C' }], 2, PreviousSibling)
            })
            const nodes = await tree.getNodes()
            expect(nodes).toHaveLength(5)
            expect(nodes[1].name).toBe('A')
            expect(nodes[2].name).toBe('B')
            expect(nodes[3].name).toBe('C')
            expect(nodes[4].name).toBe('X')
            // Root
            expect(nodes[0].leftValue).toBe(1)
            expect(nodes[0].rightValue).toBe(10)
            expect(nodes[0].level).toBe(0)
            // A
            expect(nodes[1].leftValue).toBe(2)
            expect(nodes[1].rightValue).toBe(3)
            expect(nodes[1].level).toBe(1)
            // B
            expect(nodes[2].leftValue).toBe(4)
            expect(nodes[2].rightValue).toBe(5)
            expect(nodes[2].level).toBe(1)
            // C
            expect(nodes[3].leftValue).toBe(6)
            expect(nodes[3].rightValue).toBe(7)
            expect(nodes[3].level).toBe(1)
            // X
            expect(nodes[4].leftValue).toBe(8)
            expect(nodes[4].rightValue).toBe(9)
            expect(nodes[4].level).toBe(1)
        })
        test('多次添加多个节点到X节点前', async () => {
            await tree.write(async () => {
                await tree.addNodes([{ name: 'A' }], 2, PreviousSibling)
                await tree.addNodes([{ name: 'B' }], 2, PreviousSibling)
                await tree.addNodes([{ name: 'C' }], 2, PreviousSibling)

                const nodes = await tree.getNodes()
                expect(nodes).toHaveLength(5)
                expect(nodes[1].name).toBe('A')
                expect(nodes[2].name).toBe('B')
                expect(nodes[3].name).toBe('C')
                expect(nodes[4].name).toBe('X')
                // Root
                expect(nodes[0].leftValue).toBe(1)
                expect(nodes[0].rightValue).toBe(10)
                expect(nodes[0].level).toBe(0)
                // C
                expect(nodes[1].leftValue).toBe(2)
                expect(nodes[1].rightValue).toBe(3)
                expect(nodes[1].level).toBe(1)
                // B
                expect(nodes[2].leftValue).toBe(4)
                expect(nodes[2].rightValue).toBe(5)
                expect(nodes[2].level).toBe(1)
                // A
                expect(nodes[3].leftValue).toBe(6)
                expect(nodes[3].rightValue).toBe(7)
                expect(nodes[3].level).toBe(1)
                // X
                expect(nodes[4].leftValue).toBe(8)
                expect(nodes[4].rightValue).toBe(9)
                expect(nodes[4].level).toBe(1)
            })
        })
    })
})
