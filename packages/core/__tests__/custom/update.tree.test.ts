import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { CustomDemoFlexTreeManager } from './createCustomTree'
import { createCustomDemoTree, createCustomTreeManager, verifyCustomTree } from './createCustomTree'

describe('更新节点', () => {
    let tree: CustomDemoFlexTreeManager
    beforeEach(async () => {
        tree = await createCustomTreeManager()
        await createCustomDemoTree(tree)
        await verifyCustomTree(tree)
    })
    afterEach(async () => {
        //await dumpCustomTree(tree.adapter.db, 'update.db')
    })
    test('更新根节点', async () => {
        let root = await tree.getRoot()
        expect(root.title).toBe('root')
        await tree.write(async () => {
            await tree.update({ pk: root.pk, title: 'ROOT' })
        })
        root = await tree.getRoot()
        expect(root.title).toBe('ROOT')
    })
})
