import { describe, expect, test } from 'vitest'
import { toKeyFields } from '../src/utils/toKeyFields'
import { fromKeyFields } from '../src/utils/fromKeyFields'

describe('utils', () => {
    test('toKeyFields', () => {
        const record = {
            pk: 1,
            name: 'test',
            lft: 1,
            rgt: 2,
            lvl: 0,
            tid: 1,
        }
        const fieldNames = {
            id: 'pk',
            name: 'name',
            leftValue: 'lft',
            rightValue: 'rgt',
            level: 'lvl',
            treeId: 'tid',
        }
        const result = toKeyFields(record, fieldNames)
        expect(result).toEqual({
            id: 1,
            name: 'test',
            leftValue: 1,
            rightValue: 2,
            level: 0,
            treeId: 1,
        })
    })
    test('fromKeyFields', () => {
        const record = {
            id: 1,
            name: 'test',
            leftValue: 1,
            rightValue: 2,
            level: 0,
            treeId: 1,
        }
        const fieldNames = {
            id: 'pk',
            name: 'name',
            leftValue: 'lft',
            rightValue: 'rgt',
            level: 'lvl',
            treeId: 'tid',
        }
        const result = fromKeyFields(record, fieldNames)
        expect(result).toEqual({
            pk: 1,
            name: 'test',
            lft: 1,
            rgt: 2,
            lvl: 0,
            tid: 1,
        })
    })
})
