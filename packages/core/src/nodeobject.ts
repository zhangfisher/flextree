
    // /**
    //  * 返回所有子节点
    //  */
    // async getChildren(){
    //     return await this._tree.manager.getChildren(this._id)
    // }

    // async getParent(){
    //     return await this._tree.manager.getParent(this._id)
    // } 
    // async getPrevious(){
    //     return await this._tree.manager.getPreviousSibling(this._id)
    // }
    // async getNext(){
    //     return await this._tree.manager.getNextSibling(this._id)
    // }    
    // async getSiblings(includeSelf:boolean = false){
    //     return await this._tree.manager.getSiblings(this._id,{includeSelf})
    // }
    // async getDescendants(options?:{includeSelf:boolean,level:number}){
    //     return await this._tree.manager.getDescendants(this._id,options)
    // }
    // async getAncestors(options?:{includeSelf:boolean,level:number}){
    //     return await this._tree.manager.getAncestors(this._id,options)
    // }
    // async getChild(index:number = 1){
    //      return this._tree.manager.getChild(this._id,index)
    // }
    // async addChild(nodes:TreeNode[]){
    //     return await this._tree.manager.addNodes(nodes,this._node as TreeNode,FlexNodeRelPosition.LastChild)
        
    // }
    // async removeChild(nodeId:NodeId){
    //     await this._tree.manager.deleteNode(nodeId)
    //     this._tree.nodes.delete(nodeId)
    // }
    // async moveTo(targetNode:NodeId | TreeNode,position:FlexNodeRelPosition){
    //     return await this._tree.manager.moveNode(this._id,targetNode,position)
    // }    
    // async moveUp(){
    //     await this._tree.manager.moveUpNode(this._id)
    // }
    // async moveDown(){
    //     await this._tree.manager.moveDownNode(this._id)
    // }