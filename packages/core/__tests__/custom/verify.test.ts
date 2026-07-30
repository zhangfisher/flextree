import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { CustomDemoFlexTreeManager } from './createCustomTree'
import { createCustomDemoTree, createCustomTreeManager } from './createCustomTree'

describe('检查树的完整性', () => {
    let tree: CustomDemoFlexTreeManager
    beforeEach(async () => {
        tree = await createCustomTreeManager()
        await createCustomDemoTree(tree)
    })
    afterEach(async () => {
    })
    test('检查树的完整性', async () => {
        expect(await tree.verify()).toBe(true)
    })
})
