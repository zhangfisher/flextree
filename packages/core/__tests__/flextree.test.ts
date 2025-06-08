/* eslint-disable no-unused-vars */
import { describe, test, expect } from "vitest"
import type { Equal, Expect, NotAny } from '@type-challenges/utils'
import { FlexTree } from "../src"

describe("FlexTree类型系统测试", () => {
    test("字段类型", () => {
        type UserType = {
            age: number
            sex: 'Male' | 'Female'
            admin: boolean
        }
        const tree = new FlexTree<UserType>('user')
        const rootNode = tree.root!
        type FieldTypes = Exclude<typeof rootNode.fields, undefined>
        type FieldNames = keyof FieldTypes
        type childrenType = Exclude<Exclude<typeof rootNode.children, undefined>[number]['fields'], undefined>
        type childrenNames = keyof childrenType

        type FieldsCases = [
            Expect<
                Equal<FieldNames,
                    "id" | "treeId" | "name" | "level" | "leftValue" | "rightValue"
                    | 'age' | 'sex' | 'admin'>
            >,
            Expect<
                Equal<childrenNames,
                    "id" | "treeId" | "name" | "level" | "leftValue" | "rightValue"
                    | 'age' | 'sex' | 'admin'>
            >,

        ]
    })
    test("查找节点类型", () => {
        type UserType = {
            age: number
            sex: 'Male' | 'Female'
            admin: boolean
        }
        const tree = new FlexTree<UserType>('user')
        const rootNode = tree.find(node => {
            type FieldNames = keyof typeof node.fields
            type FieldsCases = [
                Expect<
                    Equal<FieldNames,
                        "id" | "treeId" | "name" | "level" | "leftValue" | "rightValue"
                        | 'age' | 'sex' | 'admin'>
                >
            ]
            return true
        })!

    })
    test("自定义关键字段类型", () => {
        type UserType = {
            pk: string
            org: string
            title: string
            lft: number
            rgt: number
            lv: number
            age: number
            sex: 'Male' | 'Female'
            admin: boolean
        }
        const tree = new FlexTree<UserType, {
            name: 'title',
            leftValue: 'lft',
            rightValue: 'rgt',
            level: 'lv',
            id: ['pk', string],
            treeId: ['org', string],
        }>('user')
        const rootNode = tree.find(node => {
            type keyFieldCases = [
                Expect<Equal<typeof node.id, string>>,
                Expect<Equal<typeof node.treeId, string>>
            ]
            type FieldNames = keyof typeof node.fields
            type FieldsCases = [
                Expect<
                    Equal<FieldNames,
                        "pk" | "org" | "title" | "lv" | "lft" | "rgt"
                        | 'age' | 'sex' | 'admin'>
                >
            ]
            return true
        })!
        const rootNode2 = tree.find(node => {
            type FieldNames = keyof typeof node.fields
            type FieldsCases = [
                Expect<
                    Equal<FieldNames,
                        "pk" | "org" | "title" | "lv" | "lft" | "rgt"
                        | 'age' | 'sex' | 'admin'>
                >
            ]
            return true
        })!
        const node = tree.get('123')!

        type keyFieldCases = [
            Expect<Equal<typeof node.id, string>>,
            Expect<Equal<typeof node.treeId, string>>
        ]
    })
})