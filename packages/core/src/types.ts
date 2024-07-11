import { type FlexTree } from "./tree"




export type IFlexTreeNode<Extra extends Record<string,any>=Record<string,any>> = {
    treeId?    : string
    pk?        : string
    title?     : string
    level?     : number
    leftValue? : number
    rightValue?: number
    order?     : string
} & Extra

export interface FlexTreeOptions{
    sort?: string,                  // 同级节点内的排序字段
    // 指定表字段名称
    fields?:{
        treeId?    : string,
        title?     : string,
        level?     : string,
        leftValue? : string,
        rightValue?: string,
        order?     : string,
        status?    : string
    }
}



export type FlexTreeUpdater<Node extends IFlexTreeNode=IFlexTreeNode> = (tree:FlexTree<Node>)=>Promise<void>