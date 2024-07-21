import {type FlexTreeManager } from "../manager";
import { CustomTreeKeyFields, DefaultTreeKeyFields, FlexNodeRelPosition, FlexTreeNodeRelation, IFlexTreeNode, NonUndefined } from "../types";
import { FlexTreeError, FlexTreeNodeNotFoundError } from "../errors"
import { escapeSqlString } from "../utils/escapeSqlString";


export class GetNodeMixin<
    Data extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
>{ 
    /**
     * 获取节点列表
     * 
     * 说明：
     * @param options
     *   - level: 限定返回的层级,0表示不限制,1表示只返回根节点，2表示返回根节点和其子节点, 依次类推
     * @returns 
     */
    async getNodes(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,options?:{level?:number}):Promise<TreeNode[]>{
        const { level } = Object.assign({level:0},options)
        const sql =this._sql(`SELECT * FROM ${this.tableName} 
            WHERE {__TREE_ID__} ${this.keyFields.leftValue}>0 AND ${this.keyFields.rightValue}>0
                ${level>0 ? `AND ${this.keyFields.level}<=${level}` : ''}
            ORDER BY ${this.keyFields.leftValue}
        `)
        return await this.onExecuteReadSql(sql) 
    }
  
    /**
     * 根据id获取节点
     * @param nodeId 
     */
    async getNode(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId):Promise<TreeNode | undefined>{ 
        const sql = this._sql(`SELECT * FROM ${this.tableName} 
            WHERE {__TREE_ID__} (${this.keyFields.id}=${escapeSqlString(nodeId)})`)
        const result = await this.onExecuteReadSql(sql)
        if(result.length === 0) throw new FlexTreeNodeNotFoundError()
        return result[0] as TreeNode
    } 

    /**
     * 获取指定节点的所有后代
     * 
     * @param node 
     * @param options 
     *  - level:        限制返回的级别
     *  - includeSelf:  返回结果是否包括自身
     */
    async getDescendants(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId,options?:{level?:number,includeSelf?:boolean}):Promise<IFlexTreeNode[]>{
        const { level,includeSelf} =Object.assign({includeSelf:false,level:0},options)
        let sql:string =''
        if(level==0){  //不限定层级
            sql=this._sql(`SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${escapeSqlString(nodeId)}
                WHERE 
                  {__TREE_ID__} 
                  ((Node.${this.keyFields.leftValue} > RelNode.${this.keyFields.leftValue}
                  AND Node.${this.keyFields.rightValue} < RelNode.${this.keyFields.rightValue})                  
                  ${includeSelf ? `OR Node.${this.keyFields.id} = ${escapeSqlString(nodeId)}` : ''})     
                ORDER BY ${this.keyFields.leftValue}             
                `)
        }else{ //限定层级
            sql=this._sql(`SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${escapeSqlString(nodeId)}
                WHERE 
                {__TREE_ID__} 
                ((Node.${this.keyFields.leftValue} > RelNode.${this.keyFields.leftValue}
                AND Node.${this.keyFields.rightValue} < RelNode.${this.keyFields.rightValue}
                -- 限定层级
                AND Node.${this.keyFields.level} > RelNode.${this.keyFields.level}
                AND Node.${this.keyFields.level} <= RelNode.${this.keyFields.level}+${level})
                ${includeSelf ? `OR Node.${this.keyFields.id} = ${escapeSqlString(nodeId)}` : ''})
                ORDER BY ${this.keyFields.leftValue}             
            `)
        }
        // 得到的平面形式的节点列表
        return await this.onExecuteReadSql(sql)      
    }
    /**
     * 获取后代节点数量
     */
    async getDescendantCount(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId){ 
        const sql = this._sql(`SELECT COUNT(*) FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
                (   
                    Node.${this.keyFields.leftValue} > RelNode.${this.keyFields.leftValue}
                    AND Node.${this.keyFields.rightValue} < RelNode.${this.keyFields.rightValue}
                )       
        `)        
        return await this.getScalar(sql)
    } 

    /**
     * 仅获取子节点
     * 
     * @param nodeId 
     * @returns 
     */
    async getChildren(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId){
        return await this.getDescendants(nodeId,{level:1})
    }

    /**
     * 获取所有祖先节点,包括父节点
     * @param node 
     * @param options 
     */
    async getAncestors(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId,options?:{includeSelf?:boolean}){
        const { includeSelf } = Object.assign({includeSelf:false},options)
        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
            (
                (   
                    Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue}
                    AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue}
                )   
                ${includeSelf ? `OR Node.${this.keyFields.id} = ${escapeSqlString(nodeId)}` : ''})
            ) 
            ORDER BY ${this.keyFields.leftValue}     
        `)        
        return await this.getNodeList(sql)  
    }
    /**
     *  获取祖先节点数量(不包括自身)
     * @param nodeId
     */
    async getAncestorsCount(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId){
        const sql = this._sql(`SELECT COUNT(*) FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__} 
                (   
                    Node.${ this.keyFields.leftValue} < RelNode.${ this.keyFields.leftValue }
                    AND Node.${ this.keyFields.rightValue} > RelNode.${ this.keyFields.rightValue }
                )       
        `)        
        return await this.getScalar(sql)  
    }

    /**
     * 获取父节点
     * @param nodeId 
     * @returns 
     */
    async getParent(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId):Promise<TreeNode>{ 
        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${escapeSqlString(nodeId)}
            WHERE {__TREE_ID__}  
            (   
                Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue}
                AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue}
            )  
            ORDER BY ${this.keyFields.leftValue} DESC LIMIT 1     
        `)        
        const result = await this.onExecuteReadSql(sql)  
        if(result.length === 0) throw new FlexTreeNodeNotFoundError()
        return result[0] as TreeNode
    }
    /**
     * 获取所有兄弟节点
     * 
     * SELECT Node.* FROM user Node
        JOIN (
        SELECT Node.* FROM user Node
        JOIN user RelNode ON RelNode.id = 'd'
        WHERE (Node.tree_left < RelNode.tree_left 
        AND Node.tree_right > RelNode.tree_right  ) 
        ORDER BY Node.tree_left DESC LIMIT 1
        ) ParentNode
        WHERE 
            (
                Node.tree_left > ParentNode.tree_left 
                AND Node.tree_right < ParentNode.tree_right  
                AND Node.tree_level =  ParentNode.tree_level +1
            ) 
        ORDER BY Node.tree_left 


     * @param node 
     * @param options 
     */
    async getSiblings(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId,options?:{includeSelf?:boolean}){
        const { includeSelf } = Object.assign({includeSelf:false},options)
        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN (
                SELECT Node.* FROM ${this.tableName} Node
                JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${escapeSqlString(nodeId)}
                WHERE 
                    (Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue} 
                    AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue} )
                ORDER BY Node.${this.keyFields.leftValue} DESC LIMIT 1
            ) ParentNode
            WHERE {__TREE_ID__}  
            (
                (
                    Node.${this.keyFields.leftValue} > ParentNode.${this.keyFields.leftValue} 
                    AND Node.${this.keyFields.rightValue} < ParentNode.${this.keyFields.rightValue}
                    AND Node.${this.keyFields.level} = ParentNode.${this.keyFields.level}+1
                    ${includeSelf ? '' : `AND Node.${this.keyFields.id} != ${escapeSqlString(nodeId)}`}
                )                
            )
            ORDER BY ${this.keyFields.leftValue}     
        `)        
        return await this.getNodeList(sql) 
    }
    
    /**
     * 获取下一个兄弟节点
     * 
       下一节点应满足：同一级别，同一棵树,Left要大于node.tree_left,且具有同一个

       SELECT Node.* FROM user Node
        JOIN user RelNode ON RelNode.id = 'g'
        WHERE 
            (Node.tree_left = RelNode.tree_right+1   
        AND Node.tree_id=0
        ) LIMIT 1  


     * @param nodeId 
     * @param options 
     */
    async getNextSiblings(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId){
        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.id = ${escapeSqlString(nodeId)}             
            WHERE {__TREE_ID__}  
                (
                    Node.${this.keyFields.leftValue} = RelNode.${this.keyFields.rightValue}+1  
                )     
            LIMIT 1`)     
        return await this.getOneNode(sql)   
    }

    /**
     * 获取上一个兄弟节点
     * @param nodeId 
     * @param options 
     */
    async getPreviousSibling(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodeId:NodeId){
        const sql = this._sql(`SELECT Node.* FROM ${this.tableName} Node
            JOIN ${this.tableName} RelNode ON RelNode.id = ${escapeSqlString(nodeId)}             
            WHERE {__TREE_ID__}  
                (
                    Node.${this.keyFields.rightValue} = RelNode.${this.keyFields.leftValue}-1  
                )     
            LIMIT 1`)        
        return await this.getOneNode(sql)   
    }
    


    /**
     * 获取根节点
     * 
     * 一棵树仅有一个根节点,所以只需要获取leftValue=1的节点即可 
     * 
     */
    async getRoot(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>){
        const sql = this._sql(`SELECT * FROM ${this.tableName} 
                        WHERE {__TREE_ID__} ${this.keyFields.leftValue}=1`)
        return await this.getOneNode(sql)   
    }

}