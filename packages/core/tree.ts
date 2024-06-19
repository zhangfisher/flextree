import { FlexTreeOptions } from "./types"


export class FlexTree<Node extends IFlexNode=IFlexNode>{
    private _options:DeepRequired<FlexTreeOptions>
    constructor(options:FlexTreeOptions){
        this._options = Object.assign({},options) as Required<FlexTreeOptions>
    }
    get options(){
        return this._options
    }
}