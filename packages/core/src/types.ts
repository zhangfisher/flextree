import type { FlexTreeManager } from "./manager";

export type NonUndefined<T> = T extends undefined ? never : T;



export type FlexTreeKeyFieldNames = ['name','leftValue','rightValue','level']
export type FlexTreeKeyFields<T extends FlexTreeKeyFieldNames = FlexTreeKeyFieldNames, IdType=string, TreeIdType=number> = {
    [K in T[number]]?: string
}



// 节点相对位置
export enum FlexNodeRelPosition{
    LastChild   = 0,
    FirstChild  = 1,
    NextSibling = 2,
    PreviousSibling=3
}

export enum FlexTreeNodeRelation{
    Self=0,
    Parent=1,
    Child=2,
    Siblings=3,
    Descendants=4,
    Ancestors=5,
    Diff_tree=6,
    Same_tree=7,
    Same_level=8,
    Unknow=9
}


// 用来声明自定义的树关键字段
export type CustomTreeKeyFields = {                                                 // 自定义关键字段名称和类型
    id?        : [string,string | number], 
    treeId?    : [string,string | number],
    name?      : string,
    level?     : string,
    leftValue? : string,
    rightValue?: string
} 

export type DefaultTreeKeyFields = {
    id        : ['id',number],
    treeId    : ['treeId',number]
    name      : 'name',
    level     : 'level',
    leftValue : 'leftValue',
    rightValue: 'rightValue'
}
export type DefaultTreeKeyNameFields = {
    id        : 'id',
    treeId    : 'treeId',
    name      : 'name',
    level     : 'level',
    leftValue : 'leftValue',
    rightValue: 'rightValue'
}

export type PickKeyFieldType<KeyFields extends Record<string,string | [string,any]>,Name extends string,DefaultType = any> = 
    KeyFields[Name] extends [infer K, infer V] ? 
    { [P in K & string]: V } 
    : (   
        KeyFields[Name] extends string ? { [K in KeyFields[Name]]: DefaultType } :
        { [K in Name]: DefaultType }
    )

export type IFlexTreeNode<
    Fields extends Record<string,any> = Record<string,any>,                 // 额外的节点字段    
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields
> = PickKeyFieldType<KeyFields,'id',number> 
    & PickKeyFieldType<KeyFields,'treeId',number> 
    & PickKeyFieldType<KeyFields,'name',string> 
    & PickKeyFieldType<KeyFields,'level',number> 
    & PickKeyFieldType<KeyFields,'leftValue',number> 
    & PickKeyFieldType<KeyFields,'rightValue',number> 
    & Fields  



export type IJsonTree<Data extends Record<string,any>=Record<string,any>,IdType=string,TreeIdType=number> = {
    id?        : IdType    
    treeId?    : TreeIdType    
    name?      : string
    level?     : number
    leftValue? : number
    rightValue?: number 
    children?: IJsonTree[]
} & Data


 

// export type IFlexTreeNode3<
//     Fields extends Record<string,any> = Record<string,any>,                 // 额外的节点字段    
//     KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields
// > = {
//     [K in ((DefaultTreeKeyFields & KeyFields)['id'])[0]]: (DefaultTreeKeyFields & KeyFields)['id'][1]
// } & {
//     [K in ((DefaultTreeKeyFields & KeyFields)['treeId'])[0]]: (DefaultTreeKeyFields & KeyFields)['treeId'][1]
// } & {
//     [K in ((DefaultTreeKeyFields & KeyFields)['name'] & string)]: string
// } & {
//     [K in ((DefaultTreeKeyFields & KeyFields)['level'] & 'level')]: number
// } & {
//     [K in ((DefaultTreeKeyFields & KeyFields)['leftValue'] & 'leftValue')]: number
// }  & {
//     [K in ((DefaultTreeKeyFields & KeyFields)['rightValue'] & 'rightValue')]: number
// } & Fields
 


export type FlexTreeUpdater = (tree:FlexTreeManager)=>Promise<void>