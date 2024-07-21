import {type FlexTreeManager } from "../manager";
import { CustomTreeKeyFields, DefaultTreeKeyFields, FlexNodeRelPosition, FlexTreeNodeRelation, IFlexTreeNode, NonUndefined } from "../types";
import { FlexTreeError, FlexTreeNodeNotFoundError } from "../errors"


export class SqlMixin<
    Data extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
>{ 
    
    /**
     * 执行读取操作
     * @param sqls 
     * @returns 
     */    
    async onExecuteReadSql(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,sql:string):Promise<any>{
        await this.assertDriverReady()        
        return await this.driver.getRows(sql)
    } 
     
    
    /**
     * 执行操作，无返回值
     * @param sqls 
     * @returns 
     */
    async onExecuteSql(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,sqls:string[]):Promise<any>{        
        await this.assertDriverReady()        
        return await this.driver.exec(sqls) 
    } 

    async onExecuteWriteSql(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,sqls:string[]):Promise<any>{        
        await this.assertDriverReady()        
        return await this.driver.exec(sqls) 
    } 
    async onGetScalar(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,sql:string):Promise<any>{        
        await this.assertDriverReady()        
        return await this.driver.getScalar(sql) 
    } 
    /**
     * 构建sql时调用，进行一些额外的处理
     * 
     *
     * @param sql 
     */
    protected _sql(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,sql:string){
        // 在一表多树时,需要增加额外的树判定
        if(this.treeId){
            const treeId = typeof(this.treeId)=='string' ? `'${this.treeId}'` : this.treeId  
            sql = sql.params({__TREE_ID__: `${this.keyFields.treeId}=${treeId} AND ` ||''})
        }else{
            sql = sql.params({__TREE_ID__:''})
        }      
        return sql
    }


    protected async getOneNode(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,sql:string):Promise<TreeNode>{        
        const result = await this.onExecuteReadSql(sql)  
        if(result.length === 0) throw new FlexTreeNodeNotFoundError()
        return result[0] as TreeNode
    }
    
    protected async getNodeList(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,sql:string):Promise<TreeNode[]>{        
        return await this.onExecuteReadSql(sql)  
    }
    protected async getScalar<T=number>(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,sql:string):Promise<T>{        
        return await this.driver.getScalar(sql)  as T
    }
}