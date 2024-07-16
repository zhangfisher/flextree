/**
 *  
 * toKeyFields的反向操作
 * 
 * @param record 
 * @param fieldNames  配置的字段名称 
 */

import { type FlexTreeManagerOptions } from "../manager";
import { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined } from "../types";
 

export function fromKeyFields<Fields extends Record<string,any>={},KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields>(
    node:IFlexTreeNode<Fields,KeyFields>,fieldNames: Required<NonUndefined<FlexTreeManagerOptions['fields']>>):Record<string,any>{
    const record:Record<string,any> = {...node}
    Object.entries(fieldNames).forEach(([key,fieldName])=>{
        if(key in record && fieldName!==key){
            record[fieldName] = record[key]
            Reflect.deleteProperty(record,key)
        }
    })
    return record
} 



