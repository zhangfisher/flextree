
import {  CustomTreeKeyFields, DefaultTreeKeyFields, FlexTreeUpdater, IFlexTreeNode, NonUndefined } from "./types" 

export class FlexTreeNode<
    Fields extends Record<string,any> = Record<string,any>,                 // 额外的节点字段    
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields
    > implements IFlexTreeNode<Fields,KeyFields>{

    _data:Required<IFlexTreeNode<T,IdType,TreeIdType>>
    constructor(data:Dict<string>){
        this._data = data  as Required<IFlexTreeNode<Fields,KeyFields>>

    }
    get id(){ return this._data.id  }
    get name(){ return this._data.name }
    get level(){  return this._data.level }
    get leftValue(){ return this._data.leftValue }
    get rightalue(){ return this._data.rightValue } 
    get data(){ return this._data } 
 
    // /**
    //  * 返回子节点
    //  */
    // get children(){
        
    // }

    // private _parseChildren(){

    // }

    // get parent(){

    // } 

    // get previous(){

    // }
    // get next(){

    // }

    // get firstChild(){

    // }
    // get lastChild(){

    // }

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