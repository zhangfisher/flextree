

// 节点与节点之间的关系
export enum FlexNodeRelation{
    Self        = 0,
    Parent      = 1,
    Child       = 2,
    Siblings    = 3,
    Descendants = 4,
    Ancestors   = 5,
    Diff_tree   = 6,
    Same_tree   = 7,
    Same_level  = 8,
    Unknow      = 9
}

// 节点位置
export enum FlexNodePosition{
    LastChild   = 0,
    FirstChild  = 1,
    NextSibling = 2,
    PreviousSibling=3,
}
 

