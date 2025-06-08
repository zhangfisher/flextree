import type { FlexTreeManager } from '../manager'
import type { CustomTreeKeyFields, DefaultTreeKeyFields, IFlexTreeNodeFields, NonUndefined } from '../types'
import { FlexTreeNodeRelation } from '../types'

export class RelationMixin<
    Fields extends Record<string, any> = object,
    KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
    TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
    NodeId = NonUndefined<KeyFields['id']>[1],
    TreeId = NonUndefined<KeyFields['treeId']>[1],
> {
    /**
     * 获取两个节点之间的关系。
     *
     * @param {Node} srcNode - 第一个节点。
     * @param {Node} targetNode - 第二个节点。
     * @returns {string} 返回两个节点之间的关系。可能的值包括 "Parent"、"Child"、"Sibling"、"Ancestor"、"Descendant" 或 "Unrelated"。
     *
     * @example
     * const relation = getNodeRelation(node1, node2);
     * console.log(relation);  // 输出: FlexTreeNodeRelation.Child
     */
    async getNodeRelation(this: FlexTreeManager<Fields, KeyFields, TreeNode, NodeId, TreeId>, srcNode: NodeId | TreeNode, targetNode: NodeId | TreeNode): Promise<FlexTreeNodeRelation> {
        const node = this.isValidNode(srcNode) ? srcNode as TreeNode : (await this.getNode(srcNode as NodeId)) as TreeNode
        const relNode = this.isValidNode(targetNode) ? targetNode as TreeNode : (await this.getNode(targetNode as NodeId)) as TreeNode

        let result: FlexTreeNodeRelation = FlexTreeNodeRelation.Unknow

        const nodeId = node[this.keyFields.id]
        const relNodeId = relNode[this.keyFields.id]

        const leftValue = node[this.keyFields.leftValue]
        const rightValue = node[this.keyFields.rightValue]
        const level = node[this.keyFields.level]

        const relLeftValue = relNode[this.keyFields.leftValue]
        const relRightValue = relNode[this.keyFields.rightValue]
        const relLevel = relNode[this.keyFields.level]

        if (this.isSameTree(node, relNode)) {
            if (this.isSameNode(node, relNode)) {
                result = FlexTreeNodeRelation.Self // 两个节点相等
                // }else if (leftValue > relLeftValue && rightValue < relRightValue && level == relLevel +1 ) {
                //     result = FlexTreeNodeRelation.Child;        // 一个节点是另一个节点的子节点
            } else if (leftValue > relLeftValue && rightValue < relRightValue) {
                result = FlexTreeNodeRelation.Descendants // 一个节点是另一个节点的后代
                // } else if (leftValue < relLeftValue && rightValue > relRightValue && level == relLevel - 1) {
                //     result = FlexTreeNodeRelation.Parent;       // 一个节点是另一个节点的父节点
            } else if (leftValue < relLeftValue && rightValue > relRightValue) {
                result = FlexTreeNodeRelation.Ancestors // 一个节点是另一个节点的祖先
            } else {
                const sql = this._sql(`SELECT 
                CASE 
                    WHEN t1.${this.keyFields.id}  = t2.${this.keyFields.id}  THEN 1 ELSE 0
                END as isSiblings
                FROM 
                    ( SELECT Node.* FROM  ${this.tableName} Node
                        JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id} = ${nodeId}
                        WHERE ( {__TREE_ID__}
                        Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue}
                        AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue}
                        ) ORDER BY ${this.keyFields.leftValue} DESC LIMIT 1
                    ) AS t1,
                    ( SELECT Node.* FROM  ${this.tableName} Node
                        JOIN ${this.tableName} RelNode ON RelNode.${this.keyFields.id}  = ${relNodeId}
                        WHERE ( {__TREE_ID__}
                        Node.${this.keyFields.leftValue} < RelNode.${this.keyFields.leftValue}
                        AND Node.${this.keyFields.rightValue} > RelNode.${this.keyFields.rightValue}
                        ) ORDER BY ${this.keyFields.leftValue} DESC LIMIT 1
                    ) AS t2`)
                const r = await this.onGetScalar(sql) // 两个节点在同一棵树中
                if (r === 1) {
                    result = FlexTreeNodeRelation.Siblings // 两个节点是兄弟节点
                } else if (level === relLevel) {
                    result = FlexTreeNodeRelation.SameLevel // 两个节点是同级节点
                } else {
                    result = FlexTreeNodeRelation.SameTree //
                }
            }
        } else {
            result = FlexTreeNodeRelation.DiffTree // 两个节点在不同的树中
        }
        return result
    }
}
