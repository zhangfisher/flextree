
import { CustomTreeKeyFields, DefaultTreeKeyFields, FlexTreeExportNestedFormat, FlexTreeExportOptions, FlexTreeExportPidFormat, IFlexTreeNode, NonUndefined } from './types';
import type { FlexTree} from "./tree"
import { FlexTreeInvalidError, FlexTreeNodeNotFoundError, FlexTreeNotFoundError } from './errors';
import { filterObject } from "./utils/filterObject";
import { getRelNodePath } from "./utils/getRelNodePath";
import { pick } from 'flex-tools/object/pick';
import { omit } from 'flex-tools/object/omit';

export class FlexTreeNode<
        Fields extends Record<string,any>={},
        KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
        TreeNode extends IFlexTreeNode<Fields,KeyFields> = IFlexTreeNode<Fields,KeyFields>,
        NodeId = NonUndefined<KeyFields['id']>[1],
        TreeId = NonUndefined<KeyFields['treeId']>[1]
    >{
    private _id:NodeId
    private _tree:FlexTree<Fields,KeyFields,TreeNode,NodeId,TreeId>
    private _node: IFlexTreeNode<Fields,KeyFields>
    private _children?:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId>[]  
    private _parent:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId> | undefined        
    constructor(node:TreeNode,parent:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId> | undefined ,tree:FlexTree<Fields,KeyFields,TreeNode,NodeId,TreeId>){
        this._id = node[tree.manager.keyFields.id]
        this._tree = tree
        this._parent = parent
        this._node = node
        if(node.rightValue-node.leftValue>1){
            this._children = []
        }
    } 
    get id():NodeId{ return this._id  }
    get name(){ return this._node.name }
    set name(value:string){ this._node.name = value }
    get level(){  return this._node.level }    
    get leftValue(){ return this._node.leftValue }
    get rightalue(){ return this._node.rightValue } 
    get treeId(){ return this._node.rightValue }     
    get tree(){ return this._tree }
    get data(){ return this._node as TreeNode }
    get root(){ return this._tree.root }
    get parent(){ return this._parent }    
    get children(){ return this._children }
    get siblings(){ 
        if(this._parent){
            return this._parent.children?.filter(n=>n.id!=this.id)
        }
    }    
    get descendants(){
        const descendants:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId>[] = []
        if(this._children){
            for(let node of this._children){
                descendants.push(node)
                descendants.push(...node.descendants)
            }
        }
        return descendants
    }
    get ancestors(){
        const ancestors:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId>[] = []
        let parent = this._parent
        while(parent){
            ancestors.splice(0,0,parent)
            parent = parent.parent
        }
        return ancestors
    }
    
    /**
     * 从数据库中同步数据 
     */
    async sync(includeDescendants:boolean = false){  
        const node = await this._tree.manager.getNode(this._id)
        if(!node) throw new FlexTreeNodeNotFoundError(`Node ${this._id} not found`)
        this._node = node
        if(this._children && includeDescendants){     
            Promise.all(this._children.map(n=>n.sync(includeDescendants)))                   
        }
    } 
    /**
     * 
     * 更新节点数据 
     * 不包括关键字段
     * 
     */
    async update(data:Partial<TreeNode>){        
        const nodeData =  filterObject(data,(k,v)=>{
            return !(k in this._tree.manager.keyFields) 
            || k===this._tree.manager.keyFields.name         
        })
        nodeData[this._tree.manager.keyFields.id] = this._id
        await this._tree.manager.write(async ()=>{
            await this._tree.manager.update(nodeData)
        }) 
        Object.assign(this._node,nodeData)
    }

    /**
     * 
     * 根据输入的路径获取节点
     * 
     * 1. 以当前节点开始
     *    getByPath("A-1/A-1-1")        
     *    getByPath("A-1/A-1-1")
     * 2. ./代表当前节点
     *    getByPath("./A-1/A-1-1")
     * 3. ../代表父节点
     *    getByPath("../A-1-1")
     *    getByPath("../../A-1-1")
     * 4. /代表根节点
     *    getByPath("/A-1-1") 
     * 
     * 
     * 
     * 
     * @param path 
     * @param ofe 
     */
    getByPath(path:string,options?:{byField?:string,delimiter?:string}):FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId> | undefined{
        const {byField,delimiter} = Object.assign({byField:this._tree.manager.keyFields.name,delimiter:"/"},options)
        let [entryNode,entryPath] = getRelNodePath(this as any,path,delimiter) as  [FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId> ,string]
        for(let subpath of entryPath.split(delimiter)){
            if(subpath=='') continue
            if(entryNode.children){
                const index = entryNode.children.findIndex((n:any)=>n[byField] == subpath)
                if(index>=0){
                    entryNode = entryNode.children[index]
                }else{
                    return undefined
                }
            }else{
                return undefined
            }
        }
        return entryNode as FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId> 
    }
    /**
    * 获取该节点下id=nodeId的节点实例
    */
    get(nodeId:NodeId,includeDescendants:boolean=false):FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId> | undefined{
        if(this.id===nodeId) return this
        if(this._children){
            for(let node of this._children){
                if(node.id == nodeId){
                    return node
                }else{                   
                    if(includeDescendants){
                        const n = node.get(nodeId,includeDescendants)
                        if(n) return n
                    }
                }
            }
        }
    }
    /**
     * 返回符合条件的子节点和后代节点集合
     * @param fn 
     * @returns 
     */
    find(condition:(node:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId>)=>boolean,includeDescendants:boolean=true):FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId>[] {
        const nodes:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId>[] = []
        if(this._children){
            for(let node of this._children){
                if(condition(node)){
                    nodes.push(node)                
                }
                if(includeDescendants){
                    nodes.push(...node.find(condition,includeDescendants))                
                }
            }
        }
        return nodes
    }   
    /**
     *  加载节点及子节点并创建节点实例 
     */
    async load(){   
        const nodes = (await this.tree.manager.getDescendants(this._id, { includeSelf: true })) as unknown as TreeNode[]
        if(!nodes || nodes.length==0){
            throw new FlexTreeNotFoundError()
        }
        Object.assign(this._node,nodes[0])          // 更新节点数据

        const pnodes:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId>[] = [this]
        let preNode:FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId> = this

        for(let node of nodes){  
            if(node.id == this._id) continue              
            if(node.level == preNode.level){
                const parent = pnodes[pnodes.length-1]
                const nodeObj = new FlexTreeNode<Fields,KeyFields,TreeNode,NodeId,TreeId>(node,parent,this as any)
                parent.children!.push(nodeObj) 
                preNode = nodeObj
            }else if(node.level > preNode.level  ){
                if(node.level == preNode.level + 1){                        
                    const nodeObj = new FlexTreeNode(node,preNode,this as any)
                    preNode.children!.push(nodeObj) 
                    preNode = nodeObj
                    if(node.rightValue-node.leftValue > 1){                            
                        pnodes.push(preNode)
                    }
                }else{
                    throw new FlexTreeInvalidError(`Invalid tree structure`)
                }                    
            }else if(node.level < preNode.level){
                while(true){
                    let parent = pnodes[pnodes.length-1]
                    if(parent && node.level == parent.level + 1){
                        const nodeObj = new FlexTreeNode(node,parent,this as any)
                        parent.children!.push(nodeObj) 
                        preNode = nodeObj
                        if(node.rightValue-node.leftValue > 1){                            
                            pnodes.push(preNode)
                        }
                        break
                    }else if(pnodes.length == 0){
                        break
                    }else{
                        pnodes.pop()                        
                    }
                }
                
            }
        }  
    } 


    /**
     * 导出当前节点及其后代节点
     * 
     * export({format:"nested",
     *  fields:["name","level","leftValue","rightValue"]          // 导出指定字段
     * })
     * 
     */
    export<Format extends FlexTreeExportOptions['format'] = 'nested',        
        OPTIONS extends FlexTreeExportOptions<Fields,KeyFields,NodeId,TreeId> = FlexTreeExportOptions<Fields,KeyFields,NodeId,TreeId>,        
        Returns = Format extends 'nested' ? FlexTreeExportNestedFormat<Fields,KeyFields,TreeNode,NodeId> 
                                            : FlexTreeExportPidFormat<Fields,KeyFields,TreeNode,NodeId,TreeId,OPTIONS>
    >(options?:OPTIONS):Returns{
        const  opts = Object.assign({
            format              : "nested",
            childrenField       : 'children',
            pidField            : 'pid',
            fields              : [],
            level               : 0,                // 限定节点的级别
            includeKeyFields    : false                    
        },options) as Required<FlexTreeExportOptions<Fields,KeyFields,NodeId,TreeId>>        
        const {format,childrenField,pidField,includeKeyFields,level,fields}  = opts 
        // 当指字了fields时,确保包含id字段,不包括treeId字段
        if(fields.length>0){                        
            if(fields.includes(this._tree.manager.keyFields.id)){// 导出一定会包括主键id
                fields.push(this._tree.manager.keyFields.id)
            }            
            const index  = fields.findIndex(name=>name==this._tree.manager.keyFields.treeId)// 移除treeId字段
            if(index>=0) fields.splice(index,1)
        }     
        // 提取节点数据
        const pickNodeData=(data:any)=>{            
            if(fields.length>0){
                return pick(data,fields as string[]) as any 
            }else{
                if(includeKeyFields){
                    return Object.assign({},data)
                }else{
                    if(includeKeyFields){
                        return Object.assign({},omit(data,Object.values(this._tree.manager.keyFields),true))
                    }else{
                        return Object.assign({},omit(data,[
                            this._tree.manager.keyFields.leftValue,
                            this._tree.manager.keyFields.rightValue,
                        ],true))
                    }
                }
            }
        }

        let results:Returns 
        if(format=='pid'){  
            // @ts-ignore 
            results = []
            const curNodedata = pickNodeData(this._node)
            curNodedata[pidField] =this.parent ? this.parent.id : 0
            // @ts-ignore
            results.push(curNodedata)
            if(this._children){
                for(let node of this._children){     
                    const children = node.export(opts) as any [] 
                    // @ts-ignore
                    results.push(...children)
                }
            }
        }else{
            results = pickNodeData(this._node)
            if(this._children){           
                // @ts-ignore     
                results[childrenField] = this._children.map(n=>n.export(opts)) 
            }       
        } 
        return results as Returns
    }
    toString(){
        return `${this.name}(${this._id})`
    }
}