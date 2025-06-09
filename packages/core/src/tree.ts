import type { RequiredDeep } from 'type-fest'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, FlexTreeExportJsonFormat, FlexTreeExportJsonOptions, FlexTreeExportListFormat, FlexTreeExportListOptions, IFlexTreeNodeFields, Expand, NonUndefined } from './types'
import { FlexTreeManager, type FlexTreeManagerOptions } from './manager'
import { FlexTreeNode, type FlexTreeNodeStatus } from './node'
import { FlexTreeNotFoundError } from './errors'

export type FlexTreeOptions<TreeIdType = number> = FlexTreeManagerOptions<TreeIdType> & {
    lazy?: boolean                      // 是否懒加载树
}
export type FlexTreeStatus = FlexTreeNodeStatus

export class FlexTree<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    NodeFields extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1]
> {
    private _options: RequiredDeep<FlexTreeOptions<KeyFields['treeId']>>
    private _treeId: TreeId
    private _manager: FlexTreeManager<Fields, KeyFields, NodeFields, NodeId, TreeId>
    private _root?: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>

    constructor(tableName: string, options?: FlexTreeOptions<KeyFields['treeId']>) {
        this._manager = new FlexTreeManager<Fields, KeyFields, NodeFields, NodeId, TreeId>(tableName, options)
        this._treeId = this._manager.treeId
        this._options = this._manager.options as RequiredDeep<FlexTreeOptions<KeyFields['treeId']>>
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
    get status() {
        if (!this._root) {
            return 'not-loaded'
        } else {
            return this._root.status
        }
    }
    /**
     * 加载树到内存中
     */
    async load() {
        this._root = new FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>(undefined, undefined, this)
        await this._root.load()
    }
    getByPath(path: string, options?: { byField?: string, delimiter?: string }): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
        return this.root?.getByPath(path, options)
    }
    async update(path: string, data: Partial<NodeFields>) {
        const node = this.getByPath(path)
        if (!node) {
            throw new FlexTreeNotFoundError(`Node ${path} not found`)
        }
        await node.update(data)
    }
    async sync() {
        if (this._root) {
            await this._root.sync(true)
        }
    }
    /**
     * 根据节点id获取节点实例
     */
    get(nodeId: NodeId): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    get(condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    get(): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
        const nodeId = arguments[0]
        if (nodeId === this._root?.id) {
            return this._root
        } else {
            return this._root?.get(nodeId)
        }
    }

    /**
     *
     * @param condition
     * @returns 返回满足条件的节点列表
     */
    find(condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
        return this._root!.find(condition)
    }
    findAll(condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>[] {
        return this._root!.findAll(condition)
    }
    forEach(callback: (
        node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>,
        parent: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    ) => void, options?: { includeSelf?: boolean, ignoreErrors?: boolean, mode?: 'dfs' | 'bfs' }) {
        return this._root!.forEach(callback, options)
    }
    toJson(options?: FlexTreeExportJsonOptions<Fields, KeyFields>): FlexTreeExportJsonFormat<Fields, KeyFields> {
        return this._root!.toJson(options)
    }

    toList(options?: FlexTreeExportListOptions<Fields, KeyFields>): FlexTreeExportListFormat<Fields, KeyFields> {
        return this._root!.toList(options)
    }
}
