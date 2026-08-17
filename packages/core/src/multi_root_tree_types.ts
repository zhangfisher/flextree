/**
 * MultiRootFlexTree 的类型前向声明（仅类型，打破 node.ts ↔ multi_root_tree.ts 循环依赖）
 *
 * node.ts 需要在 node.tree 的公开返回类型中引用宿主树联合
 * （FlexTree | MultiRootFlexTree），而 multi_root_tree.ts 又依赖 node.ts
 * 的 FlexTreeNode——真实类定义在 ./multi_root_tree，此处只做类型中转。
 */
import type {
  CustomTreeKeyFields,
  DefaultTreeKeyFields,
  IFlexTreeNodeFields,
  NonUndefined,
} from "./types";
import type { FlexTreeNodeHostTree } from "./node";

export interface MultiRootFlexTree<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  NodeFields extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<
    Fields,
    KeyFields
  >,
  NodeId = NonUndefined<KeyFields["id"]>[1],
> extends FlexTreeNodeHostTree<Fields, KeyFields, NodeFields, NodeId, any> {}
