/**
 * FlexTree ↔ headless-tree 数据桥（组织架构树语义）。
 *
 * headless-tree 需要同步的 { id → item, id → children[] } 视图；
 * FlexTree 是异步 SQL 树。做法：任何写操作后调 reload() 全量拉平树重建该视图
 * （浏览器内存库，规模小，全量重建最简单可靠），再 tree.rebuildTree() 刷新 UI。
 */
import type { Database } from "sql.js";
import { FlexTreeManager, MultiRootFlexTreeManager, FlexNodeRelPosition } from "flextree";
import FlexTreeSqljsAdapter from "flextree-sqljs-adapter";
import { CREATE_TABLE, persistToLocalStorage } from "./db";
import { ORG_TREE, type OrgInput } from "./demo-data";

export interface OrgNode {
  id: number;
  name: string;
  kind: "dept" | "person";
  treeId: number;
  level: number;
  leftValue: number;
  rightValue: number;
}

/** headless-tree 的条目数据：children 存在即 dept */
export interface TreeItemData {
  name: string;
  kind: "dept" | "person";
  /** Nested Set 坐标（行尾展示用） */
  pos?: [number, number];
  children?: string[];
}

export type TreeMode = "single" | "multiroot";

export interface TreeSnapshot {
  items: Record<string, TreeItemData>;
  rootIds: string[];
  /** 表格视图：按 leftValue 排序的节点行（含结构字段，展示 Nested Set 原理） */
  rows: OrgNode[];
}

const RECYCLEBIN_ID = 9999;
const RECYCLEBIN_NAME = "回收站";

/** 事件面板条目 */
export interface TreeEventEntry {
  id: number;
  type: string;
  detail: string;
  /** write:commit 事件携带的本事务全部 SQL（hover 查看） */
  sqls?: string[];
}

/** 把嵌套演示数据转为 addNodes 的嵌套输入（children 字段） */
function toNestedInput(node: OrgInput): Partial<OrgNode> & { children?: unknown[] } {
  const input: Partial<OrgNode> & { children?: unknown[] } = { name: node.name, kind: node.kind };
  if (node.children?.length) {
    input.children = node.children.map(toNestedInput);
  }
  return input;
}

export class FlexTreeSource {
  private adapter: FlexTreeSqljsAdapter;
  private manager!: FlexTreeManager<OrgNode>;
  private multiManager!: MultiRootFlexTreeManager<OrgNode>;
  mode: TreeMode = "single";
  /** 事件监听（UI 面板订阅；init 时挂到当前模式的 manager 上） */
  onEvent?: (entry: TreeEventEntry) => void;
  private eventSeq = 0;
  private static EVENT_TYPES = [
    "write:before",
    "write:after",
    "write:commit",
    "node:added",
    "node:updated",
    "node:deleted",
    "node:recycled",
    "node:cleared",
    "node:moved",
  ] as const;

  constructor(private db: Database) {
    this.adapter = new FlexTreeSqljsAdapter(db, { onPersist: persistToLocalStorage });
  }

  /** id → 名称缓存（事件摘要用；snapshot 时刷新） */
  private _nameOf = new Map<string, string>();
  private _n(idOrNode: any): string {
    if (idOrNode == null) return "—";
    if (typeof idOrNode === "object") return idOrNode.name ?? String(idOrNode.id ?? "?");
    return this._nameOf.get(String(idOrNode)) ?? `#${idOrNode}`;
  }

  /** 把 mitt 事件载荷摘要为一行可读文本 */
  private _fmtEvent(type: string, payload: any): string {
    switch (type) {
      case "write:before":
      case "write:after":
      case "node:cleared":
        return "";
      case "write:commit":
        return `${payload.sqls.length} 条 SQL`;
      case "node:added":
        return `${(payload.nodes as any[]).map((n) => this._n(n)).join(", ")} → ${this._n(payload.at)} (pos=${payload.pos})`;
      case "node:updated":
        return this._n(payload.node);
      case "node:deleted":
        return `${this._n(payload.node)}${payload.recycled ? "（进回收站）" : ""}`;
      case "node:recycled":
        return this._n(payload.node);
      case "node:moved":
        return `${this._n(payload.from)} → ${this._n(payload.to)} (pos=${payload.pos})`;
      default:
        return JSON.stringify(payload)?.slice(0, 80) ?? "";
    }
  }

  /** 订阅当前 manager 的全部事件（切换模式时重挂） */
  private _bindEvents() {
    const target: any = this.mode === "single" ? this.manager : this.multiManager;
    for (const type of FlexTreeSource.EVENT_TYPES) {
      target.on(type, (payload: any) => {
        this.onEvent?.({
          id: ++this.eventSeq,
          type,
          detail: this._fmtEvent(type, payload),
          // write:commit 携带本事务全部 SQL 供面板 hover 查看
          ...(type === "write:commit" && Array.isArray(payload?.sqls)
            ? { sqls: payload.sqls as string[] }
            : {}),
        });
      });
    }
  }

  /** 初始化/切换模式。表空时播种演示数据（多根模式仅播种第一层事业部） */
  async init(mode: TreeMode) {
    this.mode = mode;
    if (mode === "single") {
      this.manager = new FlexTreeManager<OrgNode>("tree", {
        adapter: this.adapter,
        recyclebin: { id: RECYCLEBIN_ID, name: RECYCLEBIN_NAME },
      });
      if (!(await this.manager.hasRoot())) {
        await this.manager.write(async (t) => {
          await t.createRoot({ name: ORG_TREE.name, kind: "dept" } as Partial<OrgNode>);
          await t.addNodes(
            (ORG_TREE.children ?? []).map(toNestedInput),
            (await t.getRoot()).id,
            FlexNodeRelPosition.LastChild,
          );
        });
      }
    } else {
      this.multiManager = new MultiRootFlexTreeManager<OrgNode>("tree", {
        adapter: this.adapter,
        recyclebin: { id: RECYCLEBIN_ID, name: RECYCLEBIN_NAME },
      });
      await this.multiManager.load();
      const roots = await this.multiManager.getNodes({ level: 1 });
      if (roots.length === 0) {
        await this.multiManager.write(async (t) => {
          await t.addNodes(
            (ORG_TREE.children ?? []).map(toNestedInput),
            null,
            FlexNodeRelPosition.LastChild,
          );
        });
      }
    }
    this._bindEvents();
  }

  /** 拉平整棵树生成 headless-tree 数据视图（含回收站视角合并） */
  async snapshot(): Promise<TreeSnapshot> {
    const [visible, withBin] = await Promise.all([
      this.mode === "single"
        ? this.manager.getNodes()
        : this.multiManager.getNodes(),
      this.mode === "single"
        ? this.manager.getNodes({ includeRecyclebin: true })
        : this.multiManager.getNodes({ includeRecyclebin: true }),
    ]);
    const nodes: OrgNode[] = withBin.length >= visible.length ? withBin : visible;
    const items: Record<string, TreeItemData> = {};
    const childrenOf = new Map<string, string[]>();
    const rootIds: string[] = [];
    // getNodes 按 leftValue 排序，栈式重建父子关系
    const stack: OrgNode[] = [];
    for (const n of nodes) {
      while (stack.length && stack[stack.length - 1].rightValue < n.leftValue) stack.pop();
      const parentId = stack.length ? String(stack[stack.length - 1].id) : null;
      const list = parentId
        ? childrenOf.get(parentId) ?? childrenOf.set(parentId, []).get(parentId)!
        : null;
      if (list) list.push(String(n.id));
      stack.push(n);
    }
    for (const n of nodes) {
      items[String(n.id)] = { name: n.name, kind: n.kind, pos: [n.leftValue, n.rightValue] };
    }
    for (const [id, children] of childrenOf) {
      if (items[id]) {
        items[id].kind = "dept"; // 有孩子的必是部门
        items[id].children = children;
      }
    }
    // 顶层：单树=根节点自身（树管理器单树语义：根是可见的 level 0 节点）；
    // 多根=用户根层——MultiRootFlexTreeManager 返回的 level 已归一化
    // （隐藏根被过滤，用户根显示 level 0），用户根本身即顶层
    if (this.mode === "single") {
      const root = nodes.find((n) => n.level === 0);
      if (root) rootIds.push(String(root.id));
    } else {
      rootIds.push(...nodes.filter((n) => n.level === 0).map((n) => String(n.id)));
    }
    // 刷新 id→名称缓存（事件摘要用）
    this._nameOf = new Map(nodes.map((n) => [String(n.id), n.name]));
    return { items, rootIds, rows: nodes };
  }

  // ===== 写操作（全部经 write 事务，COMMIT 后自动触发快照持久化）=====

  async addNode(parentId: string | null, name: string, kind: "dept" | "person") {
    const input = { name, kind } as Partial<OrgNode>;
    if (this.mode === "single") {
      await this.manager.write(async (t) => {
        const root = await t.getRoot();
        await t.addNodes([input], parentId ? Number(parentId) : root.id, FlexNodeRelPosition.LastChild);
      });
    } else {
      await this.multiManager.write(async (t) => {
        await t.addNodes([input], parentId ? Number(parentId) : null, FlexNodeRelPosition.LastChild);
      });
    }
  }

  async renameNode(nodeId: string, name: string) {
    const node = { id: Number(nodeId), name } as Partial<OrgNode>;
    if (this.mode === "single") {
      await this.manager.write(async (t) => await t.update(node));
    } else {
      await this.multiManager.write(async (t) => await t.update(node));
    }
  }

  /** recycle=true 进回收站，false 物理删除 */
  async deleteNode(nodeId: string, recycle: boolean) {
    if (this.mode === "single") {
      await this.manager.write(async (t) => {
        await t.deleteNode(Number(nodeId), { recycle });
      });
    } else {
      await this.multiManager.write(async (t) => {
        await t.deleteNode(Number(nodeId), { recycle });
      });
    }
  }

  async clearRecycleBin() {
    if (this.mode === "single") {
      await this.manager.write(async (t) => await t.clearRecycleBin());
    } else {
      await this.multiManager.write(async (t) => await t.clearRecycleBin());
    }
  }

  /** 从回收站恢复：移回顶层（单树=根下，多根=新顶层） */
  async restoreFromBin(nodeId: string) {
    if (this.mode === "single") {
      await this.manager.write(async (t) => {
        // 站内节点须在回收站视角下读取，并以节点对象传参（对象即凭证）：
        // 裸 id 路径会被回收站门控判定为逻辑不存在（NotFound）
        const children = await t.getChildren(RECYCLEBIN_ID, { includeRecyclebin: true });
        const target = children.find((c: any) => String(c.id) === nodeId);
        if (target) {
          const root = await t.getRoot();
          await t.moveNode(target, root.id, {
            pos: FlexNodeRelPosition.LastChild,
            includeRecyclebin: true,
          });
        }
      });
    } else {
      await this.multiManager.write(async (t) => {
        // 多根下 moveNode 一律传裸 id（getNode 返回归一化对象，直接传会带错坐标，见 moveNode 注释）
        const targetId = Number(nodeId);
        // 多根树恢复为顶层：以任一顶层节点为参照放 NextSibling（toNode=null 不被多根 moveNode 支持）
        const tops = await t.getNodes({ level: 0, includeRecyclebin: true });
        const ref = tops[tops.length - 1];
        if (ref && String((ref as any).id) !== nodeId) {
          await t.moveNode(targetId, (ref as any).id, {
            pos: FlexNodeRelPosition.NextSibling,
            includeRecyclebin: true,
          } as any);
        }
      });
    }
  }

  /**
   * 拖拽移动。
   * headless-tree 语义：target 无 childIndex = 放进目标内部（LastChild）；
   * 有 childIndex = 兄弟排序，target.item 即新父，insertionIndex 为新父内插入位。
   * FlexTree 侧统一换算：排序场景用「参照孩子 + Before/After」表达。
   *
   * 支持从回收站拖出：源节点在站内时以「节点对象 + includeRecyclebin」传参
   * （对象即凭证），落点在站外即完成恢复（站内→站外跃迁，仅发 node:moved）。
   */
  async moveNode(
    dragId: string,
    target: {
      newParentId: string | null;
      /** newParent 的直接孩子 id 列表（视觉顺序） */
      siblingIds: string[];
      /** 插入到 siblingIds 的第几位 */
      insertionIndex: number;
    },
  ) {
    const { newParentId, siblingIds, insertionIndex } = target;
    const refId = siblingIds[Math.min(insertionIndex, siblingIds.length) - 1];

    const runSingle = async (t: FlexTreeManager<OrgNode>) => {
      // 站内视角读取源节点对象：站外节点也照常取到（含回收站的视图是超集）
      const srcNode = await t.getNode(Number(dragId), { includeRecyclebin: true });
      const srcInBin = await t.isInRecycleBin(srcNode!);
      if (!refId) {
        // 空父或插到最前：成为（第一个孩子的）前兄弟；父空则 LastChild
        const parent = newParentId
          ? ((await t.getNode(Number(newParentId)))!)
          : await t.getRoot();
        const children = await t.getChildren(parent.id);
        if (children.length > 0) {
          await t.moveNode(srcNode!, children[0].id, {
            pos: FlexNodeRelPosition.PreviousSibling,
            includeRecyclebin: srcInBin,
          });
        } else {
          await t.moveNode(srcNode!, parent.id, {
            pos: FlexNodeRelPosition.LastChild,
            includeRecyclebin: srcInBin,
          });
        }
      } else {
        await t.moveNode(srcNode!, Number(refId), {
          pos: FlexNodeRelPosition.NextSibling,
          includeRecyclebin: srcInBin,
        });
      }
    };

    const runMulti = async (t: MultiRootFlexTreeManager<OrgNode>) => {
      // 多根的 getNode/getChildren 返回 level 归一化（物理-1）的节点对象，而 core 的
      // moveNode「对象即凭证」直接使用对象坐标——必须传物理坐标：一律用裸 id 让
      // core 经 getNodeData 重查（bin 视角经 includeRecyclebin 放行）
      const srcId = Number(dragId);
      const srcInBin = await t.isInRecycleBin(srcId);
      const opts = {
        pos: FlexNodeRelPosition.NextSibling,
        includeRecyclebin: srcInBin,
      } as any;
      if (!refId) {
        // 无参照（插到最前/父为空）：以首孩子为前兄弟参照；多根顶层空位用第一个顶层节点
        // （多根的 moveNode 不接受 toNode=undefined——那是跨树迁出语义）
        const children = newParentId
          ? await t.getChildren(Number(newParentId))
          : await t.getNodes({ level: 0 });
        if (children.length > 0) {
          await t.moveNode(srcId, (children[0] as any).id, {
            ...opts,
            pos: FlexNodeRelPosition.PreviousSibling,
          });
        } else {
          await t.moveNode(srcId, newParentId ? Number(newParentId) : undefined, {
            ...opts,
            pos: FlexNodeRelPosition.LastChild,
          });
        }
      } else {
        await t.moveNode(srcId, Number(refId), opts);
      }
    };

    if (this.mode === "single") {
      // write 回调的 tree 泛型经 any 中转（manager 泛型推断为 object 联合）
      await this.manager.write(runSingle as any);
    } else {
      await this.multiManager.write(runMulti as any);
    }
  }

  async verify(): Promise<boolean> {
    return this.mode === "single" ? this.manager.verify() : this.multiManager.verify();
  }

  /** 上移/下移（兄弟重排；首/末兄弟时 core 自动向父级借位，边界不可移时抛错） */
  async moveUpDown(nodeId: string, direction: "up" | "down") {
    const id = Number(nodeId);
    const fn =
      direction === "up"
        ? (t: any) => t.moveUpNode(id)
        : (t: any) => t.moveDownNode(id);
    if (this.mode === "single") {
      await this.manager.write(fn);
    } else {
      await this.multiManager.write(fn);
    }
  }

  /** 物理清空整棵表并重置演示数据 */
  async reset() {
    this.db.exec("DROP TABLE IF EXISTS tree");
    this.db.exec(CREATE_TABLE);
    FlexTreeManager.clearInstance("tree");
    persistToLocalStorage(this.db);
    await this.init(this.mode);
  }

  /** 当前数据库快照大小（UI 展示用） */
  getSnapshotBytes(): number {
    return this.db.export().byteLength;
  }
}
