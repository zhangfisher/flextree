/**
 * Tree Registry：treeName → manager 注册表（CONTEXT.md「Tree Registry」）
 */
import { FlexTreeError } from "flextree";
import { TreeNotRegisteredError } from "./errors";
import { isMultiRootManager, type RegisterOptions, type TreeManagerLike } from "./types";

export interface RegistryEntry {
    /** HTTP 层树名（与表内 treeId 字段解耦） */
    name: string;
    manager: TreeManagerLike;
    /** 多根树判定结果（影响顶层添加/根列表/nthchild 行为） */
    multiRoot: boolean;
    /** where 过滤字段白名单（未提供时仅关键字段） */
    fields?: string[];
    /** NodeId 类型覆盖 */
    idType?: "number" | "string";
    /** 请求体校验 hook */
    validate?: (body: unknown) => void;
    /** 节点 JSON Schema 覆盖（OpenAPI 文档生成用，原样嵌入） */
    nodeSchema?: Record<string, unknown>;
}

export class TreeRegistry {
    private _trees = new Map<string, RegistryEntry>();

    /** 注册树；同名重复注册抛错（不静默覆盖） */
    register(name: string, manager: TreeManagerLike, options?: RegisterOptions): RegistryEntry {
        if (this._trees.has(name)) {
            throw new FlexTreeError(`Tree "${name}" is already registered`);
        }
        const entry: RegistryEntry = {
            name,
            manager,
            multiRoot: isMultiRootManager(manager),
            ...options,
        };
        this._trees.set(name, entry);
        return entry;
    }

    /** 注销（宿主生命周期管理用） */
    unregister(name: string): boolean {
        return this._trees.delete(name);
    }

    /** 取注册条目；未注册抛 TreeNotRegisteredError(404) */
    get(name: string): RegistryEntry {
        const entry = this._trees.get(name);
        if (!entry) throw new TreeNotRegisteredError(name);
        return entry;
    }

    /** 注册树列表（GET / 数据源） */
    list(): RegistryEntry[] {
        return [...this._trees.values()];
    }
}
