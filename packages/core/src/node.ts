import { pick } from 'flex-tools/object/pick'
import { omit } from 'flex-tools/object/omit'
import type {
    CustomTreeKeyFields, DefaultTreeKeyFields, FlexTreeExportJsonFormat, FlexTreeExportJsonOptions,
    FlexTreeExportListFormat, FlexTreeExportListOptions, IFlexTreeNodeFields, NonUndefined, Expand
} from './types'
import type { FlexTree } from './tree'
import { FlexTreeAbortError, FlexTreeInvalidError, FlexTreeNodeNotFoundError, FlexTreeNotFoundError } from './errors'
import { filterObject } from './utils/filterObject'
import { getRelNodePath } from './utils/getRelNodePath'
import { isNull } from './utils/isNull'

/**
 * 节点状态
 * 
 * 
 * - not-loaded: 未加载,如果实例化时未加载节点数据，则状态为not-loaded
 * - loaded:  已加载
 *     当节点存在子节点时，必须是所有子节点均已加载才表示loaded
 * 
 * 
 * 
 */
export type FlexTreeNodeStatus = 'not-loaded' | 'loading' | 'loaded' | 'error'

export type TypedNode<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    NodeFields extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>
> = FlexTreeNode<
    Fields,
    KeyFields,
    IFlexTreeNodeFields<Fields, KeyFields>,
    NonUndefined<NodeFields['id']>,
    NonUndefined<NodeFields['treeId']>
>


export class FlexTreeNode<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    // 以下是快捷方式，不要重载覆盖
    NodeFields extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<NodeFields['id']>,
    TreeId = NonUndefined<NodeFields['treeId']>
> {
    private _tree: FlexTree<Fields, KeyFields, NodeFields, NodeId, TreeId>
    private _node: Expand<NodeFields> | undefined
    private _children?: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>[]
    private _parent: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    private _keyFields
    private _status: FlexTreeNodeStatus = 'not-loaded'

    constructor(node: NodeFields | undefined, parent: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined, tree: FlexTree<Fields, KeyFields, NodeFields, NodeId, TreeId>) {
        this._tree = tree
        this._parent = parent
        this._keyFields = tree.manager.keyFields
        this.updateSelf(node)
    }

    get status() {
        return this._status
    }
    get id(): NodeId {
        return (this._node as any)?.[this._keyFields.id] as NodeId
    }
    get name() {
        return (this._node as any)?.[this._keyFields.name] as string
    }
    get level() {
        return (this._node as any)?.[this._keyFields.level] as number
    }
    get leftValue() {
        return (this._node as any)?.[this._keyFields.leftValue] as number
    }
    get rightValue() {
        return (this._node as any)?.[this._keyFields.rightValue] as number
    }
    get treeId() {
        return (this._node as any)?.[this._keyFields.treeId] as TreeId
    }
    get tree() {
        return this._tree
    }
    get fields() {
        return this._node!
    }

    get root() {
        return this._tree.root
    }
    get parent() {
        return this._parent
    }

    get children() {
        return this._children
    }

    get siblings() {
        if (this._parent) {
            return this._parent.children?.filter(n => n.id !== this.id)
        }
    }

    get descendants() {
        const descendants: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>[] = []
        if (this._children) {
            for (const node of this._children) {
                descendants.push(node)
                descendants.push(...node.descendants)
            }
        }
        return descendants
    }

    get ancestors() {
        const ancestors: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>[] = []
        let parent = this._parent
        while (parent) {
            ancestors.splice(0, 0, parent)
            parent = parent.parent
        }
        return ancestors
    }

    /**
     * 从数据库中同步节点数据
     * 
     */
    async sync(includeDescendants: boolean = false) {
        const node = await this._tree.manager.getNode(this.id)
        if (!node) {
            throw new FlexTreeNodeNotFoundError(`Node ${this.id} not found`)
        }
        this._node = node as Expand<NodeFields>
        if (this._children && includeDescendants) {
            Promise.all(this._children.map(n => n.sync(includeDescendants)))
        }
    }

    /**
     *
     * 更新节点数据
     * 不包括关键字段
     *
     */
    async update(data: Partial<NodeFields>) {
        const nodeData = filterObject(data, (k) => {
            return !(k in this._keyFields)
                || k === this._keyFields.name
        })
        nodeData[this._keyFields.id] = this.id
        await this._tree.manager.write(async () => {
            await this._tree.manager.update(nodeData)
        })
        if (this._node) Object.assign(this._node, nodeData)
    }

    /**
     *
     * 根据输入的路径获取节点
     *
     * 1. 以当前节点开始
     *    getByPath("A-1/A-1-1")
     *    getByPath("A-1/A-1-1")
     * 2. ./代表当前节点
     *    getByPath("./A-1/A-1-1")
     * 3. ../代表父节点
     *    getByPath("../A-1-1")
     *    getByPath("../../A-1-1")
     * 4. /代表根节点
     *    getByPath("/A-1-1")
     *
     *
     *
     *
     * @param path
     * @param {object} options
     * @param {string} [options.byField]  指定路径字段，默认为id
     * @param {string} [options.delimiter]  路径分隔符，默认为'/'
     */
    getByPath(path: string, options?: { byField?: string, delimiter?: string }): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
        const { byField, delimiter } = Object.assign({ byField: this._tree.manager.keyFields.name, delimiter: '/' }, options)
        let [entryNode, entryPath] = getRelNodePath(this as any, path, delimiter) as [FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>, string]
        for (const subpath of entryPath.split(delimiter)) {
            if (subpath === '') {
                continue
            }
            if (entryNode.children) {
                const index = entryNode.children.findIndex((n: any) => n.fields[byField] === subpath)
                if (index >= 0) {
                    entryNode = entryNode.children[index]
                } else {
                    return undefined
                }
            } else {
                return undefined
            }
        }
        return entryNode as FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>
    }

    /**
     * 获取该节点下id=nodeId的节点实例
     */
    get(nodeId: NodeId): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    get(condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    get(): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
        const nodeId = typeof (arguments[0]) !== 'function' ? arguments[0] : undefined
        const condition = typeof (arguments[0]) == 'function' ? arguments[0] : undefined
        if (nodeId) {
            if (this.id === nodeId) {
                return this
            }
            if (this._children) {
                for (const node of this._children) {
                    if (node.id === nodeId) {
                        return node
                    } else {
                        const n = node.get(nodeId)
                        if (n) {
                            return n
                        }
                    }
                }
            }
        } else {
            if (condition(this)) return this
            this.forEach((node) => {
                if (condition(node)) {
                    return node
                }
            })
        }
    }
    _getNode() {
        return this._node as Expand<NodeFields>
    }
    /**
     * 返回符合条件的第一个节点
     * 不包括自身
     * @param condition  条件函数
     * @returns  返回符合条件的节点集合
     */
    find(condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined {
        let matchednNode: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
        this.forEach((node => {
            if (condition(node)) {
                matchednNode = node
                throw new FlexTreeAbortError()
            }
        }))
        return matchednNode
    }
    /**
     * 返回符合条件的子节点和后代节点集合
     * 不包括自身节点
     * @param condition  条件函数     
     * @returns  返回符合条件的节点集合
     */
    findAll(condition: (node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>) => boolean): FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>[] {
        const nodes: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>[] = []
        this.forEach((node => {
            if (condition(node)) {
                nodes.push(node)
            }
        }))
        return nodes
    }
    private updateSelf(node: NodeFields | undefined) {
        if (!isNull(node)) {
            this._node = Object.assign({}, this._node!, node) // 更新节点数据
            const leftValue = (this._node as any)[this._keyFields.leftValue]
            const rightValue = (this._node as any)[this._keyFields.rightValue]
            if (rightValue - leftValue > 1) { // 有子节点
                this._children = []
            } else if (rightValue - leftValue === 1) {
                this._status = 'loaded'
            }
        }
    }

    /**
     *  加载节点及子节点并创建节点实例
     */
    async load() {
        if (this._status === 'loading') {
            throw new FlexTreeInvalidError(`Node ${this.id} is loading`)
        }
        try {
            const maxLevel = this._tree.options.lazy ? 1 : 0    // 当懒加载时，只加载一级节点
            // 1. 加载所有后代节点
            const nodes = (await this.tree.manager.getDescendants(this.id, {
                includeSelf: true,
                level: maxLevel,   // 当懒加载时，只加载一级节点
            })) as unknown as NodeFields[]
            if (!nodes || nodes.length === 0) {
                throw new FlexTreeNotFoundError()
            }
            // 2. 加载自身节点数据
            this.updateSelf(nodes[0])

            const pnodes: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>[] = [this]
            let preNode: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> = this as any
            // 3. 加载所有后代节点 ，懒加载时只会加载子节点
            for (const node of nodes) {
                if (node[this._keyFields.id] === this.id) {
                    continue
                }
                const nodeLevel = node[this._keyFields.level]
                const nodeLeftValue = node[this._keyFields.leftValue]
                const nodeRightValue = node[this._keyFields.rightValue]

                if (nodeLevel === preNode.level) {
                    const parent = pnodes[pnodes.length - 1]
                    const nodeObj = new FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>(node, parent, this._tree)
                    parent.children!.push(nodeObj)
                    preNode = nodeObj
                } else if (nodeLevel > preNode.level) {
                    if (nodeLevel === preNode.level + 1) {
                        const nodeObj = new FlexTreeNode(node, preNode, this._tree)
                        preNode.children!.push(nodeObj)
                        preNode = nodeObj
                        if (nodeRightValue - nodeLeftValue > 1 && (maxLevel === 0 || (maxLevel > 0 && nodeLevel < maxLevel))) {
                            pnodes.push(preNode)
                        }
                    } else {
                        throw new FlexTreeInvalidError(`Invalid tree structure`)
                    }
                } else if (nodeLevel < preNode.level) {
                    while (true) {
                        const parent = pnodes[pnodes.length - 1]
                        if (parent && nodeLevel === parent.level + 1) {
                            const nodeObj = new FlexTreeNode(node, parent, this._tree)
                            parent.children!.push(nodeObj)
                            preNode = nodeObj
                            if (nodeRightValue - nodeLeftValue > 1 && (maxLevel === 0 || (maxLevel > 0 && nodeLevel < maxLevel))) {
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
        } catch (e: any) {
            this._status = 'error'
            throw e
        }

    }

    private toNodeData(data: any, fields: string[], includeKeyFields: boolean = false) {
        let result: Record<string, any> = {}
        if (fields.length > 0) {
            result = pick(data, fields as string[]) as any
        } else {
            if (includeKeyFields) {
                result = Object.assign({}, data)
            } else {
                result = Object.assign({}, omit(data, [
                    this._keyFields.leftValue,
                    this._keyFields.rightValue,
                    this._keyFields.level,
                    this._keyFields.treeId,
                ], true))
            }
        }
        // @ts-ignore
        result[this._tree.manager.keyFields.id] = data[this._tree.manager.keyFields.id]
        return result
    }

    /**
     * 导出当前节点及其后代节点
     */
    toJson(options?: FlexTreeExportJsonOptions<Fields, KeyFields>): FlexTreeExportJsonFormat<Fields, KeyFields> {
        const opts = Object.assign({
            childrenField: 'children',
            fields: [],
            level: 0, // 限定节点的级别,level=0表示不限定,level=1表示只导出当前节点
            includeKeyFields: false,
        }, options) as Required<FlexTreeExportJsonOptions<Fields, KeyFields>>
        const { childrenField, includeKeyFields, level, fields } = opts
        // 当指字了fields时,确保包含id字段,不包括treeId字段
        if (fields.length > 0) {
            const index = fields.findIndex(name => name === this._tree.manager.keyFields.treeId)// 移除treeId字段
            if (index >= 0) {
                fields.splice(index, 1)
            }
        }

        const results = this.toNodeData(this._node, fields as string[], includeKeyFields) as any
        if (this._children && (level === 0 || (level > 1))) {
            if (level > 1) {
                opts.level = opts.level - 1
            }
            // @ts-ignore
            results[childrenField] = this._children.map(n => n.toJson(opts))
        }
        return results as FlexTreeExportJsonFormat<Fields, KeyFields>
    }

    /**
     *
     * 按照树的顺序返回节点列表
     * 通过pid字段关联父节点，通过order字段排序
     *
     */
    toList(options?: FlexTreeExportListOptions<Fields, KeyFields>): FlexTreeExportListFormat<Fields, KeyFields> {
        const opts = Object.assign({
            pidField: 'pid',
            fields: [],
            level: 0, // 限定节点的级别,level=0表示不限定,level=1表示只导出当前节点
            includeKeyFields: false,
        }, options) as Required<FlexTreeExportListOptions<Fields, KeyFields>>
        const { includeKeyFields, pidField, level, fields } = opts
        // @ts-ignore
        const results: FlexTreeExportListFormat<Fields, KeyFields> = []
        const curNodedata = this.toNodeData(this._node, fields as string[], includeKeyFields)
        // @ts-ignore
        curNodedata[pidField] = this.parent ? this.parent.id : 0
        // @ts-ignore
        results.push(curNodedata)
        if (this._children && (level === 0 || (level > 1))) {
            const curLevel = opts.level
            if (curLevel > 1) {
                opts.level = curLevel - 1
            }
            for (const node of this._children) {
                const children = node.toList(opts) as any[]
                // @ts-ignore
                results.push(...children)
            }
        }
        return results
    }

    toString() {
        return `${this.name}<${this.id}>`
    }
    forEach(callback: (
        node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>,
        parent: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    ) => void, options?: { includeSelf?: boolean, ignoreErrors?: boolean, mode?: 'dfs' | 'bfs' }) {
        const { includeSelf = false, ignoreErrors = true, mode = 'dfs' } = options || {}
        if (mode === 'dfs') {
            this._forEachDFS(callback, { includeSelf, ignoreErrors })
        } else {
            this._forEachBFS(callback, { includeSelf, ignoreErrors })
        }
    }
    _executeForEachCallback(callback: any, node: any, parent: any, ignoreErrors: boolean): boolean {
        try {
            callback(node, parent)
        } catch (e: any) {
            if (e instanceof FlexTreeAbortError) {
                return true
            } else if (!ignoreErrors) {
                return true
            }
        }
        return false
    }
    /**
     * 
     * 遍历树节点
     * 
     * 采用深度优先遍历树节点
     * 
     * 通过触发FlexTreeAbortError中断遍历
     * 
     * @param callback 遍历节点
     * @param options 
     * @param options.includeSelf 是否包含自身 
     * @param options.ignoreErrors 是否忽略callback错误，默认情况下，当callback出错时会忽略
     */
    _forEachDFS(callback: (
        node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>,
        parent: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    ) => void, options?: { includeSelf?: boolean, ignoreErrors?: boolean }) {
        const { includeSelf = true, ignoreErrors = true } = options || {}
        type Node = FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>
        let isAbort = false
        const forEachNode = (node: Node, parent: Node | undefined) => {
            isAbort = this._executeForEachCallback(callback, node, parent, ignoreErrors)
            if (isAbort) return
            if (node.children) {
                node.children.forEach((child) => {
                    forEachNode(child, node)
                })
            }
        }
        if (includeSelf) {
            forEachNode(this, this.parent)
        } else {
            for (let node of this._children || []) {
                if (isAbort) break
                forEachNode(node, this)
            }
        }

    }
    /**
     * 
     * 广度优先遍历树节点
     * 
     * 通过触发FlexTreeAbortError中断遍历
     * 
     * @param callback 遍历节点
     * @param options 
     * @param options.includeSelf 是否包含自身 
     */
    _forEachBFS(callback: (
        node: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>,
        parent: FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId> | undefined
    ) => void, options?: { includeSelf?: boolean, ignoreErrors?: boolean }) {
        const { includeSelf = true, ignoreErrors = true } = options || {};
        type Node = FlexTreeNode<Fields, KeyFields, NodeFields, NodeId, TreeId>;

        // 使用数组作为队列
        const queue: Array<{ node: Node, parent: Node | undefined }> = [];

        // 根据includeSelf选项决定是否将当前节点加入队列
        if (includeSelf) {
            queue.push({ node: this, parent: this.parent });
        } else if (this._children) {
            // 如果不包含自身，则将所有子节点加入队列
            this._children.forEach(child => {
                queue.push({ node: child, parent: this });
            });
        }
        // 广度优先遍历
        while (queue.length > 0) {
            const { node, parent } = queue.shift()!;
            const isAbort = this._executeForEachCallback(callback, node, parent, ignoreErrors)
            if (isAbort) break;
            // 将当前节点的子节点加入队列
            if (node._children) {
                node._children.forEach(child => {
                    queue.push({ node: child, parent: node });
                });
            }
        }
    }
}