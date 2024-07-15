/**
 *  
 * toKeyFields的反向操作
 * 
 * @param record 
 * @param fieldNames  配置的字段名称 
 */

import { type FlexTreeManagerOptions } from "../manager";
import { IFlexTreeNode, NonUndefined } from "../types";
 

export function fromKeyFields<Node extends Record<string,any>={},IdType=string,TreeIdType=number>(node:IFlexTreeNode<Node,IdType,TreeIdType>,fieldNames: Required<NonUndefined<FlexTreeManagerOptions['fields']>>):Record<string,any>{
    let result: IFlexTreeNode<Node,IdType,TreeIdType>  = node as IFlexTreeNode<Node,IdType,TreeIdType> 
    Object.entries(node).forEach(([key,value])=>{
        if(key in fieldNames){
            // @ts-ignore
            result[fieldNames[key]] = value
        }else{
            // @ts-ignore
            result[key] = value
        }
    })
    return result as unknown as  IFlexTreeNode<Node,IdType,TreeIdType>
} 



