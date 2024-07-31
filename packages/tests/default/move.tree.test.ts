/**
 * 更新树
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { FirstChild, LastChild, NextSibling, PreviousSibling } from 'flextree'
import { FlexTreeNodeInvalidOperationError } from 'flextree'
import type { DemoFlexTreeManager } from './createTree'
import { createDemoTree, createTreeManager, dumpTree, verifyTree } from './createTree'

describe('移动树节点', () => {
    let tree: DemoFlexTreeManager
    let nodes: any[]
    let root: any
    let a: any, a1: any, a2: any, a3: any, a11: any, a12: any, a13: any
    let b: any, b1: any, b2: any, b3: any, b11: any, b12: any, b13: any
    let c: any, c1: any, c2: any, c3: any, c11: any, c12: any, c13: any
    beforeEach(async () => {
        tree = await createTreeManager()
        await createDemoTree(tree)
        nodes = await tree.getNodes()
        root = nodes.find(n => n.name === 'root')!
        a = nodes.find(n => n.name === 'A')!
        a1 = nodes.find(n => n.name === 'A-1')!
        a11 = nodes.find(n => n.name === 'A-1-1')!
        a12 = nodes.find(n => n.name === 'A-1-2')!
        a13 = nodes.find(n => n.name === 'A-1-3')!
        a2 = nodes.find(n => n.name === 'A-2')!
        a3 = nodes.find(n => n.name === 'A-3')!

        b = nodes.find(n => n.name === 'B')!
        b1 = nodes.find(n => n.name === 'B-1')!
        b11 = nodes.find(n => n.name === 'B-1-1')!
        b12 = nodes.find(n => n.name === 'B-1-2')!
        b13 = nodes.find(n => n.name === 'B-1-3')!
        b2 = nodes.find(n => n.name === 'B-2')!
        b3 = nodes.find(n => n.name === 'B-3')!

        c = nodes.find(n => n.name === 'C')!
        c1 = nodes.find(n => n.name === 'C-1')!
        c11 = nodes.find(n => n.name === 'C-1-1')!
        c12 = nodes.find(n => n.name === 'C-1-2')!
        c13 = nodes.find(n => n.name === 'C-1-3')!
        c2 = nodes.find(n => n.name === 'C-2')!
        c3 = nodes.find(n => n.name === 'C-3')!
    })
    afterEach(async () => {
       // await dumpTree(tree.adapter.db, 'move.db')
    })

    describe('判断是否允许移动节点到指定位置', () => {
        test('判定节点不允许移动到自身的任意位置', async () => {
            expect(await tree.canMoveTo(root, root)).toBe(false)
            expect(await tree.canMoveTo(a, a)).toBe(false)
            expect(await tree.canMoveTo(b, b)).toBe(false)
            expect(await tree.canMoveTo(c, c)).toBe(false)
        })

        test('判定节点不允许移动其后代节点的任意位置', async () => {
            // 不允许移动其后代的前后: 即兄弟节点
            expect(await tree.canMoveTo(root, a)).toBe(false)
            expect(await tree.canMoveTo(root, a1)).toBe(false)
            expect(await tree.canMoveTo(root, a11)).toBe(false)
            expect(await tree.canMoveTo(root, a12)).toBe(false)
            expect(await tree.canMoveTo(root, a13)).toBe(false)
            expect(await tree.canMoveTo(root, a2)).toBe(false)
            expect(await tree.canMoveTo(root, a3)).toBe(false)

            expect(await tree.canMoveTo(root, b)).toBe(false)
            expect(await tree.canMoveTo(root, b1)).toBe(false)
            expect(await tree.canMoveTo(root, b11)).toBe(false)
            expect(await tree.canMoveTo(root, b12)).toBe(false)
            expect(await tree.canMoveTo(root, b13)).toBe(false)
            expect(await tree.canMoveTo(root, b2)).toBe(false)
            expect(await tree.canMoveTo(root, b3)).toBe(false)

            expect(await tree.canMoveTo(root, c)).toBe(false)
            expect(await tree.canMoveTo(root, c1)).toBe(false)
            expect(await tree.canMoveTo(root, c11)).toBe(false)
            expect(await tree.canMoveTo(root, c12)).toBe(false)
            expect(await tree.canMoveTo(root, c13)).toBe(false)
            expect(await tree.canMoveTo(root, c2)).toBe(false)
            expect(await tree.canMoveTo(root, c3)).toBe(false)
            // A
            expect(await tree.canMoveTo(a, a1)).toBe(false)
            expect(await tree.canMoveTo(a, a11)).toBe(false)
            expect(await tree.canMoveTo(a, a12)).toBe(false)
            expect(await tree.canMoveTo(a, a13)).toBe(false)
            expect(await tree.canMoveTo(a, a2)).toBe(false)
            expect(await tree.canMoveTo(a, a3)).toBe(false)
        })
        test('判定节点允许移动指定节点的前后', async () => {
            expect(await tree.canMoveTo(a, b)).toBe(true)
            expect(await tree.canMoveTo(a1, a2)).toBe(true)
            expect(await tree.canMoveTo(a2, a3)).toBe(true)
            expect(await tree.canMoveTo(a3, a1)).toBe(true)

            expect(await tree.canMoveTo(b, c)).toBe(true)
            expect(await tree.canMoveTo(b1, b2)).toBe(true)
            expect(await tree.canMoveTo(b2, b3)).toBe(true)
            expect(await tree.canMoveTo(b3, b1)).toBe(true)
            expect(await tree.canMoveTo(b11, b12)).toBe(true)
            expect(await tree.canMoveTo(b12, b13)).toBe(true)
            expect(await tree.canMoveTo(b13, b11)).toBe(true)
            expect(await tree.canMoveTo(c, a)).toBe(true)
            expect(await tree.canMoveTo(c1, c2)).toBe(true)
            expect(await tree.canMoveTo(c2, c3)).toBe(true)
            expect(await tree.canMoveTo(c3, c1)).toBe(true)
            expect(await tree.canMoveTo(c11, c12)).toBe(true)
            expect(await tree.canMoveTo(c12, c13)).toBe(true)
            expect(await tree.canMoveTo(c13, c11)).toBe(true)
        })
        test('判定节点允许移动指定节点的子节点', async () => {
            expect(await tree.canMoveTo(a, b)).toBe(true)
            expect(await tree.canMoveTo(a1, a2)).toBe(true)
            expect(await tree.canMoveTo(a2, a3)).toBe(true)
            expect(await tree.canMoveTo(a3, a1)).toBe(true)
            expect(await tree.canMoveTo(a11, a12)).toBe(true)
            expect(await tree.canMoveTo(a12, a13)).toBe(true)
            expect(await tree.canMoveTo(a13, a11)).toBe(true)

            expect(await tree.canMoveTo(b, c)).toBe(true)
            expect(await tree.canMoveTo(b1, b2)).toBe(true)
            expect(await tree.canMoveTo(b2, b3)).toBe(true)
            expect(await tree.canMoveTo(b3, b1)).toBe(true)
            expect(await tree.canMoveTo(b11, b12)).toBe(true)
            expect(await tree.canMoveTo(b12, b13)).toBe(true)
            expect(await tree.canMoveTo(b13, b11)).toBe(true)
            expect(await tree.canMoveTo(c, a)).toBe(true)
            expect(await tree.canMoveTo(c1, c2)).toBe(true)
            expect(await tree.canMoveTo(c2, c3)).toBe(true)
            expect(await tree.canMoveTo(c3, c1)).toBe(true)
            expect(await tree.canMoveTo(c11, c12)).toBe(true)
            expect(await tree.canMoveTo(c12, c13)).toBe(true)
            expect(await tree.canMoveTo(c13, c11)).toBe(true)
            expect(await verifyTree(tree)).toBe(true)
        })
    })

    describe('移动节点到目标节点的后面成为其下一个兄弟节点', async () => {
        // 向下移动:  目标节点在源节点的下面
        test('move A-1-1 to the next sibling node of A_1_2', async () => {
            let a1 = await tree.findNode({ name: 'A-1-1' })!
            let a2 = await tree.findNode({ name: 'A-1-2' })!
            await tree.write(async () => {
                await tree.moveNode(a1.id, a2.id, NextSibling)
            })
            const a = await tree.findNode({ name: 'A-1' })!
            a1 = await tree.findNode({ name: 'A-1-1' })!
            a2 = await tree.findNode({ name: 'A-1-2' })!
            a3 = await tree.findNode({ name: 'A-1-3' })!
            const a4 = await tree.findNode({ name: 'A-1-4' })!
            const a5 = await tree.findNode({ name: 'A-1-5' })!

            expect(a2.leftValue).toBe(a.leftValue + 1)
            expect(a2.rightValue).toBe(a.leftValue + 2)
            expect(a1.leftValue).toBe(a.leftValue + 3)
            expect(a1.rightValue).toBe(a.leftValue + 4)
            expect(a3.leftValue).toBe(a.leftValue + 5)
            expect(a3.rightValue).toBe(a.leftValue + 6)
            expect(a4.leftValue).toBe(a.leftValue + 7)
            expect(a4.rightValue).toBe(a.leftValue + 8)
            expect(a5.leftValue).toBe(a.leftValue + 9)
            expect(a5.rightValue).toBe(a.leftValue + 10)
            expect(a.rightValue).toBe(a.leftValue + 11)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('move A-1-1 sequentially to the next sibling node of A_1_2,A-1-3,A-1-4,A-1-5', async () => {
            let a1 = await tree.findNode({ name: 'A-1-1' })!
            let a2 = await tree.findNode({ name: 'A-1-2' })!
            let a3 = await tree.findNode({ name: 'A-1-3' })!
            let a4 = await tree.findNode({ name: 'A-1-4' })!
            let a5 = await tree.findNode({ name: 'A-1-5' })!

            await tree.write(async () => {
                await tree.moveNode(a1.id, a2.id, NextSibling)
                await tree.moveNode(a1.id, a3.id, NextSibling)
                await tree.moveNode(a1.id, a4.id, NextSibling)
                await tree.moveNode(a1.id, a5.id, NextSibling)
            })
            const a = await tree.findNode({ name: 'A-1' })!
            a1 = await tree.findNode({ name: 'A-1-1' })!
            a2 = await tree.findNode({ name: 'A-1-2' })!
            a3 = await tree.findNode({ name: 'A-1-3' })!
            a4 = await tree.findNode({ name: 'A-1-4' })!
            a5 = await tree.findNode({ name: 'A-1-5' })!

            expect(a2.leftValue).toBe(a.leftValue + 1)
            expect(a2.rightValue).toBe(a.leftValue + 2)
            expect(a3.leftValue).toBe(a.leftValue + 3)
            expect(a3.rightValue).toBe(a.leftValue + 4)
            expect(a4.leftValue).toBe(a.leftValue + 5)
            expect(a4.rightValue).toBe(a.leftValue + 6)
            expect(a5.leftValue).toBe(a.leftValue + 7)
            expect(a5.rightValue).toBe(a.leftValue + 8)
            expect(a1.leftValue).toBe(a.leftValue + 9)
            expect(a1.rightValue).toBe(a.leftValue + 10)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('move A to the next sibling node of B,C,D,E,F', async () => {
            const a = await tree.findNode({ name: 'A' })!
            const b = await tree.findNode({ name: 'B' })!
            const c = await tree.findNode({ name: 'C' })!
            const d = await tree.findNode({ name: 'D' })!
            const e = await tree.findNode({ name: 'E' })!
            const f = await tree.findNode({ name: 'F' })!
            await tree.write(async () => {
                await tree.moveNode(a.id, b.id, NextSibling)
                await tree.moveNode(a.id, c.id, NextSibling)
                await tree.moveNode(a.id, d.id, NextSibling)
                await tree.moveNode(a.id, e.id, NextSibling)
                await tree.moveNode(a.id, f.id, NextSibling)
            })

            expect(await verifyTree(tree)).toBe(true)
        })

        // 向上移动：目标节点在源节点的上面
        test('向上同级内移动到前面的目标下一个兄弟节点', async () => {
            let a2 = await tree.findNode({ name: 'A-1-2' })!
            let a5 = await tree.findNode({ name: 'A-1-5' })!
            await tree.write(async () => {
                await tree.moveNode(a5.id, a2.id, NextSibling)
            })
            a2 = await tree.findNode({ name: 'A-1-2' })!
            a5 = await tree.findNode({ name: 'A-1-5' })!

            expect(a5.leftValue).toBe(a2.rightValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('向上同级内连续多下移动到前面的目标同级内的下一个兄弟节点', async () => {
            const a1 = await tree.findNode({ name: 'A-1-1' })!
            const a2 = await tree.findNode({ name: 'A-1-2' })!
            const a3 = await tree.findNode({ name: 'A-1-3' })!
            const a5 = await tree.findNode({ name: 'A-1-5' })!

            await tree.write(async () => {
                await tree.moveNode(a5.id, a3.id, NextSibling)
                await tree.moveNode(a5.id, a2.id, NextSibling)
                await tree.moveNode(a5.id, a1.id, NextSibling)
            })
            //   a1 = await tree.findNode({ name: 'A-1-1' })!
            //   a2 = await tree.findNode({ name: 'A-1-2' })!
            //   a3 = await tree.findNode({ name: 'A-1-3' })!
            //   a4 = await tree.findNode({ name: 'A-1-4' })!
            //   a5 = await tree.findNode({ name: 'A-1-5' })!

            expect(await verifyTree(tree)).toBe(true)
        })
        test('向上移动子树到同级内的前面的目标节点的下一个兄弟节点', async () => {
            const a = await tree.findNode({ name: 'A' })!
            const b = await tree.findNode({ name: 'B' })!
            const c = await tree.findNode({ name: 'C' })!
            const d = await tree.findNode({ name: 'D' })!
            const f = await tree.findNode({ name: 'F' })!
            await tree.write(async () => {
                await tree.moveNode(f.id, d.id, NextSibling)
                await tree.moveNode(f.id, c.id, NextSibling)
                await tree.moveNode(f.id, b.id, NextSibling)
                await tree.moveNode(f.id, a.id, NextSibling)
            })

            expect(await verifyTree(tree)).toBe(true)
        })
        test('a_1_2移动为B_2_3的下一个兄弟节点', async () => {
            let a12 = await tree.findNode({ name: 'A-1-2' })!
            let b23 = await tree.findNode({ name: 'B-2-3' })!

            await tree.write(async () => {
                await tree.moveNode(a12.id, b23.id, NextSibling)
            })
            a12 = await tree.findNode({ name: 'A-1-2' })!
            b23 = await tree.findNode({ name: 'B-2-3' })!
            expect(a12.leftValue).toBe(b23.rightValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('b_2_3移动为A_1_2的下一个兄弟节点', async () => {
            let a12 = await tree.findNode({ name: 'A-1-2' })!
            let b23 = await tree.findNode({ name: 'B-2-3' })!

            await tree.write(async () => {
                await tree.moveNode(b23, a12, NextSibling)
            })
            a12 = await tree.findNode({ name: 'A-1-2' })!
            b23 = await tree.findNode({ name: 'B-2-3' })!

            expect(b23.leftValue).toBe(a12.rightValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('移动C-5-5为C-5的下一个兄弟节点', async () => {
            let c55 = await tree.findNode({ name: 'C-5-5' })
            let c5 = await tree.findNode({ name: 'C-5' })

            await tree.write(async () => {
                await tree.moveNode(c55, c5, NextSibling)
            })
            c5 = await tree.findNode({ name: 'C-5' })
            c55 = await tree.findNode({ name: 'C-5-5' })
            expect(c55.leftValue).toBe(c5.rightValue + 1)
            expect(await verifyTree(tree)).toBe(true)
        })
    })
    describe('移动节点到目标节点的前面成为其上一个兄弟节点', async () => {
        // 目标节点在源节点的前面
        test('同级内移动到上一个兄弟节点', async () => {
            let a1 = await tree.findNode({ name: 'A-1-1' })!
            let a2 = await tree.findNode({ name: 'A-1-2' })!
            await tree.write(async () => {
                await tree.moveNode(a2.id, a1.id, PreviousSibling)
            })
            const a = await tree.findNode({ name: 'A-1' })!
            a1 = await tree.findNode({ name: 'A-1-1' })!
            a2 = await tree.findNode({ name: 'A-1-2' })!
            a3 = await tree.findNode({ name: 'A-1-3' })!
            const a4 = await tree.findNode({ name: 'A-1-4' })!
            const a5 = await tree.findNode({ name: 'A-1-5' })!

            expect(a2.leftValue).toBe(a.leftValue + 1)
            expect(a2.rightValue).toBe(a.leftValue + 2)
            expect(a1.leftValue).toBe(a.leftValue + 3)
            expect(a1.rightValue).toBe(a.leftValue + 4)
            expect(a3.leftValue).toBe(a.leftValue + 5)
            expect(a3.rightValue).toBe(a.leftValue + 6)
            expect(a4.leftValue).toBe(a.leftValue + 7)
            expect(a4.rightValue).toBe(a.leftValue + 8)
            expect(a5.leftValue).toBe(a.leftValue + 9)
            expect(a5.rightValue).toBe(a.leftValue + 10)
            expect(a.rightValue).toBe(a.leftValue + 11)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('向上同级内连续移动到上一个兄弟节点', async () => {
            let a1 = await tree.findNode({ name: 'A-1-1' })!
            let a2 = await tree.findNode({ name: 'A-1-2' })!
            let a3 = await tree.findNode({ name: 'A-1-3' })!
            let a4 = await tree.findNode({ name: 'A-1-4' })!
            let a5 = await tree.findNode({ name: 'A-1-5' })!

            await tree.write(async () => {
                await tree.moveNode(a5.id, a4.id, PreviousSibling)
                await tree.moveNode(a5.id, a3.id, PreviousSibling)
                await tree.moveNode(a5.id, a2.id, PreviousSibling)
                await tree.moveNode(a5.id, a1.id, PreviousSibling)
            })
            const a = await tree.findNode({ name: 'A-1' })!
            a1 = await tree.findNode({ name: 'A-1-1' })!
            a2 = await tree.findNode({ name: 'A-1-2' })!
            a3 = await tree.findNode({ name: 'A-1-3' })!
            a4 = await tree.findNode({ name: 'A-1-4' })!
            a5 = await tree.findNode({ name: 'A-1-5' })!

            expect(a5.leftValue).toBe(a.leftValue + 1)
            expect(a5.rightValue).toBe(a.leftValue + 2)
            expect(a1.leftValue).toBe(a.leftValue + 3)
            expect(a1.rightValue).toBe(a.leftValue + 4)
            expect(a2.leftValue).toBe(a.leftValue + 5)
            expect(a2.rightValue).toBe(a.leftValue + 6)
            expect(a3.leftValue).toBe(a.leftValue + 7)
            expect(a3.rightValue).toBe(a.leftValue + 8)
            expect(a4.leftValue).toBe(a.leftValue + 9)
            expect(a4.rightValue).toBe(a.leftValue + 10)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('向上移动子树到同级内的目标节点的上一个兄弟节点', async () => {
            let a = await tree.findNode({ name: 'A' })!
            let b = await tree.findNode({ name: 'B' })!
            let c = await tree.findNode({ name: 'C' })!
            let d = await tree.findNode({ name: 'D' })!
            let e = await tree.findNode({ name: 'E' })!
            let f = await tree.findNode({ name: 'F' })!
            await tree.write(async () => {
                await tree.moveNode(f.id, e.id, PreviousSibling)
                await tree.moveNode(f.id, d.id, PreviousSibling)
                await tree.moveNode(f.id, c.id, PreviousSibling)
                await tree.moveNode(f.id, b.id, PreviousSibling)
                await tree.moveNode(f.id, a.id, PreviousSibling)
            })
            a = await tree.findNode({ name: 'A' })!
            b = await tree.findNode({ name: 'B' })!
            c = await tree.findNode({ name: 'C' })!
            d = await tree.findNode({ name: 'D' })!
            e = await tree.findNode({ name: 'E' })!
            f = await tree.findNode({ name: 'F' })!

            expect(a.leftValue).toBe(f.rightValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('向上移动子树到不同级内的目标节点的上一个兄弟节点', async () => {
            let a1 = await tree.findNode({ name: 'A-1' })!
            let b5 = await tree.findNode({ name: 'B-5' })!
            await tree.write(async () => {
                await tree.moveNode(b5.id, a1.id, PreviousSibling)
            })
            a1 = await tree.findNode({ name: 'A-1' })!
            b5 = await tree.findNode({ name: 'B-5' })!
            expect(a1.leftValue).toBe(b5.rightValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })

        // 目标节点在源节点的后面
        test('向下同级内移动到上一个兄弟节点', async () => {
            let a1 = await tree.findNode({ name: 'A-1-1' })!
            let a3 = await tree.findNode({ name: 'A-1-3' })!
            await tree.write(async () => {
                await tree.moveNode(a1.id, a3.id, PreviousSibling)
            })
            const a = await tree.findNode({ name: 'A-1' })!
            a1 = await tree.findNode({ name: 'A-1-1' })!
            a2 = await tree.findNode({ name: 'A-1-2' })!
            a3 = await tree.findNode({ name: 'A-1-3' })!

            expect(a2.leftValue).toBe(a.leftValue + 1)
            expect(a2.rightValue).toBe(a.leftValue + 2)
            expect(a1.leftValue).toBe(a.leftValue + 3)
            expect(a1.rightValue).toBe(a.leftValue + 4)
            expect(a3.leftValue).toBe(a.leftValue + 5)
            expect(a3.rightValue).toBe(a.leftValue + 6)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('向下同级内连续移动到上一个兄弟节点', async () => {
            let a1 = await tree.findNode({ name: 'A-1-1' })!
            let a2 = await tree.findNode({ name: 'A-1-2' })!
            let a3 = await tree.findNode({ name: 'A-1-3' })!
            let a4 = await tree.findNode({ name: 'A-1-4' })!
            let a5 = await tree.findNode({ name: 'A-1-5' })!

            await tree.write(async () => {
                await tree.moveNode(a1.id, a2.id, PreviousSibling)
                await tree.moveNode(a1.id, a3.id, PreviousSibling)
                await tree.moveNode(a1.id, a3.id, PreviousSibling)
                await tree.moveNode(a1.id, a5.id, PreviousSibling)
            })
            const a = await tree.findNode({ name: 'A-1' })!
            a1 = await tree.findNode({ name: 'A-1-1' })!
            a2 = await tree.findNode({ name: 'A-1-2' })!
            a3 = await tree.findNode({ name: 'A-1-3' })!
            a4 = await tree.findNode({ name: 'A-1-4' })!
            a5 = await tree.findNode({ name: 'A-1-5' })!

            expect(a2.leftValue).toBe(a.leftValue + 1)
            expect(a2.rightValue).toBe(a.leftValue + 2)
            expect(a3.leftValue).toBe(a.leftValue + 3)
            expect(a3.rightValue).toBe(a.leftValue + 4)
            expect(a4.leftValue).toBe(a.leftValue + 5)
            expect(a4.rightValue).toBe(a.leftValue + 6)
            expect(a1.leftValue).toBe(a.leftValue + 7)
            expect(a1.rightValue).toBe(a.leftValue + 8)
            expect(a5.leftValue).toBe(a.leftValue + 9)
            expect(a5.rightValue).toBe(a.leftValue + 10)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('向下移动子树到同级内的目标节点的上一个兄弟节点', async () => {
            let a = await tree.findNode({ name: 'A' })!
            let b = await tree.findNode({ name: 'B' })!
            let c = await tree.findNode({ name: 'C' })!
            let d = await tree.findNode({ name: 'D' })!
            let e = await tree.findNode({ name: 'E' })!
            let f = await tree.findNode({ name: 'F' })!
            await tree.write(async () => {
                await tree.moveNode(f.id, e.id, PreviousSibling)
                await tree.moveNode(f.id, d.id, PreviousSibling)
                await tree.moveNode(f.id, c.id, PreviousSibling)
                await tree.moveNode(f.id, b.id, PreviousSibling)
                await tree.moveNode(f.id, a.id, PreviousSibling)
            })
            a = await tree.findNode({ name: 'A' })!
            b = await tree.findNode({ name: 'B' })!
            c = await tree.findNode({ name: 'C' })!
            d = await tree.findNode({ name: 'D' })!
            e = await tree.findNode({ name: 'E' })!
            f = await tree.findNode({ name: 'F' })!

            expect(a.leftValue).toBe(f.rightValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('向下移动子树到不同级内的目标节点的上一个兄弟节点', async () => {
            let a1 = await tree.findNode({ name: 'A-1' })!
            let b5 = await tree.findNode({ name: 'B-5' })!
            await tree.write(async () => {
                await tree.moveNode(a1.id, b5.id, PreviousSibling)
            })
            a1 = await tree.findNode({ name: 'A-1' })!
            b5 = await tree.findNode({ name: 'B-5' })!
            expect(b5.leftValue).toBe(a1.rightValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('移动F-5-5为F-5-4的上一个兄弟节点', async () => {
            let f55 = await tree.findNode({ name: 'F-5-5' })
            const f54 = await tree.findNode({ name: 'F-5-4' })
            const f53 = await tree.findNode({ name: 'F-5-3' })
            const f52 = await tree.findNode({ name: 'F-5-2' })
            const f51 = await tree.findNode({ name: 'F-5-1' })

            await tree.write(async () => {
                await tree.moveNode(f55, f54, PreviousSibling)
                // 因为移动后f55的左右值已经变化，所以需要重新获取f55
                f55 = await tree.findNode({ name: 'F-5-5' })
                await tree.moveNode(f55, f53, PreviousSibling)
                f55 = await tree.findNode({ name: 'F-5-5' })
                await tree.moveNode(f55, f52, PreviousSibling)
                f55 = await tree.findNode({ name: 'F-5-5' })
                await tree.moveNode(f55, f51, PreviousSibling)
            })
            expect(await verifyTree(tree)).toBe(true)
        })
        test('移动C-5-5为C-5的上一个兄弟节点', async () => {
            let c55 = await tree.findNode({ name: 'C-5-5' })
            let c5 = await tree.findNode({ name: 'C-5' })

            await tree.write(async () => {
                await tree.moveNode(c55, c5, PreviousSibling)
            })
            c5 = await tree.findNode({ name: 'C-5' })
            c55 = await tree.findNode({ name: 'C-5-5' })
            expect(c5.leftValue).toBe(c55.rightValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })
    })

    describe('移动节点为目标节点最后一个子节点', async () => {
        // 向下移动： 即目标节点在源节点后面
        test('a-1-1移动为A-1-3的最后一个子节点', async () => {
            let a11 = await tree.findNode({ name: 'A-1-1' })!
            let a13 = await tree.findNode({ name: 'A-1-3' })!
            await tree.write(async () => {
                await tree.moveNode(a11.id, a13.id, LastChild)
            })
            a13 = await tree.findNode({ name: 'A-1-3' })!
            a11 = await tree.findNode({ name: 'A-1-1' })!

            expect(a11.level).toBe(a13.level + 1)
            expect(a11.rightValue + 1).toBe(a13.rightValue)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('a移动为B的最后一个子节点', async () => {
            let a = await tree.findNode({ name: 'A' })!
            let b = await tree.findNode({ name: 'B' })!
            await tree.write(async () => {
                await tree.moveNode(a, b, LastChild)
            })
            a = await tree.findNode({ name: 'A' })!
            b = await tree.findNode({ name: 'B' })!
            expect(a.level).toBe(b.level + 1)
            expect(a.rightValue).toBe(b.rightValue - 1)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('a移动为B-1-2的最后一个子节点', async () => {
            let a = await tree.findNode({ name: 'A' })!
            let b = await tree.findNode({ name: 'B-1-2' })!
            await tree.write(async () => {
                await tree.moveNode(a, b, LastChild)
            })
            a = await tree.findNode({ name: 'A' })!
            b = await tree.findNode({ name: 'B-1-2' })!
            expect(a.level).toBe(b.level + 1)
            expect(a.rightValue).toBe(b.rightValue - 1)
            expect(await verifyTree(tree)).toBe(true)
        })

        // 向上移动： 即目标节点在源节点前面
        test('a-1-3移动为A-1-1的最后一个子节点', async () => {
            let a11 = await tree.findNode({ name: 'A-1-1' })!
            let a13 = await tree.findNode({ name: 'A-1-3' })!
            await tree.write(async () => {
                await tree.moveNode(a13, a11, LastChild)
            })
            a13 = await tree.findNode({ name: 'A-1-3' })!
            a11 = await tree.findNode({ name: 'A-1-1' })!

            expect(a13.level).toBe(a11.level + 1)
            expect(a13.rightValue + 1).toBe(a11.rightValue)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('b移动为A的最后一个子节点', async () => {
            let a = await tree.findNode({ name: 'A' })!
            let b = await tree.findNode({ name: 'B' })!
            await tree.write(async () => {
                await tree.moveNode(b, a, LastChild)
            })
            a = await tree.findNode({ name: 'A' })!
            b = await tree.findNode({ name: 'B' })!
            expect(b.level).toBe(a.level + 1)
            expect(b.rightValue).toBe(a.rightValue - 1)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('c移动为A-1-2的最后一个子节点', async () => {
            let c = await tree.findNode({ name: 'C' })!
            let a = await tree.findNode({ name: 'A-1-2' })!
            await tree.write(async () => {
                await tree.moveNode(c, a, LastChild)
            })
            c = await tree.findNode({ name: 'C' })!
            a = await tree.findNode({ name: 'A-1-2' })!
            expect(c.level).toBe(a.level + 1)
            expect(c.rightValue).toBe(a.rightValue - 1)
            expect(await verifyTree(tree)).toBe(true)
        })
    })

    describe('移动节点为目标节点第一个子节点', async () => {
        // 向下移动： 即目标节点在源节点后面
        test('a-1-1移动为A-1-3的第一个子节点', async () => {
            let a11 = await tree.findNode({ name: 'A-1-1' })!
            let a13 = await tree.findNode({ name: 'A-1-3' })!
            await tree.write(async () => {
                await tree.moveNode(a11.id, a13.id, FirstChild)
            })
            a13 = await tree.findNode({ name: 'A-1-3' })!
            a11 = await tree.findNode({ name: 'A-1-1' })!

            expect(a11.level).toBe(a13.level + 1)
            expect(a11.leftValue).toBe(a13.leftValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })
        test('a移动为B的第一个子节点', async () => {
            let a = await tree.findNode({ name: 'A' })!
            let b = await tree.findNode({ name: 'B' })!
            await tree.write(async () => {
                await tree.moveNode(a, b, FirstChild)
            })
            a = await tree.findNode({ name: 'A' })!
            b = await tree.findNode({ name: 'B' })!
            expect(a.level).toBe(b.level + 1)
            expect(a.leftValue).toBe(b.leftValue + 1)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('b移动为A-1-2的第一个子节点', async () => {
            let a = await tree.findNode({ name: 'A' })!
            let b = await tree.findNode({ name: 'B-1-2' })!
            await tree.write(async () => {
                await tree.moveNode(a, b, FirstChild)
            })
            a = await tree.findNode({ name: 'A' })!
            b = await tree.findNode({ name: 'B-1-2' })!
            expect(a.level).toBe(b.level + 1)
            expect(a.leftValue).toBe(b.leftValue + 1)
            expect(await verifyTree(tree)).toBe(true)
        })

        // 向上移动： 即目标节点在源节点前面
        test('a-1-3移动为A-1-1的第一个子节点', async () => {
            let a11 = await tree.findNode({ name: 'A-1-1' })!
            let a13 = await tree.findNode({ name: 'A-1-3' })!
            await tree.write(async () => {
                await tree.moveNode(a13, a11, FirstChild)
            })
            a13 = await tree.findNode({ name: 'A-1-3' })!
            a11 = await tree.findNode({ name: 'A-1-1' })!

            expect(a13.level).toBe(a11.level + 1)
            expect(a13.leftValue).toBe(a11.leftValue + 1)

            expect(await verifyTree(tree)).toBe(true)
        })

        test('b移动为A的第一个子节点', async () => {
            let a = await tree.findNode({ name: 'A' })!
            let b = await tree.findNode({ name: 'B' })!
            await tree.write(async () => {
                await tree.moveNode(b, a, FirstChild)
            })
            a = await tree.findNode({ name: 'A' })!
            b = await tree.findNode({ name: 'B' })!
            expect(b.level).toBe(a.level + 1)
            expect(b.leftValue).toBe(a.leftValue + 1)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('c移动为A-1-2的第一个子节点', async () => {
            let c = await tree.findNode({ name: 'C' })!
            let a = await tree.findNode({ name: 'A-1-2' })!
            await tree.write(async () => {
                await tree.moveNode(c, a, FirstChild)
            })
            c = await tree.findNode({ name: 'C' })!
            a = await tree.findNode({ name: 'A-1-2' })!
            expect(c.level).toBe(a.level + 1)
            expect(c.leftValue).toBe(a.leftValue + 1)
            expect(await verifyTree(tree)).toBe(true)
        })
    })

    describe('向上移动节点', async () => {
        test('向上移动一个节点', async () => {
            let f55 = await tree.findNode({ name: 'F-5-5' })
            await tree.write(async () => {
                await tree.moveUpNode(f55)
            })
            f55 = await tree.findNode({ name: 'F-5-5' })
            const f54 = await tree.findNode({ name: 'F-5-4' })

            expect(f55.level).toBe(f54.level)
            expect(f54.leftValue).toBe(f55.leftValue + 2)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('向上移动一个节点直到变成其父节点的上一个兄弟节点', async () => {
            let f55 = await tree.findNode({ name: 'F-5-5' })
            await tree.write(async () => {
                await tree.moveUpNode(f55.id) // 4
                await tree.moveUpNode(f55.id) // 3
                await tree.moveUpNode(f55.id) // 2
                await tree.moveUpNode(f55.id) // 1
                await tree.moveUpNode(f55.id) // 1
            })
            const f5 = await tree.findNode({ name: 'F-5' })
            f55 = await tree.findNode({ name: 'F-5-5' })
            const fChildren = await tree.getChildren(f5)
            expect(fChildren.length).toBe(4)
            expect(fChildren[0].name).toBe('F-5-1')
            expect(fChildren[1].name).toBe('F-5-2')
            expect(fChildren[2].name).toBe('F-5-3')
            expect(fChildren[3].name).toBe('F-5-4')

            expect(f55.level).toBe(f5.level)
            expect(f55.rightValue+1).toBe(f5.leftValue)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('f-5-5连续向上移动直至根节点', async () => {
            let f55 = await tree.findNode({ name: 'F-5-5' })
            const root = await tree.findNode({ name: 'root' })
            await tree.write(async () => {
                while (true) {
                    try {
                        await tree.moveUpNode(f55.id)
                    } catch (e) {
                        expect(e).toBeInstanceOf(FlexTreeNodeInvalidOperationError)
                        f55 = await tree.findNode({ name: 'F-5-5' })
                        expect(f55.level).toBe(1)
                        expect(f55.leftValue).toBe(root.leftValue + 1)
                        break
                    }
                }
            })
            expect(await verifyTree(tree)).toBe(true)
        })
    })

    describe('向下移动节点', async () => {
        test('向下移动一个节点', async () => {
            let f11 = await tree.findNode({ name: 'F-1-1' })
            await tree.write(async () => {
                await tree.moveDownNode(f11)
            })
            f11 = await tree.findNode({ name: 'F-1-1' })
            const f12 = await tree.findNode({ name: 'F-1-2' })

            expect(f11.level).toBe(f12.level)
            expect(f11.leftValue).toBe(f12.leftValue + 2)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('向下移动一个节点直到变成其父节点的下一个兄弟节点', async () => {
            let a11 = await tree.findNode({ name: 'A-1-1' })
            await tree.write(async () => {
                await tree.moveDownNode(a11.id) // 2
                await tree.moveDownNode(a11.id) // 3
                await tree.moveDownNode(a11.id) // 4
                await tree.moveDownNode(a11.id) // 5
                await tree.moveDownNode(a11.id) // 1
            })
            const a1 = await tree.findNode({ name: 'A-1' })
            a11 = await tree.findNode({ name: 'A-1-1' })
            const fChildren = await tree.getChildren(a1)
            expect(fChildren.length).toBe(4)
            expect(fChildren[0].name).toBe('A-1-2')
            expect(fChildren[1].name).toBe('A-1-3')
            expect(fChildren[2].name).toBe('A-1-4')
            expect(fChildren[3].name).toBe('A-1-5')

            expect(a11.level).toBe(a1.level)
            expect(a11.leftValue).toBe(a1.rightValue + 1)
            expect(await verifyTree(tree)).toBe(true)
        })
        test('a-1-1连续向下移动直至最后节点', async () => {
            const root = await tree.findNode({ name: 'root' })
            let a11 = await tree.findNode({ name: 'A-1-1' })
            await tree.write(async () => {
                while (true) {
                    try {
                        await tree.moveDownNode(a11.id)
                    } catch (e) {
                        expect(e).toBeInstanceOf(FlexTreeNodeInvalidOperationError)
                        a11 = await tree.findNode({ name: 'A-1-1' })
                        expect(a11.level).toBe(1)
                        expect(a11.leftValue).toBe(root.rightValue - 2)
                        break
                    }
                }
            })
            expect(await verifyTree(tree)).toBe(true)
        })
    })
})
