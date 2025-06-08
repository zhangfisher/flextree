export type NonUndefined<T> = T extends undefined ? never : T

export type FlexTreeKeyFieldNames = ['name', 'leftValue', 'rightValue', 'level']

// 节点相对位置
export enum FlexNodeRelPosition {
    LastChild = 0,
    FirstChild = 1,
    NextSibling = 2,
    PreviousSibling = 3,
}

export enum FlexTreeNodeRelation {
    Self = 0,
    Parent = 1,
    Child = 2,
    Siblings = 3,
    Descendants = 4,
    Ancestors = 5,
    DiffTree = 6,
    SameTree = 7,
    SameLevel = 8,
    Unknow = 9,
}

// 用来声明自定义的树关键字段
// export interface CustomTreeKeyFields {
//   id?: [string, string | number]
//   treeId?: [string, string | number]
//   name?: string
//   level?: string
//   leftValue?: string
//   rightValue?: string
// }

export type CustomTreeKeyFields = {
    id?: [string, string | number]
    treeId?: [string, string | number]
} & {
    [K in FlexTreeKeyFieldNames[number]]?: string
}

export interface DefaultTreeKeyFields {
    id: ['id', number]
    treeId: ['treeId', number]
    name: 'name'
    level: 'level'
    leftValue: 'leftValue'
    rightValue: 'rightValue'
}
export interface DefaultTreeKeyNameFields {
    id: 'id'
    treeId: 'treeId'
    name: 'name'
    level: 'level'
    leftValue: 'leftValue'
    rightValue: 'rightValue'
}

export type PickKeyFieldType<
    KeyFields extends Record<string, string | [string, any]>,
    Name extends string,
    DefaultType = any,
> = KeyFields[Name] extends [infer K, infer V] ?
    (
        K extends string ?
        { [P in K]: V }
        : { [P in Name]: DefaultType }
    )
    :
    (
        KeyFields[Name] extends string ?
        { [P in KeyFields[Name]]: DefaultType }
        : { [K in Name]: DefaultType }
    )

export type IFlexTreeNodeFields<
    Fields extends Record<string, any> = Record<string, any>,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> = PickKeyFieldType<KeyFields, 'id', number>
    & PickKeyFieldType<KeyFields, 'treeId', number>
    & PickKeyFieldType<KeyFields, 'name', string>
    & PickKeyFieldType<KeyFields, 'level', number>
    & PickKeyFieldType<KeyFields, 'leftValue', number>
    & PickKeyFieldType<KeyFields, 'rightValue', number>
    & Fields

export type RemoveKeyFields<T extends Record<string, any>, KeyFields extends CustomTreeKeyFields> = {
    [K in keyof T]: K extends KeyFields[keyof KeyFields] ? never : T[K]
}

export type FlexTreeEvents = {
    beforeWrite: undefined // 当执行写操作前触发
    afterWrite: undefined // 当执行写操作后触发
}

// 两种导出格式, nested: 层级嵌套结构,使用children表示子节点集; pid: 使用pid表示父节点id
export interface FlexTreeExportJsonOptions<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> {
    childrenField?: string
    level?: number // 限定导出的级别
    fields?: (keyof IFlexTreeNodeFields<Fields, KeyFields>)[]
    includeKeyFields?: boolean
}

export type FlexTreeExportJsonFormat<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
> = TreeNode &
    {
        children?: FlexTreeExportJsonFormat<Fields, KeyFields, TreeNode, NodeId>[]
    }

export interface FlexTreeExportListOptions<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> {
    pidField?: string
    level?: number // 限定导出的级别
    fields?: (keyof IFlexTreeNodeFields<Fields, KeyFields>)[]
    includeKeyFields?: boolean
}

export type FlexTreeExportListFormat<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    OPTIONS extends FlexTreeExportListOptions<Fields, KeyFields> = FlexTreeExportListOptions<Fields, KeyFields>,
>
    = (
        (OPTIONS['fields'] extends string[] ? Extract<TreeNode, OPTIONS['fields'][number]> : TreeNode)
        & { [P in OPTIONS['pidField'] & string]: NodeId }
    )[]


export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
