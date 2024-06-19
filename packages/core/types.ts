



export interface IFlexNode{
    id?        : string,
    title?     : string,
    level?     : string,
    leftValue? : string,
    rightValue?: string,
    order?     : string,
    status?    : string
}

export interface FlexTreeOptions{
    sort?: string,                  // 同级节点内的排序字段
    // 指定表字段名称
    fields?:{
        id?        : string,
        title?     : string,
        level?     : string,
        leftValue? : string,
        rightValue?: string,
        order?     : string,
        status?    : string
    }
}