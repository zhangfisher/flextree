import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNodeFields, NonUndefined } from '../types'

export class IsNodeMixin<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    /**
     * 返回两个节点是否在同一棵树中
     */
    isSameTree(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node1: TreeNode, node2: TreeNode) {
        if (this.isMultiTree) {
            return node1[this.keyFields.treeId] === node2[this.keyFields.treeId]
        } else {
            return true
        }
    }

    /**
     * 判断两个节点是否相同
     *
     */
    isSameNode(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node1: TreeNode, node2: TreeNode) {
        return node1[this.keyFields.id] === node2[this.keyFields.id]
    }

    /**
     *
     * 判断给定的节点数据是否有效
     *
     * @description
     *
     * 用于检查传入的节点参数是否符合预期，确保节点存在且类型正确。这通常在处理与节点相关的操作之前进行，以避免潜在的错误。
     *
     * @example
     * isValidNode('123'); // 返回false，因为'123'不是一个有效的节点ID或TreeNode对象
     * isValidNode({ id: 123, label: '节点' }); // 返回true，因为这是一个有效的TreeNode对象    *
     *
     * @param {any} node - 需要判断的节点
     * @returns {boolean} - 如果节点有效，返回true；否则返回false
     */
    isValidNode(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: any): boolean {
        if (!node) {
            return false
        }
        if (typeof (node) !== 'object') {
            return false
        }
        const keyFields = Object.values(this.keyFields) as string[]
        if (!this.isMultiTree) {
            const index = keyFields.indexOf(this.keyFields.treeId)
            if (index >= 0) { keyFields.splice(index, 1) }
        }
        const nodeKeys = Object.keys(node)
        if (!keyFields.every(k => nodeKeys.includes(k))) {
            return false
        }

        if (!node[this.keyFields.id]) {
            return false
        }
        if (!(typeof (node[this.keyFields.leftValue]) === 'number' && node[this.keyFields.leftValue] >= 1)) {
            return false
        }
        if (!(typeof (node[this.keyFields.rightValue]) === 'number' && node[this.keyFields.rightValue] >= 1)) {
            return false
        }
        if (node[this.keyFields.leftValue] >= node[this.keyFields.rightValue]) {
            return false
        }
        if (!(typeof (node.level) === 'number' || node.level >= 0)) {
            return false
        }
        return true
    }

    /**
     * 判断节点是否是回收站节点本身（按配置的 bin id 匹配）
     *
     * 未启用回收站时恒为 false
     */
    isRecycleBin(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: TreeNode | NodeId) {
        if (!this.recycleBinEnabled) return false
        const nodeId = typeof node === 'object' ? (node as any)[this.keyFields.id] : node
        return nodeId === this._getBinId()
    }

    /**
     * 判断节点是否位于回收站内（Bin 自身与其后代均返回 true——闭区间，与过滤条件形态一致）
     *
     * 未启用回收站或 bin 不存在时恒为 false。
     * 注意：Partial 对象（如 update 的入参）没有坐标，按 id 点查读库后判定
     */
    async isInRecycleBin(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, node: TreeNode | NodeId): Promise<boolean> {
        if (!this.recycleBinEnabled) return false
        const range = await this._getBinRange()
        if (!range) return false
        // 有完整坐标的节点对象直接判定；Partial 对象（缺 leftValue/rightValue）按 id 读库
        let nodeData: any = typeof node === 'object' ? node : null
        if (!nodeData || typeof nodeData[this.keyFields.leftValue] !== 'number') {
            const id = typeof node === 'object' ? (node as any)[this.keyFields.id] : node
            if (id === undefined || id === null) return false
            nodeData = await this.getNodeData(id)
        }
        const left = nodeData[this.keyFields.leftValue]
        const right = nodeData[this.keyFields.rightValue]
        return left >= range.left && right <= range.right
    }
}
