import type { RequiredDeep } from 'type-fest'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, FlexTreeExportJsonFormat, FlexTreeExportJsonOptions, FlexTreeExportListFormat, FlexTreeExportListOptions, IFlexTreeNode, NonUndefined } from './types'
import { FlexTreeManager, type FlexTreeManagerOptions } from './manager'
import { FlexTreeNode } from './node'
import { FlexTreeInvalidError, FlexTreeNotFoundError } from './errors'

export type FlexTreeOptions<TreeIdType = number> = FlexTreeManagerOptions<TreeIdType>
export type FlexTreeStatus = 'initial' | 'loading' | 'loaded' | 'error'

export class FlexTree<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Fields, KeyFields> = IFlexTreeNode<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    private _options: RequiredDeep<FlexTreeOptions<KeyFields['treeId']>>
    private _treeId: TreeId
    private _status: FlexTreeStatus = 'initial'
    private _manager: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>
    private _root?: FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>

    constructor(tableName: string, options?: FlexTreeOptions<KeyFields['treeId']>) {
        this._manager = new FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>(tableName, options)
        this._treeId = this._manager.treeId
        this._options = this._manager.options as RequiredDeep<FlexTreeOptions<KeyFields['treeId']>>
        this._manager.on('afterWrite', this.onAfterWrite.bind(this))
    }

    get id() {
        return this._treeId
    }

    get options() {
        return this._options
    }

    get on() {
        return this._manager.on.bind(this)
    }

    get off() {
        return this._manager.off.bind(this)
    }

    get emit() {
        return this._manager.emit.bind(this)
    }

    get manager() {
        return this._manager!
    }

    get root() {
        return this._root
    }

    /**
     * 当节点后更新时调用
     */
    private onAfterWrite() {
        this.load()
    }

    /**
     * 加载树到内存中
     */
    async load() {
        if (this._status === 'loading') {
            return
        }
        this._status = 'loading'
        // 加载根节点
        try {
            const nodes = await this.manager.getNodes()
            if (!nodes || nodes.length === 0) {
                throw new FlexTreeNotFoundError()
            }
            this._root = new FlexTreeNode(nodes[0], undefined, this as any)
            const pnodes: FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>[] = [this._root]
            let preNode = this._root
            for (const node of nodes) {
                if (node.level === 0) {
                    continue
                }
                if (node.level === preNode.level) {
                    const parent = pnodes[pnodes.length - 1]
                    const nodeObj = new FlexTreeNode(node, parent, this as any)
                    parent.children!.push(nodeObj)
                    preNode = nodeObj
                } else if (node.level > preNode.level) {
                    if (node.level === preNode.level + 1) {
                        const nodeObj = new FlexTreeNode(node, preNode, this as any)
                        preNode.children!.push(nodeObj)
                        preNode = nodeObj
                        if (node.rightValue - node.leftValue > 1) {
						    pnodes.push(preNode)
                        }
                    } else {
                        throw new FlexTreeInvalidError(`Invalid tree structure`)
                    }
                } else if (node.level < preNode.level) {
                    while (true) {
                        const parent = pnodes[pnodes.length - 1]
                        if (parent && node.level === parent.level + 1) {
                            const nodeObj = new FlexTreeNode(node, parent, this as any)
                            parent.children!.push(nodeObj)
                            preNode = nodeObj
                            if (node.rightValue - node.leftValue > 1) {
							    pnodes.push(preNode)
                            }
                            break
                        } else if (pnodes.length === 0) {
                            break
                        } else {
                            pnodes.pop()
                        }
                    }
                }
            }
            this._status = 'loaded'
        } catch {
            this._status = 'error'
        }
    }

    getByPath(path: string, options?: { byField?: string, delimiter?: string }): FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId> | undefined {
        return this.root?.getByPath(path, options)
    }

    async update(path: string, data: Partial<TreeNode>) {
        const node = this.getByPath(path)
        if (!node) {
            throw new FlexTreeNotFoundError(`Node ${path} not found`)
        }
        await node.update(data)
    }

    /**
     * 删除指定的节点
     */
    async delete(nodeId: NodeId | ((node: FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>) => boolean)) {
        if (typeof nodeId == 'function') {
            const nodes = this.find(node => (nodeId as any)(node)).map(node => node.id)
            await this.manager.write(async () => {
                for (const id of nodes) {
                    await this.manager.deleteNode(id)
                }
            })
        } else {
            await this.manager.deleteNode(nodeId)
        }
    }

    /**
     * 根据节点id获取节点实例
     */
    get(nodeId: NodeId) {
        if (nodeId === this._root?.id) {
            return this._root
        } else {
            return this._root?.get(nodeId, true)
        }
    }

    /**
     *
     * @param condition
     * @returns 返回满足条件的节点列表
     */
    find(condition: (node: FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>) => boolean): FlexTreeNode<Fields, KeyFields, TreeNode, NodeId, TreeId>[] {
        return this._root!.find(condition, true)
    }

    toJson(options?: FlexTreeExportJsonOptions<Fields, KeyFields>): FlexTreeExportJsonFormat<Fields, KeyFields> {
        return this._root!.toJson(options)
    }

    toList(options?: FlexTreeExportListOptions<Fields, KeyFields>): FlexTreeExportListFormat<Fields, KeyFields> {
        return this._root!.toList(options)
    }
}
