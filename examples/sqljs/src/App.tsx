/**
 * 应用入口：初始化 sql.js 数据库 + 模式切换（单树 / 多根树）。
 */
import { useEffect, useState } from "react";
import { Building2, Network } from "lucide-react";
import { openDatabase } from "./db";
import { FlexTreeSource, type TreeMode } from "./tree-source";
import { TreeExplorer } from "./TreeExplorer";

export default function App() {
  const [source, setSource] = useState<FlexTreeSource | null>(null);
  const [mode, setMode] = useState<TreeMode>("single");
  const [error, setError] = useState<Error | null>(null);
  const [dbSize, setDbSize] = useState(0);

  useEffect(() => {
    openDatabase()
      .then((db) => {
        const s = new FlexTreeSource(db);
        return s.init("single").then(() => setSource(s));
      })
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  const switchMode = async (next: TreeMode) => {
    if (!source || next === mode) return;
    await source.init(next);
    setMode(next);
  };

  if (error) return <pre className="loading">加载失败: {error.message}</pre>;
  if (!source) return <pre className="loading">正在加载 sql.js (wasm)…</pre>;

  return (
    <div className="app">
      <header>
        <h1>
          <Building2 size={18} /> 某科技集团 · 组织架构
        </h1>
        <p className="subtitle">
          FlexTree（Nested Set Model）× sql.js 浏览器内存库 · 写事务自动快照到 localStorage · 拖拽调整架构
        </p>
        <div className="mode-switch">
          <button className={mode === "single" ? "active" : ""} onClick={() => switchMode("single")}>
            <Building2 size={14} /> 单树（集团根）
          </button>
          <button className={mode === "multiroot" ? "active" : ""} onClick={() => switchMode("multiroot")}>
            <Network size={14} /> 多根树（分事业部）
          </button>
        </div>
      </header>
      <TreeExplorer
        key={mode}
        source={source}
        mode={mode}
        onChanged={() => setDbSize(source.getSnapshotBytes())}
      />
      <footer>数据库快照大小: {(dbSize / 1024).toFixed(1)} KB · 刷新页面可恢复数据</footer>
    </div>
  );
}
