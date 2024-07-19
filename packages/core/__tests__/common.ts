import Database from "better-sqlite3"
import { FlexTreeManager, IFlexTreeNode,FlexTreeVerifyError } from "../src/index";
import SqliteDriver  from "../../sqlite/src/index" 

 

export async function createTreeTable(driver:SqliteDriver){
    await driver.exec([`
        CREATE TABLE IF NOT EXISTS  tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60),              
            treeId INTEGER, 
            level INTEGER,  
            leftValue INTEGER, 
            rightValue INTEGER
        );
    `])
}
export async function createMultiTreeTable(driver:SqliteDriver){
    await driver.exec([`
        CREATE TABLE IF NOT EXISTS  tree (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(60), 
            treeId INTEGER, 
            level INTEGER,  
            leftValue INTEGER, 
            rightValue INTEGER,
            UNIQUE(treeId, leftValue)
        );
    `]) 
}
async function clearAllTables(driver: SqliteDriver) {   
    await driver.exec([`DELETE FROM tree`]); 
}

export async function createTreeManager(treeId?:any){
    const sqliteDriver = new SqliteDriver()
    await sqliteDriver.open()    
    if(treeId){
        await createMultiTreeTable(sqliteDriver)
    }else{
        await createTreeTable(sqliteDriver)
    } 
    await clearAllTables(sqliteDriver)
    return new FlexTreeManager("tree",{
        treeId,
        driver: sqliteDriver
    })    
}

/**
 * 
 * 生成一个 demo 树，树的结构如下：
 root:
  - A:
    - A1:
      - A11
      - A12
      - A13
      - A14
      - A15
  - B:
    - B1:
      - B11
      - B12
      - B13
      - B14
      - B15

 * @param tree 
 * @param level 
 */
export async function createDemoTree(tree:FlexTreeManager,options?:{level?:number,treeCount?:number}){
    const { level,treeCount } = Object.assign({level:3,treeCount:1},options)
    const names=["A","B","C","D","E","F"]
    for(let treeId=1;treeId<=treeCount;treeId++){
        await tree.update(async ()=>{
            await tree.createRoot({id:1,name:"root",treeId})
            // level=1:   id=100,200,300,400,500,600,700
            await tree.addNodes(names.map((name,index)=>{
                return {name,id:(index+1)*100,treeId}
            }))    
            async function createNodes(pid:number,pname:string,lv:number){
                const nodes =  new Array(5).fill(0).map<any>((_,i)=>{ 
                    return {name:`${pname}_${i+1}`,id:parseInt(`${pid}${Number(i)+1}`),treeId} 
                })
                await tree.addNodes(nodes,pid)
                if(lv<level){
                    for(let node of nodes){ 
                        await createNodes(node.id,node.name,lv+1)
                    }
                }
            }
            for(let [index,name] of Object.entries(names)){ 
                await createNodes((Number(index)+1)*100,name,2)
            }        
        })
    }
}


/**
 * 将srceDb的树复制到destDb
 * 
 * 单元测试使用内存数据库，调试过程中不方便查看表数据
 * 所以在每个Case后将数据转存到数据库文件以便查看
 * 
 * @param srcDb 
 */
export async function dumpTree(srcDb:any,dbFile:string="tree.db"){
    const destDb = new Database(`./dumps/${dbFile}`) 
    await destDb.exec(`
        CREATE TABLE IF NOT EXISTS tree (        
            id INTEGER PRIMARY KEY,
            treeId INTEGER, 
            level INTEGER,  
            name VARCHAR(60),  
            leftValue INTEGER, 
            rightValue INTEGER
    )`)
    const rows = srcDb.prepare("SELECT * FROM tree").all()
    await destDb.exec("BEGIN")
    await destDb.prepare("DELETE FROM tree").run()
    for(let row of rows){
        await destDb.prepare("INSERT INTO tree (name,level,leftValue,rightValue) VALUES (?,?,?,?)").run(row.name,row.level,row.leftValue,row.rightValue)
    }
    await destDb.exec("COMMIT")
}


/**
 * 
 * 对通过createDemoTree生成的树进行全树验证
 * 
 * 主要验证左右值是否正确，如果不正确则抛出异常
 * 
 * @param nodes 
 */
export function verifyTree(nodes:IFlexTreeNode[]):boolean{
    
    let pnodes:IFlexTreeNode[] = []
    for(let i = 0 ; i < nodes.length; i++){
        const node = nodes[i]
        if(i==nodes.length-1){
            console.log("111")
        }
        if(node.rightValue - node.leftValue == 1){  // 无子节点
            if(pnodes.length>0){
                let pnode = pnodes[pnodes.length-1]
                if(pnode.level!=node.level-1){
                    throw new FlexTreeVerifyError(`level error ${node.name}(${node.id})`)
                }else if(!(node.leftValue > pnode.leftValue)){
                    throw new FlexTreeVerifyError(`leftValue error ${node.name}(${node.id})`)
                }else if(!(node.rightValue < pnode.rightValue)){
                    throw new FlexTreeVerifyError(`rightValue error ${node.name}(${node.id})`)
                }                
                // 子节点结束
                if(node.rightValue+1==pnode.rightValue){
                    let preNode = pnodes.pop()          
                    if(pnodes.length>0){                              
                        while(preNode!.rightValue+1 == pnodes[pnodes.length-1]?.rightValue){
                            preNode = pnodes.pop()  
                            if(pnodes.length==0) break
                        }
                    }                    
                }
            }
            if((node.rightValue - node.leftValue - 1) % 2 !=0){
                throw new FlexTreeVerifyError(`${node.name}(${node.id}) rightValue - leftValue error `)        
            }
        }else if(node.rightValue - node.leftValue>=3){ // 有子节点
            //  rightValue-leftValue一定是奇数,否则说明有问题
            if((node.rightValue - node.leftValue - 1) % 2 ==0){
                pnodes.push(node)           // 先保存父节点
            }else{
                throw new FlexTreeVerifyError(`${node.name}(${node.id}) rightValue - leftValue error `)        
            }
        }else{
            throw new FlexTreeVerifyError()
        }
    }
    if(pnodes.length>0) throw new FlexTreeVerifyError()
        return true
}