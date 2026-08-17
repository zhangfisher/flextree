/**
 * flextree-rest 公共类型
 *
 * TreeManagerLike 是 FlexTreeManager 与 MultiRootFlexTreeManager 的公共子集：
 * 两个 manager 的泛型签名不同，此处签名做宽松化（参数宽联合、返回 Promise<any>），
 * 接口仅约束"方法存在且可调用"，类型安全由路由层保证。
 */
import { MultiRootFlexTreeManager } from "flextree";

/** HTTP 层的 pos 表达：字符串形式，映射到 FlexNodeRelPosition 枚举 */
export type PosString = "lastChild" | "firstChild" | "nextSibling" | "previousSibling";

/** 注册选项 */
export interface RegisterOptions {
    /**
     * where 平铺等值过滤的字段白名单。
     * 未提供时仅允许关键字段名（id/name/level/treeId 等经 keyFields 解析后的物理列名）。
     */
    fields?: string[];
    /** NodeId 类型覆盖：默认智能转换（纯数字无前导零→number，否则 string） */
    idType?: "number" | "string";
    /** 请求体校验 hook：POST/PATCH 的 body 解析后调用，抛错 → 400 VALIDATION_FAILED */
    validate?: (body: unknown) => void;
    /** 节点 JSON Schema 覆盖（OpenAPI 文档生成用，原样嵌入；不校验运行时数据） */
    nodeSchema?: Record<string, unknown>;
}

/** 双 manager 公共子集（签名宽松化） */
export interface TreeManagerLike {
    write(fn: (tree: any) => Promise<void>): Promise<void>;
    getNodes(options?: any): Promise<any[]>;
    getNode(nodeId: any, options?: any): Promise<any>;
    addNodes(nodes: any[], options?: any): Promise<void>;
    update(node: any, options?: any): Promise<void>;
    deleteNode(nodeId: any, options?: any): Promise<void>;
    moveNode(node: any, toNode?: any, posOrOptions?: any): Promise<void>;
    moveUpNode(node: any): Promise<void>;
    moveDownNode(node: any): Promise<void>;
    copyNode(nodeId: any, options?: any): Promise<any>;
    canMoveTo(node: any, toNode?: any, options?: any): Promise<boolean>;
    getChildren(nodeId: any, options?: any): Promise<any[]>;
    getDescendants(nodeId?: any, options?: any): Promise<any[]>;
    getDescendantCount(nodeId: any, options?: any): Promise<number>;
    getAncestors(nodeId: any, options?: any): Promise<any[]>;
    getAncestorsCount(nodeId: any): Promise<number>;
    getParent(nodeId: any, options?: any): Promise<any>;
    getSiblings(nodeId: any, options?: any): Promise<any[]>;
    getNextSibling(nodeId: any, options?: any): Promise<any>;
    getPreviousSibling(nodeId: any, options?: any): Promise<any>;
    getNthChild?(node: any, index?: number, options?: any): Promise<any>;
    createRoot?(node: any): Promise<void>;
    getRoot?(options?: any): Promise<any>;
    hasRoot?(): Promise<boolean>;
    toJson(options?: any): Promise<any>;
    toList(options?: any): Promise<any>;
    clear(): Promise<void>;
    verify(): Promise<boolean>;
    repair(): Promise<void>;
    clearRecycleBin(): Promise<void>;
    isInRecycleBin(node: any): Promise<boolean>;
    readonly recycleBinEnabled: boolean;
    readonly options: any;
    readonly keyFields: any;
}

/**
 * 判定注册的 manager 是否为多根树管理器。
 * instanceof 为主（core 有导出 MultiRootFlexTreeManager），
 * 多副本加载导致 instanceof 失效时鸭子兜底（无 getNthChild 且有 nodes getter）。
 */
export function isMultiRootManager(manager: TreeManagerLike): boolean {
    if (manager instanceof MultiRootFlexTreeManager) return true;
    return (
        typeof (manager as any).getNthChild !== "function" &&
        Array.isArray((manager as any).nodes)
    );
}
