import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { DemoFlexTreeManager } from './common'
import { createDemoTree, createTreeManager, dumpTree, verifyTree } from './common'

describe('更新节点', () => {
    let tree: DemoFlexTreeManager
    beforeEach(async () => {
        tree = await createTreeManager()
        await createDemoTree(tree)
        await verifyTree(tree)
    })
    afterEach(async () => {
        await dumpTree(tree.driver.db, 'update.db')
    })
    test('更新根节点', async () => {
        let root = await tree.getRoot()
        expect(root.name).toBe('root')
        await tree.write(async () => {
            await tree.update({ id: root.id, name: 'ROOT' })
        })
        root = await tree.getRoot()
        expect(root.name).toBe('ROOT')
    })
})
