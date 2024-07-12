
import { IFlexTreeNode } from "./types";
import { Dict } from "flex-tools/type/dict"

export class FlexTreeNode<T extends Record<string,any>={},IdType=string,TreeIdType=number> implements IFlexTreeNode{
    _data:Required<IFlexTreeNode<T,IdType,TreeIdType>>
    constructor(data:Dict<string>){
        this._data = data  as Required<IFlexTreeNode<T,IdType,TreeIdType>>

    }
    get id(){ return this._data.id  }
    get name(){ return this._data.name }
    get level(){  return this._data.level }
    get leftValue(){ return this._data.leftValue }
    get rightalue(){ return this._data.rightValue } 
    get data(){ return this._data } 

    get isRoot(){
        return this.level == 0 && this.leftValue==1
    }
    /**
     * 返回子节点
     */
    get children(){
        
    }

    private _parseChildren(){

    }

    get parent(){

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