/**
 * 
 * 转换节点的关键key字段
 * 
 *   本函数在从数据库中读取到数据后调用
 * 
 * 树节点的关键字段，包括 id,leftValue,rightValue,level,treeId
 * 
 * 由于关键字段名称是可以配置的，所以需要将这些字段统一转换为IFlexTreeNode
 * 这样才可以保证在后续的IFlexTreeNode操作中，不会出现字段名称不一致的问题
 * 
 * 
 * 例：
 * 
 *   fields:{
 *      id:"pk",
 *      leftValue:"lft",
 *      rightValue:"rgt",
 *      level:"lvl",
 *      treeId:"tid"
 *   }
 * 
 *  toKeyFields({pk:1,lft:1,rgt:2,lvl:0,tid:1},{id:"pk",leftValue:"lft",rightValue:"rgt",level:"lvl",treeId:"tid"})
 *  ===
 *  {id:1,leftValue:1,rightValue:2,level:0,treeId:1}
 * 
 * @param record 
 * @param fieldNames  配置的字段名称 
 */

import { type FlexTreeManagerOptions } from "../manager";
import { IFlexTreeNode, NonUndefined } from "../types";

export function toKeyFields<Node extends Record<string,any>={},IdType=string,TreeIdType=number>(record:Record<string,any>,fieldNames: Required<NonUndefined<FlexTreeManagerOptions['fields']>>):IFlexTreeNode<Node,IdType,TreeIdType>{
    Object.entries(fieldNames).forEach(([key,fieldName])=>{
        if(!(key in record) && fieldName in record){
            record[key] = record[fieldName]
            Reflect.deleteProperty(record,fieldName)
        }
    })
    return record as unknown as  IFlexTreeNode<Node,IdType,TreeIdType>
} 


 


