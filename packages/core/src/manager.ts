/**
 *
 * 树管理器,负责核心的树操作
 *
 */
import { deepMerge } from 'flex-tools/object/deepMerge'
import type { RequiredDeep } from 'type-fest'
import sqlstring from 'sqlstring'
import { mix } from 'ts-mixer'
import mitt from 'mitt'
import type { IFlexTreeAdapter } from './adapter'
import { FlexTreeDriverError, FlexTreeError, FlexTreeInvalidUpdateError } from './errors'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, FlexTreeEvents, IFlexTreeNodeFields, NonUndefined } from './types'
import { MoveNodeMixin } from './mixins/move.mixin'
import { DeleteNodeMixin } from './mixins/delete.mixin'
import { AddNodeMixin } from './mixins/add.mixin'
import { IsNodeMixin } from './mixins/is.mixin'
import { SqlMixin } from './mixins/sql.mixin'
import { GetNodeMixin } from './mixins/get.mixin'
import { FindNodeMixin } from './mixins/find.mixin'
import { RootNodeMixin } from './mixins/root.mixin'
import { RelationMixin } from './mixins/relation.mixin'
import { UpdateNodeMixin } from './mixins/update.mixin'
import { VerifyTreeMixin } from './mixins/verify.mixin'

export interface FlexTreeManagerOptions<TreeIdType = number> {
    treeId?: TreeIdType // 使用支持单表多树时需要提供
    fields?: {
        id?: string
        name?: string
        treeId?: string
        level?: string
        leftValue?: string
        rightValue?: string
    }
    adapter: IFlexTreeAdapter
}

export interface FlexTreeManager<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> extends MoveNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    DeleteNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    AddNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    IsNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    SqlMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    GetNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    FindNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    RootNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    RelationMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    UpdateNodeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId>,
    VerifyTreeMixin<Fields, KeyFields, TreeNode, NodeId, TreeId> { }

/**
 *
 *
 *
 * 泛型:
 *  - Node:  除了关键字段外的其他字段
 *  - NodeId:  id字段的类型
 *  - TreeIdType:  treeId字段的类型
 *  - KeyFields: 当自定义的关键字段名称,需要提供该类型
 *
 */
@mix(
    MoveNodeMixin,
    DeleteNodeMixin,
    AddNodeMixin,
    IsNodeMixin,
    SqlMixin,
    GetNodeMixin,
    FindNodeMixin,
    RootNodeMixin,
    RelationMixin,
    UpdateNodeMixin,
    VerifyTreeMixin,
)
// eslint-disable-next-line ts/no-unsafe-declaration-merging
export class FlexTreeManager<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    // eslint-disable-next-line unused-imports/no-unused-vars
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    // eslint-disable-next-line unused-imports/no-unused-vars
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    private _options: RequiredDeep<FlexTreeManagerOptions<TreeId>>
    private _isWriting = false
    private _tableName: string
    private _treeId: any
    private _fields: RequiredDeep<NonUndefined<FlexTreeManagerOptions['fields']>>
    private _adapter: IFlexTreeAdapter
    private _ready: boolean = false // 当driver准备就绪时,ready为true时,才允许执行读写操作
    private _emitter = mitt<FlexTreeEvents>()
    private _lastUpdateAt = 0
    constructor(tableName: string, options?: FlexTreeManagerOptions<KeyFields['treeId']>) {
        this._tableName = tableName
        this._options = deepMerge(
            {
                treeId: undefined,
                fields: {
                    id: 'id',
                    name: 'name',
                    treeId: 'treeId',
                    level: 'level',
                    leftValue: 'leftValue',
                    rightValue: 'rightValue',
                },
            },
            options,
        ) as RequiredDeep<FlexTreeManagerOptions<TreeId>>
        if (!this._options.adapter) {
            throw new FlexTreeError('not found database driver')
        }
        this._fields = this._options.fields
        this._treeId = this.options.treeId
        this._adapter = this.options.adapter
        this._adapter.bind(this as FlexTreeManager)
    }

    get options() {
        return this._options
    }

    get updating() {
        return this._isWriting
    }

    get tableName() {
        return this._tableName
    }

    get adapter() {
        return this._options.adapter!
    }

    get treeId() {
        return this._treeId
    }

    set treeId(value: TreeId) {
        this._treeId = value
    }

    get keyFields() {
        return this._fields
    }

    get updateAt() {
        return this._lastUpdateAt
    }

    get isMultiTree() {
        return this._treeId !== undefined
    }

    get on() {
        return this._emitter.on.bind(this)
    }

    get off() {
        return this._emitter.off.bind(this)
    }

    get emit() {
        return this._emitter.emit.bind(this)
    }

    async ready() {
        if (this._adapter && this._ready) {
            return true
        }
        return false
    }

    async assertDriverReady() {
        try {
            if (!this._adapter) {
                throw new FlexTreeDriverError()
            }
            if (!this._adapter.ready) {
                await this._adapter.open()
            }
        } catch (e: any) {
            throw new FlexTreeDriverError(e.message)
        }
        if (!this._adapter.ready) {
            throw new FlexTreeDriverError()
        }
    }

    /**
     * 执行更新操作
     *
     * 由于树更新操作需要破坏树的leftValue,rightValue等，
     * 所以需要严格禁止并发操作，因此所有的树更新操作需要通过update方法进行
     *
     * update方法通过设置isUpdating标志位来阻止并发操作
     *
     * tree.write(async ()=>{
     *
     * })
     *
     * @param fn
     */
    async write(fn: (tree: FlexTreeManager) => Promise<void>) {
        if (this._isWriting) {
            throw new FlexTreeInvalidUpdateError('The tree is performing a write operation and does not support concurrent operations')
        }
        this._isWriting = true
        this._emitter.emit('beforeWrite')
        try {
            await fn(this as FlexTreeManager)
            this._lastUpdateAt = Date.now()
        } finally {
            this._isWriting = false
            this._emitter.emit('afterWrite')
        }
    }

    /**
     * 在多树表中，需要在记录中注入treeId字段
     */
    protected withTreeId(record: Record<string, any>) {
        if (this.isMultiTree) {
            record[this._fields.treeId] = sqlstring.escape(this._treeId)
        }
    }

    protected _assertWriteable() {
        if (!this._isWriting) {
            throw new FlexTreeInvalidUpdateError('The tree write operation must be performed within write(async ()=>{....})')
        }
    }
}
