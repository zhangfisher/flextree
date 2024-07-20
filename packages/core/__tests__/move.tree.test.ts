/**
 * 更新树
 */
import { test,describe,beforeEach, expect, beforeAll, afterEach } from "vitest" 
import { FlexNodeRelPosition, FlexTreeManager, FlexTreeNodeError, IFlexTreeNode, NextSibling, PreviousSibling } from "../src/index"; 
import { createDemoTree, createTreeManager, dumpTree, verifyTree } from "./common";
 


describe("移动树节点", () => {
    let tree:FlexTreeManager 
    let nodes :IFlexTreeNode[]
    let root: IFlexTreeNode
    let a:IFlexTreeNode,a1:IFlexTreeNode,a2:IFlexTreeNode,a3:IFlexTreeNode,a11:IFlexTreeNode,a12:IFlexTreeNode,a13:IFlexTreeNode
    let b:IFlexTreeNode,b1:IFlexTreeNode,b2:IFlexTreeNode,b3:IFlexTreeNode,b11:IFlexTreeNode,b12:IFlexTreeNode,b13:IFlexTreeNode
    let c:IFlexTreeNode,c1:IFlexTreeNode,c2:IFlexTreeNode,c3:IFlexTreeNode,c11:IFlexTreeNode,c12:IFlexTreeNode,c13:IFlexTreeNode
    beforeEach(async () => {
        tree = await createTreeManager()      
        await createDemoTree(tree)
        nodes = await tree.getNodes()
        root = nodes.find(n=>n.name=="root")!
        a = nodes.find(n=>n.name=="A")!
            a1 = nodes.find(n=>n.name=="A_1")!            
                a11 = nodes.find(n=>n.name=="A_1_1")!
                a12 = nodes.find(n=>n.name=="A_1_2")!
                a13 = nodes.find(n=>n.name=="A_1_3")!
            a2 = nodes.find(n=>n.name=="A_2")!
            a3 = nodes.find(n=>n.name=="A_3")!
        
        b = nodes.find(n=>n.name=="B")!
            b1 = nodes.find(n=>n.name=="B_1")!
                b11 = nodes.find(n=>n.name=="B_1_1")!
                b12 = nodes.find(n=>n.name=="B_1_2")!
                b13 = nodes.find(n=>n.name=="B_1_3")!
            b2 = nodes.find(n=>n.name=="B_2")!
            b3 = nodes.find(n=>n.name=="B_3")!

        c = nodes.find(n=>n.name=="C")!
            c1 = nodes.find(n=>n.name=="C_1")!
                c11 = nodes.find(n=>n.name=="C_1_1")!
                c12 = nodes.find(n=>n.name=="C_1_2")!
                c13 = nodes.find(n=>n.name=="C_1_3")!
        c2 = nodes.find(n=>n.name=="C_2")!
        c3 = nodes.find(n=>n.name=="C_3")!
        
    })    
    afterEach(async ()=>{ 
        await dumpTree(tree.driver.db,"move.db")
    })

    describe("判断是否允许移动节点到指定位置", () => {

        test("判定节点不允许移动到自身的任意位置", async () => {
            for(let pos of [FlexNodeRelPosition.FirstChild,FlexNodeRelPosition.LastChild, FlexNodeRelPosition.NextSibling,FlexNodeRelPosition.PreviousSibling]){        
                expect(await tree.canMoveTo(root, root,pos)).toBe(false) 
                expect(await tree.canMoveTo(a, a,pos)).toBe(false) 
                expect(await tree.canMoveTo(b, b,pos)).toBe(false) 
                expect(await tree.canMoveTo(c, c,pos)).toBe(false) 
            }
        })

        test("判定节点不允许移动其后代节点的任意位置", async () => {            
            // 不允许移动其后代的前后: 即兄弟节点
            for(let pos of [FlexNodeRelPosition.NextSibling,FlexNodeRelPosition.PreviousSibling]){        
                expect(await tree.canMoveTo(root, a,pos)).toBe(false) 
                    expect(await tree.canMoveTo(root, a1,pos)).toBe(false) 
                        expect(await tree.canMoveTo(root, a11,pos)).toBe(false) 
                        expect(await tree.canMoveTo(root, a12,pos)).toBe(false) 
                        expect(await tree.canMoveTo(root, a13,pos)).toBe(false) 
                    expect(await tree.canMoveTo(root, a2,pos)).toBe(false)                 
                    expect(await tree.canMoveTo(root, a3,pos)).toBe(false)

                expect(await tree.canMoveTo(root, b,pos)).toBe(false) 
                    expect(await tree.canMoveTo(root, b1,pos)).toBe(false) 
                        expect(await tree.canMoveTo(root, b11,pos)).toBe(false) 
                        expect(await tree.canMoveTo(root, b12,pos)).toBe(false) 
                        expect(await tree.canMoveTo(root, b13,pos)).toBe(false) 
                    expect(await tree.canMoveTo(root, b2,pos)).toBe(false)
                    expect(await tree.canMoveTo(root, b3,pos)).toBe(false)
                
                expect(await tree.canMoveTo(root, c,pos)).toBe(false)         
                    expect(await tree.canMoveTo(root, c1,pos)).toBe(false) 
                        expect(await tree.canMoveTo(root, c11,pos)).toBe(false)
                        expect(await tree.canMoveTo(root, c12,pos)).toBe(false)
                        expect(await tree.canMoveTo(root, c13,pos)).toBe(false)
                    expect(await tree.canMoveTo(root, c2,pos)).toBe(false)
                    expect(await tree.canMoveTo(root, c3,pos)).toBe(false)
            }
            // A
            for(let pos of [FlexNodeRelPosition.NextSibling,FlexNodeRelPosition.PreviousSibling]){        
                    expect(await tree.canMoveTo(a, a1,pos)).toBe(false) 
                        expect(await tree.canMoveTo(a, a11,pos)).toBe(false) 
                        expect(await tree.canMoveTo(a, a12,pos)).toBe(false) 
                        expect(await tree.canMoveTo(a, a13,pos)).toBe(false) 
                    expect(await tree.canMoveTo(a, a2,pos)).toBe(false)                 
                    expect(await tree.canMoveTo(a, a3,pos)).toBe(false) 
            } 
        })
        test("判定节点允许移动指定节点的前后", async () => {
            for(let pos of [FlexNodeRelPosition.NextSibling,FlexNodeRelPosition.PreviousSibling]){        
                expect(await tree.canMoveTo(a, b,pos)).toBe(true) 
                    expect(await tree.canMoveTo(a1, a2,pos)).toBe(true) 
                    expect(await tree.canMoveTo(a2, a3,pos)).toBe(true) 
                    expect(await tree.canMoveTo(a3, a1,pos)).toBe(true)  

                expect(await tree.canMoveTo(b, c,pos)).toBe(true) 
                    expect(await tree.canMoveTo(b1, b2,pos)).toBe(true) 
                    expect(await tree.canMoveTo(b2, b3,pos)).toBe(true) 
                    expect(await tree.canMoveTo(b3, b1,pos)).toBe(true)                  
                        expect(await tree.canMoveTo(b11,b12,pos)).toBe(true) 
                        expect(await tree.canMoveTo(b12,b13,pos)).toBe(true)
                        expect(await tree.canMoveTo(b13,b11,pos)).toBe(true)
                expect(await tree.canMoveTo(c, a,pos)).toBe(true) 
                    expect(await tree.canMoveTo(c1, c2,pos)).toBe(true) 
                    expect(await tree.canMoveTo(c2, c3,pos)).toBe(true) 
                    expect(await tree.canMoveTo(c3, c1,pos)).toBe(true)
                        expect(await tree.canMoveTo(c11,c12,pos)).toBe(true) 
                        expect(await tree.canMoveTo(c12,c13,pos)).toBe(true)
                        expect(await tree.canMoveTo(c13,c11,pos)).toBe(true)
            }
        })
        test("判定节点允许移动指定节点的子节点", async () => {
            for(let pos of [FlexNodeRelPosition.FirstChild,FlexNodeRelPosition.LastChild]){        
                expect(await tree.canMoveTo(a, b,pos)).toBe(true) 
                    expect(await tree.canMoveTo(a1, a2,pos)).toBe(true) 
                    expect(await tree.canMoveTo(a2, a3,pos)).toBe(true) 
                    expect(await tree.canMoveTo(a3, a1,pos)).toBe(true)                                      
                        expect(await tree.canMoveTo(a11,a12,pos)).toBe(true) 
                        expect(await tree.canMoveTo(a12,a13,pos)).toBe(true)
                        expect(await tree.canMoveTo(a13,a11,pos)).toBe(true)

                expect(await tree.canMoveTo(b, c,pos)).toBe(true) 
                    expect(await tree.canMoveTo(b1, b2,pos)).toBe(true) 
                    expect(await tree.canMoveTo(b2, b3,pos)).toBe(true) 
                    expect(await tree.canMoveTo(b3, b1,pos)).toBe(true)                  
                        expect(await tree.canMoveTo(b11,b12,pos)).toBe(true) 
                        expect(await tree.canMoveTo(b12,b13,pos)).toBe(true)
                        expect(await tree.canMoveTo(b13,b11,pos)).toBe(true)
                expect(await tree.canMoveTo(c, a,pos)).toBe(true) 
                    expect(await tree.canMoveTo(c1, c2,pos)).toBe(true) 
                    expect(await tree.canMoveTo(c2, c3,pos)).toBe(true) 
                    expect(await tree.canMoveTo(c3, c1,pos)).toBe(true)
                        expect(await tree.canMoveTo(c11,c12,pos)).toBe(true) 
                        expect(await tree.canMoveTo(c12,c13,pos)).toBe(true)
                        expect(await tree.canMoveTo(c13,c11,pos)).toBe(true)
            }
            expect(await verifyTree(tree)).toBe(true)

        })


    })

    describe("移动节点到目标节点的后面成为其下一个兄弟节点",async ()=>{
        // 向下移动

        test("同级内移动到下一个兄弟节点",async ()=>{
            
            let a1 =await tree.findNode({name:"A_1_1"})!
            let a2 = await tree.findNode({name:"A_1_2"})!
            await tree.update(async ()=>{
                await tree.moveNode(a1.id,a2.id,NextSibling)
            })
            let a = await tree.findNode({name:"A_1"})!
            a1 = await tree.findNode({name:"A_1_1"})!
            a2 = await tree.findNode({name:"A_1_2"})!
            a3 = await tree.findNode({name:"A_1_3"})!
            let a4 = await tree.findNode({name:"A_1_4"})!
            let a5 = await tree.findNode({name:"A_1_5"})!
            const nodes = await tree.getNodes()

            expect(a2.leftValue).toBe(a.leftValue+1)
            expect(a2.rightValue).toBe(a.leftValue+2)
            expect(a1.leftValue).toBe(a.leftValue+3)
            expect(a1.rightValue).toBe(a.leftValue+4)
            expect(a3.leftValue).toBe(a.leftValue+5)
            expect(a3.rightValue).toBe(a.leftValue+6)
            expect(a4.leftValue).toBe(a.leftValue+7)
            expect(a4.rightValue).toBe(a.leftValue+8)
            expect(a5.leftValue).toBe(a.leftValue+9)
            expect(a5.rightValue).toBe(a.leftValue+10)
            expect(a.rightValue).toBe(a.leftValue+11)


            expect(await verifyTree(tree)).toBe(true)


        })
        test("同级内连续多下移动到同级内的下一个兄弟节点",async ()=>{
            let a1 =await tree.findNode({name:"A_1_1"})!
            let a2 = await tree.findNode({name:"A_1_2"})!
            let a3 = await tree.findNode({name:"A_1_3"})!
            let a4 = await tree.findNode({name:"A_1_4"})!
            let a5 = await tree.findNode({name:"A_1_5"})!

            await tree.update(async ()=>{
                await tree.moveNode(a1.id,a2.id,NextSibling)
                await tree.moveNode(a1.id,a3.id,NextSibling)
                await tree.moveNode(a1.id,a4.id,NextSibling)
                await tree.moveNode(a1.id,a5.id,NextSibling)
            })
            let a = await tree.findNode({name:"A_1"})!
            a1 = await tree.findNode({name:"A_1_1"})!
            a2 = await tree.findNode({name:"A_1_2"})!
            a3 = await tree.findNode({name:"A_1_3"})! 
            a4 = await tree.findNode({name:"A_1_4"})!
            a5 = await tree.findNode({name:"A_1_5"})!

            expect(a2.leftValue).toBe(a.leftValue+1)
            expect(a2.rightValue).toBe(a.leftValue+2)            
            expect(a3.leftValue).toBe(a.leftValue+3)
            expect(a3.rightValue).toBe(a.leftValue+4)
            expect(a4.leftValue).toBe(a.leftValue+5)
            expect(a4.rightValue).toBe(a.leftValue+6)
            expect(a5.leftValue).toBe(a.leftValue+7)
            expect(a5.rightValue).toBe(a.leftValue+8)
            expect(a1.leftValue).toBe(a.leftValue+9)
            expect(a1.rightValue).toBe(a.leftValue+10)

            expect(await verifyTree(tree)).toBe(true)
        })  
        test("移动子树到同级内的目标节点的下一个兄弟节点",async ()=>{
            let a =await tree.findNode({name:"A"})!
            let b = await tree.findNode({name:"B"})!
            let c = await tree.findNode({name:"C"})!
            let d = await tree.findNode({name:"D"})!
            let e = await tree.findNode({name:"E"})!
            let f = await tree.findNode({name:"F"})!
            await tree.update(async ()=>{
                await tree.moveNode(a.id,b.id,NextSibling)
                await tree.moveNode(a.id,c.id,NextSibling)
                await tree.moveNode(a.id,d.id,NextSibling)
                await tree.moveNode(a.id,e.id,NextSibling)
                await tree.moveNode(a.id,f.id,NextSibling)
            })

            expect(await verifyTree(tree)).toBe(true)

        })      

        // 向上移动：　以下是移动到前面的目标节点的下一个兄弟节点
        test("向上同级内移动到前面的目标下一个兄弟节点",async ()=>{
            
            let a2 =await tree.findNode({name:"A_1_2"})!
            let a5 = await tree.findNode({name:"A_1_5"})!
            await tree.update(async ()=>{
                await tree.moveNode(a5.id,a2.id,NextSibling)
            })
            a2 = await tree.findNode({name:"A_1_2"})!
            a5 = await tree.findNode({name:"A_1_5"})!

            expect(a5.leftValue).toBe(a2.rightValue+1)

            expect(await verifyTree(tree)).toBe(true)
        })
        test("向上同级内连续多下移动到前面的目标同级内的下一个兄弟节点",async ()=>{
            let a1 =await tree.findNode({name:"A_1_1"})!
            let a2 = await tree.findNode({name:"A_1_2"})!
            let a3 = await tree.findNode({name:"A_1_3"})!
            let a4 = await tree.findNode({name:"A_1_4"})!
            let a5 = await tree.findNode({name:"A_1_5"})!

            await tree.update(async ()=>{
                await tree.moveNode(a5.id,a3.id,NextSibling)
                await tree.moveNode(a5.id,a2.id,NextSibling)
                await tree.moveNode(a5.id,a1.id,NextSibling)
            })
            let a = await tree.findNode({name:"A_1"})!
            a1 = await tree.findNode({name:"A_1_1"})!
            a2 = await tree.findNode({name:"A_1_2"})!
            a3 = await tree.findNode({name:"A_1_3"})! 
            a4 = await tree.findNode({name:"A_1_4"})!
            a5 = await tree.findNode({name:"A_1_5"})! 

            expect(await verifyTree(tree)).toBe(true)
        })  
        test("向上移动子树到同级内的前面的目标节点的下一个兄弟节点",async ()=>{
            let a =await tree.findNode({name:"A"})!
            let b = await tree.findNode({name:"B"})!
            let c = await tree.findNode({name:"C"})!
            let d = await tree.findNode({name:"D"})!
            let e = await tree.findNode({name:"E"})!
            let f = await tree.findNode({name:"F"})!
            await tree.update(async ()=>{
                await tree.moveNode(f.id,d.id,NextSibling)
                await tree.moveNode(f.id,c.id,NextSibling)
                await tree.moveNode(f.id,b.id,NextSibling)
                await tree.moveNode(f.id,a.id,NextSibling)
            })

            expect(await verifyTree(tree)).toBe(true)

        })      
        test("A_1_2移动为B_2_3的下一个兄弟节点",async ()=>{
            let a12 =await tree.findNode({name:"A_1_2"})!
            let b23 = await tree.findNode({name:"B_2_3"})!

            await tree.update(async ()=>{
                await tree.moveNode(a12.id,b23.id,NextSibling)
            })
            a12 =await tree.findNode({name:"A_1_2"})!
            b23 = await tree.findNode({name:"B_2_3"})!
            expect(a12.leftValue).toBe(b23.rightValue+1)


            expect(await verifyTree(tree)).toBe(true)
        })  
        test("B_2_3移动为A_1_2的下一个兄弟节点",async ()=>{
            let a12 =await tree.findNode({name:"A_1_2"})!
            let b23 = await tree.findNode({name:"B_2_3"})!

            await tree.update(async ()=>{
                await tree.moveNode(b23.id,a12.id,NextSibling)
            })
            a12 =await tree.findNode({name:"A_1_2"})!
            b23 = await tree.findNode({name:"B_2_3"})! 

            expect(b23.leftValue).toBe(a12.rightValue+1)
            

            expect(await verifyTree(tree)).toBe(true)
        })  
    })
    describe("移动节点到目标节点的前面成为其上一个兄弟节点",async ()=>{

        // 向下移动
        test("同级内移动到上一个兄弟节点",async ()=>{
            let a1 =await tree.findNode({name:"A_1_1"})!
            let a2 = await tree.findNode({name:"A_1_2"})!
            await tree.update(async ()=>{
                await tree.moveNode(a2.id,a1.id,PreviousSibling)
            })
            let a = await tree.findNode({name:"A_1"})!
            a1 = await tree.findNode({name:"A_1_1"})!
            a2 = await tree.findNode({name:"A_1_2"})!
            a3 = await tree.findNode({name:"A_1_3"})!
            let a4 = await tree.findNode({name:"A_1_4"})!
            let a5 = await tree.findNode({name:"A_1_5"})!
            

            expect(a2.leftValue).toBe(a.leftValue+1)
            expect(a2.rightValue).toBe(a.leftValue+2)
            expect(a1.leftValue).toBe(a.leftValue+3)
            expect(a1.rightValue).toBe(a.leftValue+4)
            expect(a3.leftValue).toBe(a.leftValue+5)
            expect(a3.rightValue).toBe(a.leftValue+6)
            expect(a4.leftValue).toBe(a.leftValue+7)
            expect(a4.rightValue).toBe(a.leftValue+8)
            expect(a5.leftValue).toBe(a.leftValue+9)
            expect(a5.rightValue).toBe(a.leftValue+10)
            expect(a.rightValue).toBe(a.leftValue+11)
            expect(await verifyTree(tree)).toBe(true)
        })
        test("向上同级内连续移动到上一个兄弟节点",async ()=>{
            let a1 =await tree.findNode({name:"A_1_1"})!
            let a2 = await tree.findNode({name:"A_1_2"})!
            let a3 = await tree.findNode({name:"A_1_3"})!
            let a4 = await tree.findNode({name:"A_1_4"})!
            let a5 = await tree.findNode({name:"A_1_5"})!

            await tree.update(async ()=>{
                await tree.moveNode(a5.id,a4.id,PreviousSibling)
                await tree.moveNode(a5.id,a3.id,PreviousSibling)
                await tree.moveNode(a5.id,a2.id,PreviousSibling)
                await tree.moveNode(a5.id,a1.id,PreviousSibling)
            })
            let a = await tree.findNode({name:"A_1"})!
            a1 = await tree.findNode({name:"A_1_1"})!
            a2 = await tree.findNode({name:"A_1_2"})!
            a3 = await tree.findNode({name:"A_1_3"})! 
            a4 = await tree.findNode({name:"A_1_4"})!
            a5 = await tree.findNode({name:"A_1_5"})!

            expect(a5.leftValue).toBe(a.leftValue+1)
            expect(a5.rightValue).toBe(a.leftValue+2)            
            expect(a1.leftValue).toBe(a.leftValue+3)
            expect(a1.rightValue).toBe(a.leftValue+4)
            expect(a2.leftValue).toBe(a.leftValue+5)
            expect(a2.rightValue).toBe(a.leftValue+6)
            expect(a3.leftValue).toBe(a.leftValue+7)
            expect(a3.rightValue).toBe(a.leftValue+8)
            expect(a4.leftValue).toBe(a.leftValue+9)
            expect(a4.rightValue).toBe(a.leftValue+10)

            expect(await verifyTree(tree)).toBe(true)
        }) 
        test("向上移动子树到同级内的目标节点的上一个兄弟节点",async ()=>{
            let a =await tree.findNode({name:"A"})!
            let b = await tree.findNode({name:"B"})!
            let c = await tree.findNode({name:"C"})!
            let d = await tree.findNode({name:"D"})!
            let e = await tree.findNode({name:"E"})!
            let f = await tree.findNode({name:"F"})!
            await tree.update(async ()=>{
                await tree.moveNode(f.id,e.id,PreviousSibling)
                // await tree.moveNode(f.id,d.id,PreviousSibling)
                // await tree.moveNode(f.id,c.id,PreviousSibling)
                // await tree.moveNode(f.id,b.id,PreviousSibling)
                // await tree.moveNode(f.id,a.id,PreviousSibling)
            })
            a =await tree.findNode({name:"A"})!
            b = await tree.findNode({name:"B"})!
            c = await tree.findNode({name:"C"})!
            d = await tree.findNode({name:"D"})!
            e = await tree.findNode({name:"E"})!
            f = await tree.findNode({name:"F"})!

            // expect(f.leftValue).toBe(a.leftValue+1)

            // expect(await verifyTree(tree)).toBe(true)

        })       
    })
})