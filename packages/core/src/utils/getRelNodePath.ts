import { FlexTreeNodeNotFoundError } from "../errors"
import { type FlexTreeNode } from "../node"



/**
 * 
 * 基于指定current节点,根据输入path参数,返回返回入口节点和相对入口节点的路径
 * 
     * 1. 以当前节点开始
     *    getRelNodePath("A-1/A-1-1")        
     *    getRelNodePath("A-1/A-1-1")
     * 2. ./代表当前节点
     *    getRelNodePath("./A-1/A-1-1")
     * 3. ../代表父节点
     *    getRelNodePath("../A-1-1")
     *    getRelNodePath("../../A-1-1")
     * 4. /代表根节点
     *    getRelNodePath("/A-1-1") 
 * @example
 * 
 * node的路径为   a/a1
 * 
 * getRelNodePath("/",node)  == [node.root,'']
 * getRelNodePath("./",node) == [node,'']
 * getRelNodePath("./a11/a111",node) == [node,'a11/a111']
 * getRelNodePath("../a2",node) == [node.parent,'a2']
 * 
 * 
 * @param path 
 * @param current 
 * @return  [FlexTreeNode,path]  返回入口节点和相对入口节点的路径
 */
export function getRelNodePath(curNode:FlexTreeNode,path:string,delimiter:string="/"){
    // 头部的连续的//
    path = path.replace(new RegExp(`^${delimiter}{2,}$`,'g'),delimiter)


    let relPath = path        
    let relNode:FlexTreeNode | undefined = curNode
    
    if(path.startsWith(delimiter)){  
        relNode = curNode.root
        relPath = relPath.substring(delimiter.length)
    }else{        
        const curPrefix = `.${delimiter}`
        const parentPrefix = `..${delimiter}`
        while(true){
            if(relPath.startsWith(curPrefix)){                
                relPath = relPath.substring(curPrefix.length)
            }else if(relPath.startsWith(parentPrefix)){
                relPath = relPath.substring(parentPrefix.length) 
                if(relNode && relNode.parent){
                    relNode = relNode.parent                  
                }else{
                    throw new FlexTreeNodeNotFoundError(`Node<${path}> is not found`)
                }                
            }else{
                break
            }        
        }
    } 

    return [relNode,relPath] as [FlexTreeNode,string]


}