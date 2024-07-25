import type { FlexTreeManager } from "./manager";
import { ValueOf } from "type-fest"

export type NonUndefined<T> = T extends undefined ? never : T;



export type FlexTreeKeyFieldNames = ['name','leftValue','rightValue','level']
export type FlexTreeKeyFields<T extends FlexTreeKeyFieldNames = FlexTreeKeyFieldNames, IdType=string, TreeIdType=number> = {
    [K in T[number]]?: string
}



// 节点相对位置
export enum FlexNodeRelPosition{
    LastChild       = 0,
    FirstChild      = 1,
    NextSibling     = 2,
    PreviousSibling = 3
}

export enum FlexTreeNodeRelation{
    Self        = 0,
    Parent      = 1,
    Child       = 2,
    Siblings    = 3,
    Descendants = 4,
    Ancestors   = 5,
    DiffTree    = 6,
    SameTree    = 7,
    SameLevel   = 8,
    Unknow      = 9
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
 

export type PickKeyFieldType<
    KeyFields extends Record<string,string | [string,any]>,
    Name extends string,
    DefaultType = any> = KeyFields[Name] extends [ infer K, infer V ] ? 
    (
        K extends string ? 
            { [ P in K ] : V } 
            : { [ P in Name ] : DefaultType }
    )
    : 
    (   
        KeyFields[Name] extends string ? 
            { [ P in KeyFields[Name] ]: DefaultType } 
            : { [K in Name]: DefaultType }
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


export type RemoveKeyFields<T extends Record<string,any>,KeyFields extends CustomTreeKeyFields> = {
    [K in keyof T]: K extends KeyFields[keyof KeyFields] ? never : T[K]
}  


export type FlexTreeUpdater = (tree:FlexTreeManager)=>Promise<void>


export type FlexTreeEvents = {
    beforeWrite : undefined         // 当执行写操作前触发
    afterWrite  : undefined         // 当执行写操作后触发
}


export type IJsonTree<Data extends Record<string,any>=Record<string,any>,IdType=string,TreeIdType=number> = {
    id?        : IdType    
    treeId?    : TreeIdType    
    name?      : string
    level?     : number
    leftValue? : number
    rightValue?: number 
    children?: IJsonTree[]
} & Data




// 两种导出格式, nested: 层级嵌套结构,使用children表示子节点集; pid: 使用pid表示父节点id
export type FlexTreeExportOptions<
    Fields extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,    
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
> = {
    format?: 'nested' | 'pid'
    childrenField?:string
    pidField?:string
    level?:number                   // 限定导出的级别  
    fields?:(keyof IFlexTreeNode<Fields,KeyFields>)[]
}

export type FlexTreeExportNestedNodes<
    Fields extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Fields,KeyFields> = IFlexTreeNode<Fields,KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1]> = TreeNode & {
    children?:FlexTreeExportNestedNodes<Fields,KeyFields,TreeNode,NodeId>[]
}
