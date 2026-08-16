# sql.js

`flextree-sqljs-adapter` 是 `flextree` 的 [sql.js](https://sql.js.org/) 适配器——基于 WebAssembly 编译的 SQLite，**让树在浏览器中运行**：无需后端、无需服务，整棵树就是一个内存数据库，可随时导出快照持久化到 localStorage/IndexedDB 或下载。

适用场景：纯前端应用（离线工具、demo、原型）、Electron/Webview 内的本地树、需要在客户端完成全部树运算再同步回服务端的场景。

## 安装

`sql.js` 作为 peerDependency，需由调用方自行安装：

```bash
npm install flextree-sqljs-adapter sql.js
// or
yarn add flextree-sqljs-adapter sql.js
// or
pnpm add flextree-sqljs-adapter sql.js
// or
bun add flextree-sqljs-adapter sql.js
```

## 使用

适配器采用**注入实例模式**：sql.js 的初始化是异步的（需先加载 wasm），且 `locateFile` 的正确写法因打包器（Vite/Webpack/Next.js）而异——这些环境相关细节由调用方处理，适配器只接收已初始化的 `Database` 实例。数据库实例的生命周期（关闭等）同样由调用方管理。

```ts
import initSqlJs, { type Database } from "sql.js";
import FlexTreeSqljsAdapter from "flextree-sqljs-adapter";
import { FlexTreeManager } from "flextree";

// 1. 初始化 sql.js（异步：加载 wasm）
const SQL = await initSqlJs({
    // locateFile 指向 wasm 文件的位置，写法因打包器而异，详见 sql.js 文档
    locateFile: (file) => `https://sql.js.org/dist/${file}`,
});

// 2. 创建内存数据库实例，注入适配器
const db = new SQL.Database();
const adapter = new FlexTreeSqljsAdapter(db);

// 3. 像平常一样使用 FlexTreeManager
const tree = new FlexTreeManager("tree", { adapter });
await adapter.exec(`
    CREATE TABLE tree (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(60),
        treeId INTEGER,
        level INTEGER,
        leftValue INTEGER,
        rightValue INTEGER
    );
`);

await tree.write(async (t) => {
    await t.createRoot({ name: "root" });
    await t.addNodes([{ name: "A" }, { name: "B" }], { name: "root" });
});
```

适配器方言为 `sqlite`（sql.js 就是 wasm 版 SQLite），SQL 生成与 `flextree-sqlite-adapter` 一致。

## 持久化：onPersist 钩子

sql.js 是**纯内存数据库**，写入不会自动落盘。适配器提供 `onPersist` 钩子作为统一的持久化时机——**仅在含有写操作的事务成功 COMMIT 后**被 `await` 触发；ROLLBACK 与纯读事务不触发。何时导出（`db.export()`）、导出到哪，完全由调用方决定：

```ts
const adapter = new FlexTreeSqljsAdapter(db, {
    // 每次 write 提交后自动快照到 localStorage
    onPersist: (db) => {
        const data = db.export(); // Uint8Array
        localStorage.setItem("tree-snapshot", toBase64(data));
    },
});
```

常见持久化去向：

```ts
// IndexedDB（容量大，适合大树）
onPersist: async (db) => {
    await idbPut("flextree", "tree-snapshot", db.export());
},

// 下载为 .sqlite 文件
onPersist: (db) => {
    download(new Blob([db.export()]), "tree.sqlite");
},
```

恢复时把快照灌回新实例即可（通常在 initSqlJs 之后、建 manager 之前）：

```ts
const db = new SQL.Database(savedUint8Array); // 用快照重建内存库
```

### FlexTreeSqljsPersistError

`onPersist` 抛错时**事务已经 COMMIT**——内存态已更新，只是快照没写出去。错误会被包装为 `FlexTreeSqljsPersistError` 向上抛出，调用方据此区分两种失败：

| 失败类型 | 事务状态 | 恢复动作 |
| --- | --- | --- |
| `onPersist` 抛错（`FlexTreeSqljsPersistError`） | 已提交，内存态完好 | 重试快照（`db.export()`）即可，无需重做业务写 |
| `write` 回调抛错 | 已回滚 | 重试整个 `write` |

## 事务行为

- `transaction` 用显式 `BEGIN`/`COMMIT`/`ROLLBACK` 包裹回调，原子性与服务端 SQLite 一致。
- 嵌套调用复用外层事务（`write` 内多个操作共享一个事务）。
- 事务外的 `exec`（如启动时建表）不参与脏判定，不会触发 `onPersist`。

## 注意事项

- **多标签页**：sql.js 快照是整库覆盖式写入，多个浏览器标签页各自持有独立内存库，不会互相感知——多标签页共享一棵树需要自建同步（如 BroadcastChannel），或改用后端方案。
- **快照体积**：`db.export()` 导出整库。树很大且写频繁时，onPersist 内可做节流/防抖，或在合适的业务时机手动导出（不配 `onPersist`，自己在需要时调用 `db.export()`）。
- **wasm 加载**：`initSqlJs` 需要加载 `sql-wasm.wasm`，各打包器的 `locateFile` 配置不同，参考 [sql.js 官方文档](https://sql.js.org/)。
