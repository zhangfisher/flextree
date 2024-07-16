 
/**
 * 判定 Node 节点是否有效
 * 
 */ 
export function isValidNode(node:any):boolean{
      if(!node) return false
      if(!node.id) return false 
      if(!node.leftValue || node.leftValue!<=0) return false 
      if(!node.rightValue || node.rightValue!<=0) return false
      if(node.leftValue!<=node.rightValue!) return false
      if(!node.level || node.level!<=0) return false
      return true
}