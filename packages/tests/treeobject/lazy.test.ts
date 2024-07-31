/**
 * 
 * 通过懒加载的方式访问树节点实例
 * 
 */
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { ReturnPromiseType } from './createTree'
import { createDemoTree, createFlexTree, dumpTree } from './createTree'

describe('懒加载访问树对象实例', () => {
    let tree: ReturnPromiseType<typeof createFlexTree>
    beforeEach(async () => {
        tree = await createFlexTree(undefined,{lazy:true})
        await createDemoTree(tree.manager)        
    })
    afterEach(async () => {
        //await dumpTree(tree.manager.adapter.db, 'lazy.db')
    })

    test('默认加载状态', async () => { 
        expect(tree.status).toBe('not-loaded')
        await tree.load()
        expect(tree.status).toBe('loaded')        
        const root = tree.root!
        expect(root.status).toBe('loaded')
        expect(root.children!.length).toBe(6)        
        for(const node of root.children!){
            //子节点A-F因为没有加载子节点，所以其状态为未加载
            expect(node.status).toBe('not-loaded')
            expect(node.children?.length).toBe(0)
        }
    })
    test('依次加载节点', async () => { 
        expect(tree.status).toBe('not-loaded')
        await tree.load()
        expect(tree.status).toBe('loaded')        
        const root = tree.root!
        expect(root.status).toBe('loaded')
        expect(root.children!.length).toBe(6)        

        for(const node of root.children!){
            expect(node.status).toBe('not-loaded')
            await node.load()
            expect(node.status).toBe('loaded')
            expect(node.children?.length).toBe(5)
            for(const cnode of node.children!){
                expect(cnode.status).toBe('not-loaded')
                await cnode.load()
                expect(cnode.status).toBe('loaded')
                expect(cnode.children?.length).toBe(5)
            }
        }
    })


})