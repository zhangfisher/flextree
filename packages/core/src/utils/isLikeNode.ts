 
/**
 * 判定是否为 Node 节点的对象
 */
import { isPlainObject } from "flex-tools/typecheck/isPlainObject"
import { type FlexTreeManagerOptions } from "../manager"

export function isLikeNode(node:any, fieldNames: Required<FlexTreeManagerOptions['fields']>):boolean{
      if(!isPlainObject(node)) return false
      return Object.keys(fieldNames).every(key=>key in node)
}