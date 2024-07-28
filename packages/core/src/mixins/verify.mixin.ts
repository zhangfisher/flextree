import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNode, NonUndefined } from '../types'
import { FlexTreeVerifyError } from '../errors'

export class VerifyTreeMixin<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNode<Fields, KeyFields> = IFlexTreeNode<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    /**
     *
     * 校验树的完整性，即树的左右值是否正确
     *
     */
    async verify(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, nodes?: TreeNode[]) {
        nodes = nodes || await this.getNodes()
        const pnodes: IFlexTreeNode[] = []
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i] as IFlexTreeNode
            if (node[this.keyFields.rightValue]- node[this.keyFields.leftValue] === 1) { // 无子节点
                if (pnodes.length > 0) {
                    const pnode = pnodes[pnodes.length - 1]
                    if (pnode[this.keyFields.level] !== node[this.keyFields.level]  - 1) {
                        throw new FlexTreeVerifyError(`level error ${node[this.keyFields.name]}(${node[this.keyFields.id]})`)
                    } else if (!(node[this.keyFields.leftValue] > pnode[this.keyFields.leftValue])) {
                        throw new FlexTreeVerifyError(`leftValue error ${node[this.keyFields.name]}(${node[this.keyFields.id]})`)
                    } else if (!(node[this.keyFields.rightValue]< pnode[this.keyFields.leftValue])) {
                        throw new FlexTreeVerifyError(`rightValue error ${node[this.keyFields.name]}(${node[this.keyFields.id]})`)
                    }
                    // 子节点结束
                    if (node[this.keyFields.rightValue]+ 1 === pnode[this.keyFields.leftValue]) {
                        let preNode = pnodes.pop()
                        if (pnodes.length > 0) {
                            while (preNode![this.keyFields.rightValue] + 1 === pnodes[pnodes.length - 1]?.[this.keyFields.leftValue]) {
                                preNode = pnodes.pop()
                                if (pnodes.length === 0) {
                                    break
                                }
                            }
                        }
                    }
                }
                if ((node[this.keyFields.rightValue]- node[this.keyFields.leftValue] - 1) % 2 !== 0) {
                    throw new FlexTreeVerifyError(`${node[this.keyFields.name] }(${node[this.keyFields.id] }) rightValue - leftValue error `)
                }
            } else if (node[this.keyFields.rightValue]- node[this.keyFields.leftValue] >= 3) { // 有子节点
                //  rightValue-leftValue一定是奇数,否则说明有问题
                if ((node[this.keyFields.rightValue]- node[this.keyFields.leftValue] - 1) % 2 === 0) {
                    pnodes.push(node) // 先保存父节点
                } else {
                    throw new FlexTreeVerifyError(`${node.name}(${node[this.keyFields.id]}) rightValue - leftValue error `)
                }
            } else {
                throw new FlexTreeVerifyError()
            }
        }
        if (pnodes.length > 0) {
            throw new FlexTreeVerifyError()
        }
        return true
    }
}
