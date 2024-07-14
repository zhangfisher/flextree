import { type FlexTree } from "./tree"

export type NonUndefined<T> = T extends undefined ? never : T;




// 节点相对位置
export enum FlexNodeRelPosition{
    LastChild   = 0,
    FirstChild  = 1,
    NextSibling = 2,
    PreviousSibling=3
}
export type IFlexTreeNode<Data extends Record<string,any>={},IdType=string,TreeIdType=number> = {
    treeId?    : TreeIdType
    id?        : IdType
    name?      : string
    level?     : number
    leftValue? : number
    rightValue?: number 
} & Data


export type IJsonTree<Data extends Record<string,any>=Record<string,any>,IdType=string,TreeIdType=number> = {
    treeId?    : TreeIdType
    id?        : IdType    
    name?      : string
    level?     : number
    leftValue? : number
    rightValue?: number 
    children?: IJsonTree[]
} & Data



// export type FlexTreeUpdater<Node> = (tree:FlexTree<Node>)=>Promise<void>