import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { DemoFlexTreeManager } from './createTree'
import { createDemoTree, createTreeManager } from './createTree'

describe('检查树的完整性', () => {
    let tree: DemoFlexTreeManager
    beforeEach(async () => {
        tree = await createTreeManager()
        await createDemoTree(tree)
    })
    afterEach(async () => {
    })
    test('检查树的完整性', async () => {
        expect(await tree.verify()).toBe(true)
    })
})
