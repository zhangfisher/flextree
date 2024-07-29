

export type createArrayProxyOptions = {}

/**
 * 创建一个数组代理，
 * 
 * - 可以监听数组的push操作，当数据被push进数组时，触发onAdd回调
 * 
 * 
 *   
 * 
 * @param arr 
 * @param onPush 
 * @returns 
 */
export function createArrayProxy<T extends object=Array<any>>(arr:T,options:{onAdd:(index:number,item:any)=>void}){
    const { onAdd } = Object.assign({},options)
    return new Proxy<T>(arr,{
        set(target, index, value, receiver) {            
            if(!Object.prototype.hasOwnProperty.call(target,index)){
                if(!Object.hasOwn(target,index)){
                    onAdd(Number(index),value)
                }
            }
            return Reflect.set(target, index, value, receiver)
        }
    }) as T
}


