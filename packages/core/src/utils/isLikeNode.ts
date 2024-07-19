 
/**
 * 判定是否为 Node 节点的对象
 * 
 * 可能是一个 Node 节点的对象，或者是一个包括节点信息的对象
 * 
 * 
 */
import { isPlainObject } from "flex-tools/typecheck/isPlainObject"
import { type FlexTreeManagerOptions } from "../manager"
import { NonUndefined } from "../types"

export function isLikeNode(node:any, fieldNames: Required<NonUndefined<FlexTreeManagerOptions['fields']>>):boolean{
      if(!isPlainObject(node)) return false
      if(Object.keys(fieldNames).some(key=>!(key in node))) return false
      if(!node[fieldNames.id]) return false 
      if(node[fieldNames.leftValue]<=0) return false 
      if(node[fieldNames.rightValue]<=0) return false
      if(node[fieldNames.leftValue]>=node[fieldNames.rightValue]) return false
      if(node[fieldNames.level]<0) return false
      return true
}