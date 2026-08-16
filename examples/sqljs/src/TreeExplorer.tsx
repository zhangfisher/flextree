/**
 * 组织架构树主视图：headless-tree 渲染 + FlexTree 数据源。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  dragAndDropFeature,
  hotkeysCoreFeature,
  selectionFeature,
  syncDataLoaderFeature,
  isOrderedDragTarget,
  type ItemInstance,
} from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Users,
  User,
  Trash2,
  RotateCcw,
  UserPlus,
  Plus,
  Pencil,
  Trash,
  ShieldCheck,
  RefreshCw,
  Table,
  Network,
  ArrowUp,
  ArrowDown,
  Activity,
  Eraser,
  Database,
} from "lucide-react";
import {
  FlexTreeSource,
  type TreeEventEntry,
  type TreeItemData,
  type TreeMode,
  type TreeSnapshot,
} from "./tree-source";
import { clearSnapshot } from "./db";

const RECYCLEBIN_ID = "9999";

interface TreeExplorerProps {
  source: FlexTreeSource;
  mode: TreeMode;
  onChanged: () => void;
}

export function TreeExplorer({ source, mode, onChanged }: TreeExplorerProps) {
  const [snapshot, setSnapshot] = useState<TreeSnapshot>({
    items: {},
    rootIds: [],
    rows: [],
  });
  const [events, setEvents] = useState<TreeEventEntry[]>([]);
  const [sqlModal, setSqlModal] = useState<TreeEventEntry | null>(null);
  const [view, setView] = useState<"tree" | "table">("tree");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const dataRef = useRef(snapshot);
  dataRef.current = snapshot;

  const refresh = useCallback(async () => {
    const snap = await source.snapshot();
    setSnapshot(snap);
    onChanged();
  }, [source, onChanged]);

  useEffect(() => {
    // 事件流订阅：上限 200 条，超出丢弃最旧（防长会话内存膨胀）
    source.onEvent = (entry) => {
      setEvents((prev) => [...prev.slice(-199), entry]);
    };
    return () => {
      source.onEvent = undefined;
    };
  }, [source]);

  useEffect(() => {
    // 首帧 items 为空 → snapshot 异步到位后必须 rebuildTree，
    // 否则 headless-tree 仍按空 loader 的旧结果渲染。
    // 同时展开首层（根/用户根）——根 id 非固定（AUTOINCREMENT），按数据取
    void refresh().then(() => {
      const api = treeApiRef.current;
      if (!api) return;
      for (const id of dataRef.current.rootIds) {
        api.getItemInstance(id)?.expand();
      }
      api.rebuildTree();
    });
  }, [refresh, mode]);

  const applyChange = useCallback(async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      // 边界操作（如首/末兄弟的上/下移晋升到根级）core 抛 InvalidOperationError：
      // 数据已在事务中回滚，UI 仅提示不中断
      console.warn(String(e));
      return;
    }
    await refresh();
    treeApiRef.current?.rebuildTree();
  }, [refresh]);

  const tree = useTree<TreeItemData>({
    initialState: { expandedItems: ["1"] },
    rootItemId: "root",
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().kind === "dept",
    canReorder: true,
    indent: 16,
    dataLoader: {
      // 删除/移动后 rebuildTree 与 React rerender 之间存在中间帧：可见项列表还是旧的，
      // 可能查询已不存在的 id。返回占位数据而非 undefined，避免 headless-tree 抛错崩溃
      getItem: (id) => dataRef.current.items[id] ?? { name: "…", kind: "person" },
      getChildren: (id) =>
        id === "root" ? dataRef.current.rootIds : dataRef.current.items[id]?.children ?? [],
    },
    onDrop: async (dragged, target) => {
      const dragId = dragged[0].getId();
      // 落到回收站 = 逻辑删除（core 的 deleteNode(recycle:true) 即 moveNode 进站，
      // 直接走该 API 而非 moveNode——站内落点被回收站门控拒绝是设计使然）
      const dropTargetId = target.item.getId();
      if (dropTargetId === RECYCLEBIN_ID) {
        await applyChange(() => source.deleteNode(dragId, true));
        return;
      }
      if (isOrderedDragTarget(target)) {
        // 兄弟排序：target.item 即新父，insertionIndex 为新父内插入位
        const siblingIds =
          dropTargetId === "root"
            ? dataRef.current.rootIds
            : (dataRef.current.items[dropTargetId]?.children ?? []);
        await applyChange(() =>
          source.moveNode(dragId, {
            newParentId: dropTargetId === "root" ? null : dropTargetId,
            siblingIds: siblingIds.filter((id) => id !== dragId),
            insertionIndex: target.insertionIndex,
          }),
        );
      } else {
        // 放进目标内部：成为最后一个孩子
        await applyChange(() =>
          source.moveNode(dragId, {
            newParentId: dropTargetId,
            siblingIds: dataRef.current.items[dropTargetId]?.children ?? [],
            insertionIndex: Number.MAX_SAFE_INTEGER,
          }),
        );
      }
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature, dragAndDropFeature],
  });
  const treeApiRef = useRef(tree);
  treeApiRef.current = tree;

  const selectedId = tree.getSelectedItems()[0]?.getId() ?? null;
  const selectedItem = selectedId ? snapshot.items[selectedId] : undefined;
  // 单树模式的根节点：上移/下移无意义（无兄弟，core 会抛 InvalidOperationError）
  const isSingleRoot =
    mode === "single" && !!selectedId && snapshot.rootIds[0] === selectedId;

  // ===== 操作 =====
  const addNode = (kind: "dept" | "person") => {
    const name = kind === "dept" ? "新部门" : "新员工";
    const parentId = selectedItem?.kind === "dept" ? selectedId : null;
    void applyChange(() => source.addNode(parentId, name, kind));
  };
  const remove = (recycle: boolean) => {
    if (!selectedId || selectedId === RECYCLEBIN_ID) return;
    void applyChange(() => source.deleteNode(selectedId, recycle));
  };
  const verifyTree = async () => {
    const ok = await source.verify();
    alert(ok ? "✅ 树结构校验通过（左右值/层级/唯一性均合法）" : "❌ 树结构校验失败");
  };
  const resetAll = async () => {
    clearSnapshot();
    await source.reset();
    await refresh();
    tree.rebuildTree();
  };

  const binChildren = snapshot.items[RECYCLEBIN_ID]?.children ?? [];

  return (
    <div className="explorer">
      <div className="toolbar">
        <button onClick={() => addNode("dept")} title="新增部门">
          <Plus size={16} />
        </button>
        <button onClick={() => addNode("person")} title="新增员工">
          <UserPlus size={16} />
        </button>
        <button
          onClick={() => selectedId && setRenamingId(selectedId)}
          disabled={!selectedId || selectedId === RECYCLEBIN_ID}
          title="重命名"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={() => remove(true)}
          disabled={!selectedId || selectedId === RECYCLEBIN_ID}
          title="移入回收站（逻辑删除）"
        >
          <Trash2 size={16} />
        </button>
        <button
          onClick={() => remove(false)}
          disabled={!selectedId || selectedId === RECYCLEBIN_ID}
          title="彻底删除（物理删除）"
        >
          <Trash size={16} />
        </button>
        <button
          onClick={() => selectedId && void applyChange(() => source.moveUpDown(selectedId, "up"))}
          disabled={!selectedId || selectedId === RECYCLEBIN_ID || isSingleRoot}
          title="上移选中节点"
        >
          <ArrowUp size={16} />
        </button>
        <button
          onClick={() => selectedId && void applyChange(() => source.moveUpDown(selectedId, "down"))}
          disabled={!selectedId || selectedId === RECYCLEBIN_ID || isSingleRoot}
          title="下移选中节点"
        >
          <ArrowDown size={16} />
        </button>
        <span className="spacer" />
        <button
          className={view === "tree" ? "active" : ""}
          onClick={() => setView("tree")}
          title="树视图"
        >
          <Network size={16} />
        </button>
        <button
          className={view === "table" ? "active" : ""}
          onClick={() => setView("table")}
          title="表格视图（Nested Set 左右值）"
        >
          <Table size={16} />
        </button>
        <button onClick={verifyTree} title="校验树结构">
          <ShieldCheck size={16} />
        </button>
        <button onClick={resetAll} title="重置演示数据">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="main">
        <div className="tree-pane">
          {view === "tree" ? (
            <div {...tree.getContainerProps()} className="tree">
              {tree.getItems().map((item) => (
                <TreeRow
                  key={item.getId()}
                  item={item}
                  renaming={renamingId === item.getId()}
                  onRenamed={(name) => {
                    setRenamingId(null);
                    if (name) void applyChange(() => source.renameNode(item.getId(), name));
                  }}
                  onCancelRename={() => setRenamingId(null)}
                  onClearBin={
                    item.getId() === RECYCLEBIN_ID && binChildren.length > 0
                      ? () => void applyChange(() => source.clearRecycleBin())
                      : undefined
                  }
                  onRestore={
                    item.isDescendentOf(RECYCLEBIN_ID)
                      ? () => void applyChange(() => source.restoreFromBin(item.getId()))
                      : undefined
                  }
                />
              ))}
              <div style={tree.getDragLineStyle()} className="dragline" />
            </div>
          ) : (
            <TreeTable snapshot={snapshot} recyclebinId={RECYCLEBIN_ID} />
          )}
        </div>

        <div className="events-pane">
          <h3>
            <Activity size={14} /> 事件流
            {events.length > 0 && (
              <button className="clear-events" onClick={() => setEvents([])}>
                清空
              </button>
            )}
          </h3>
          <ul className="events-list">
            {events.length === 0 && <li className="empty">等待操作事件…</li>}
            {events.map((e) => (
              <li key={e.id} className={`evt evt-${e.type.replace(":", "-")}`}>
                <span className="evt-head">
                  <span className="evt-type">{e.type}</span>
                  {e.detail && <span className="evt-detail">{e.detail}</span>}
                  {e.sqls && (
                    <span
                      role="button"
                      className="evt-sql-trigger"
                      title="查看 SQL"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSqlModal(e);
                      }}
                    >
                      <Database size={12} />
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {sqlModal && (
            <div className="sql-modal" onClick={() => setSqlModal(null)}>
              <div className="sql-modal-body" onClick={(ev) => ev.stopPropagation()}>
                <h4>事务 SQL（{sqlModal.sqls?.length ?? 0} 条）</h4>
                <table className="sql-table">
                  <tbody>
                    {(sqlModal.sqls ?? []).map((sql, i) => (
                      <tr key={i}>
                        <td className="sql-idx">{i + 1}</td>
                        <td>
                          {/* core 生成的 SQL 带多行缩进，压缩为单行紧凑展示 */}
                          <code>{sql.replace(/\s+/g, " ").trim()}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button className="sql-close" onClick={() => setSqlModal(null)}>
                  关闭
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 表格视图：直接展示树表的物理行（Nested Set Model 的左右值可视化） */
function TreeTable({ snapshot, recyclebinId }: { snapshot: TreeSnapshot; recyclebinId: string }) {
  const rows = snapshot.rows;
  const inBin = new Set<string>();
  // bin 区间内的行标记：leftValue 在 bin 节点区间内
  const bin = rows.find((r) => String(r.id) === recyclebinId);
  if (bin) {
    for (const r of rows) {
      if (r.leftValue >= bin.leftValue && r.rightValue <= bin.rightValue) inBin.add(String(r.id));
    }
  }
  return (
    <div className="tree-table-wrap">
      <table className="tree-table">
        <thead>
          <tr>
            <th>id</th>
            <th>名称（按 leftValue 顺序）</th>
            <th>类型</th>
            <th>level</th>
            <th>leftValue</th>
            <th>rightValue</th>
            <th>宽度</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const id = String(r.id);
            const isBinRow = id === recyclebinId;
            const recycled = inBin.has(id) && !isBinRow;
            return (
              <tr key={id} className={isBinRow || recycled ? "bin-row" : ""}>
                <td>{r.id}</td>
                <td style={{ paddingLeft: `${Math.max(r.level, 0) * 18}px` }}>{r.name}</td>
                <td>{isBinRow ? "回收站" : r.kind === "person" ? "员工" : "部门"}</td>
                <td>{r.level}</td>
                <td>{r.leftValue}</td>
                <td>{r.rightValue}</td>
                <td>{r.rightValue - r.leftValue + 1}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TreeRow({
  item,
  renaming,
  onRenamed,
  onCancelRename,
  onClearBin,
  onRestore,
}: {
  item: ItemInstance<TreeItemData>;
  renaming: boolean;
  onRenamed: (name: string) => void;
  onCancelRename: () => void;
  /** 回收站行的清空按钮（仅 bin 行传入有效值） */
  onClearBin?: () => void;
  /** 站内节点的恢复按钮（仅被回收节点传入有效值） */
  onRestore?: () => void;
}) {
  const data = item.getItemData();
  const expanded = item.isExpanded();
  const isDept = item.isFolder();
  const isBin = item.getId() === RECYCLEBIN_ID;
  // 站内节点（bin 的后代，不含 bin 自身）：灰色显示，可拖出到站外完成恢复
  const inBin = !isBin && item.isDescendentOf(RECYCLEBIN_ID);

  if (renaming) {
    return (
      <div className="rename-row" style={{ paddingLeft: `${item.getItemMeta().level * 16}px` }}>
        <input
          autoFocus
          defaultValue={data.name}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenamed((e.target as HTMLInputElement).value.trim());
            if (e.key === "Escape") onCancelRename();
          }}
          onBlur={(e) => onRenamed(e.target.value.trim())}
        />
      </div>
    );
  }

  return (
    <button
      {...item.getProps()}
      style={{ paddingLeft: `${item.getItemMeta().level * 16}px` }}
      className="treeitem-button"
    >
      <div
        className={[
          "treeitem",
          item.isFocused() && "focused",
          item.isSelected() && "selected",
          item.isDragTarget() && "drop-target",
          (isBin || inBin) && "bin",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isDept ? (
          expanded ? (
            <ChevronDown size={14} className="chevron" />
          ) : (
            <ChevronRight size={14} className="chevron" />
          )
        ) : (
          <span className="chevron-placeholder" />
        )}
        {isBin ? (
          <Trash2 size={14} />
        ) : isDept ? (
          item.getItemMeta().level === 1 ? (
            <Building2 size={14} />
          ) : (
            <Users size={14} />
          )
        ) : (
          <User size={14} />
        )}
        <span className="name">{data.name}</span>
        {isBin && onClearBin && (
          <span
            role="button"
            className="row-action bin-clear"
            title="清空回收站"
            onClick={(e) => {
              e.stopPropagation();
              onClearBin();
            }}
          >
            <Eraser size={13} />
          </span>
        )}
        {onRestore && (
          <span
            role="button"
            className="row-action bin-restore"
            title="恢复"
            onClick={(e) => {
              e.stopPropagation();
              onRestore();
            }}
          >
            <RotateCcw size={13} />
          </span>
        )}
        {data.pos && (
          <span className="ns-pos">
            ({data.pos[0]}, {data.pos[1]})
          </span>
        )}
      </div>
    </button>
  );
}
