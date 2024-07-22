import {type FlexTreeManager } from "../manager";
import { CustomTreeKeyFields, DefaultTreeKeyFields, FlexNodeRelPosition, IFlexTreeNode, NonUndefined } from "../types";
import { FlexTreeError } from "../errors"
import { escapeSqlString } from '../utils/escapeSqlString';


export class AddNodeMixin<
    Data extends Record<string,any>={},
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Data,KeyFields> = IFlexTreeNode<Data,KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
>{  
    /**
     * 
     * 将nodes添加到relNode的子节点集的最后面
     * 
     * @param relNode 
     * @param nodes 
     * @param fields 
     * @returns 
     */
    protected _addLastChilds(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,relNode:TreeNode,nodes:Partial<TreeNode>[],fields:string[]){ 
        const values = nodes.map((node,i)=>{
            let row = [
                relNode[this.keyFields.level] + 1,
                relNode[this.keyFields.rightValue] + i*2,
                relNode[this.keyFields.rightValue] + i*2 +1
            ]
            for(let i=3;i<fields.length;i++){
                row.push(escapeSqlString(node[fields[i]]))
            } 
            return `(${row.join(',')})`
        }).join(',')
        return [
            this._sql(`
                UPDATE ${this.tableName} SET ${this.keyFields.leftValue} = ${this.keyFields.leftValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this.keyFields.leftValue} >= ${relNode[this.keyFields.rightValue]}
            `),
            this._sql(`
                UPDATE ${this.tableName} SET ${this.keyFields.rightValue} = ${this.keyFields.rightValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this.keyFields.rightValue} >= ${relNode[this.keyFields.rightValue]}
            `),                     
            this._sql(`
                INSERT INTO ${this.tableName} ( ${fields.map(f=>escapeSqlString(f)).join(",")}) 
                VALUES ${values}
            `)
        ]
    }
    /**
     * 
     * 将nodes添加到relNode的子节点集的最前面
     * 
     */
    protected  _addFirstChilds(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,relNode:TreeNode,nodes:Partial<TreeNode>[],fields:string[]){ 
        const values = nodes.map((node,i)=>{
            let row = [
                relNode[this.keyFields.level] + 1,
                relNode[this.keyFields.leftValue] + i*2 +1,
                relNode[this.keyFields.leftValue] + i*2 +2
            ]
            for(let i=3;i<fields.length;i++){
                row.push(escapeSqlString(node[fields[i]]))
            } 
            return `(${row.join(',')})`
        }).join(',')
        return [
            this._sql(`
                UPDATE ${this.tableName} SET ${this.keyFields.leftValue} = ${this.keyFields.leftValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this.keyFields.leftValue} > ${relNode[this.keyFields.leftValue]}
            `),
            this._sql(`
                UPDATE ${this.tableName} SET ${this.keyFields.rightValue} = ${this.keyFields.rightValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this.keyFields.rightValue} >= ${relNode[this.keyFields.leftValue]+1}
            `),                     
            this._sql(`
                INSERT INTO ${this.tableName} ( ${fields.map(f=>escapeSqlString(f)).join(",")}) 
                VALUES ${values}
            `)
        ]

    }
    protected  _addNextSiblings(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,relNode:TreeNode,nodes:Partial<TreeNode>[],fields:string[]){ 
        const values = nodes.map((node,i)=>{
            let row = [
                relNode[this.keyFields.level],
                relNode[this.keyFields.rightValue] + i*2 +1,
                relNode[this.keyFields.rightValue] + i*2 +2
            ]
            for(let i=3;i<fields.length;i++){
                row.push(escapeSqlString(node[fields[i]]))
            } 
            return `(${row.join(',')})`
        }).join(',')
        return [
            this._sql(`
                UPDATE ${this.tableName} SET ${this.keyFields.leftValue} = ${this.keyFields.leftValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this.keyFields.leftValue} > ${relNode[this.keyFields.rightValue]}
            `),
            this._sql(`
                UPDATE ${this.tableName} SET ${this.keyFields.rightValue} = ${this.keyFields.rightValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this.keyFields.rightValue} > ${relNode[this.keyFields.rightValue]}
            `),                     
            this._sql(`
                INSERT INTO ${this.tableName} ( ${fields.map(f=>escapeSqlString(f)).join(",")}) 
                VALUES ${values}
            `)
        ]
    }
    protected  _addPreviousSiblings(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,relNode:TreeNode,nodes:Partial<TreeNode>[],fields:string[]){ 
        const values = nodes.map((node,i)=>{
            let row = [
                relNode[this.keyFields.level],
                relNode[this.keyFields.leftValue] + i*2,
                relNode[this.keyFields.leftValue] + i*2 +1
            ]
            for(let i=3;i<fields.length;i++){
                row.push(escapeSqlString(node[fields[i]]))
            } 
            return `(${row.join(',')})`
        }).join(',')
        return [
            this._sql(`
                UPDATE ${this.tableName} SET ${this.keyFields.leftValue} = ${this.keyFields.leftValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this.keyFields.leftValue} >= ${relNode[this.keyFields.leftValue]}
            `),
            this._sql(`
                UPDATE ${this.tableName} SET ${this.keyFields.rightValue} = ${this.keyFields.rightValue} + ${nodes.length*2} 
                WHERE {__TREE_ID__} ${this.keyFields.rightValue} > ${relNode[this.keyFields.leftValue]}
            `),                     
            this._sql(`
                INSERT INTO ${this.tableName} ( ${fields.map(f=>escapeSqlString(f)).join(",")}) 
                VALUES ${values}
            `)
        ]

    }
    /**
     * 
     * 增加多个节点
     * 
     * addNodes([
     *  {...},
     *  {...}
     * ],'nodeId',FlexNodeRelPosition.LastChild)
     * 
     * 
     * 1. 批量插入时，需要保证节点数据的字段名称是一样的，比如
     *    addNode([{id:1,name:'test'},{id:2,xname:'test2'}])  // ❌错误
     * 2. 所有关键字段中(id,name,treeId,leftValue,rightValue,level)中，
     *      leftValue,rightValue,level是自动计算的，不需要手动输入
     *      id字段则取决于数据库表设计，如果是自增则不必设置，否则需要
     *      treeId则是在
     * 
     * 
     * ，id是自增的，则可以不必指定，是可选的
     * 3. 如果是单树表，可以不必指定treeId,如果是多树表，则必须指定
     * 
     * 
     * 
     * @param nodes
     * @param atNode     添加到的目标节点的指定位置， undefined代表根节点
     * @param pos            添加的位置，默认为最后一个子节点
     * 
     */
    async addNodes(this:FlexTreeManager<Data,KeyFields,TreeNode,NodeId,TreeId>,nodes:Partial<TreeNode>[],atNode?:NodeId | TreeNode | null, pos:FlexNodeRelPosition = FlexNodeRelPosition.LastChild){
        this._assertUpdating()

        if(nodes.length == 0) return

        // 1. 先获取要添加的目标节点的信息，得到目标节点的leftValue,rightValue,level等
        const relNode = await this.getNodeData(atNode) 

        // 2. 检查添加位置是否合法
        if(this.isRoot(relNode!)){ 
            if(pos == FlexNodeRelPosition.NextSibling || pos == FlexNodeRelPosition.PreviousSibling){
                throw new FlexTreeError('Root node can not have next and previous sibling node')
            }
        }

        // 2. 处理节点数据:   单树表不需要增加treeId字段
        const fields:string[] = [
            this.keyFields.level,
            this.keyFields.leftValue,
            this.keyFields.rightValue
        ]
        if(this.isMultiTree) fields.push(this.keyFields.treeId)        
        fields.push(...Object.keys(nodes[0]).filter(f=>!fields.includes(f)))// 添加其他字段


        let sqls:string[] = []
        
        if(pos== FlexNodeRelPosition.LastChild){           
            sqls = this._addLastChilds(relNode,nodes,fields) 
        }else if(pos==FlexNodeRelPosition.FirstChild){
            sqls = this._addFirstChilds(relNode,nodes,fields) 
        }else if(pos== FlexNodeRelPosition.NextSibling){
            sqls= this._addNextSiblings(relNode,nodes,fields)
        }else if(pos == FlexNodeRelPosition.PreviousSibling){
            sqls = this._addPreviousSiblings(relNode,nodes,fields)
        }
        await this.onExecuteWriteSql(sqls)
    } 

}