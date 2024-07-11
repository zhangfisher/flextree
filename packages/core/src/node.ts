
import { IFlexTreeNode } from "./types";
import { Dict } from "flex-tools/type/dict"

export class FlexTreeNode<T extends Record<string,any>= IFlexTreeNode>{
    _data:IFlexTreeNode<T>
    constructor(data:Dict<string>){
        this._data = data  as IFlexTreeNode<T>    
    }
    get treeId(){ return this._data.treeId }
    get title(){ return this._data.title  }
    get level(){  return this._data.level }
    get leftValue(){ return this._data.leftValue }
    get rightalue(){ return this._data.rightValue }
    get order(){ return this._data.order }

    get isRoot(){
        return this.level == 0
    }


    get parent(){

    }
    get children(){

    }

    get previous(){

    }
    get next(){

    }

    get firstChild(){

    }
    get lastChild(){

    }

    addChild(){
        
    }
    removeChild(){

    }
    insertBefore(){

    }
    insertAfter(){

    }
    

    moveUp(){

    }
    moveDown(){

    }

    moveTo(){

    }


}