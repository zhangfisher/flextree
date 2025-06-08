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
})