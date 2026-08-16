# sqljs 适配器采用注入实例构造契约（不负责 initSqlJs 异步初始化）

sql.js 的初始化是异步的（`initSqlJs` 需先加载 wasm 才能拿到 `Database`），而适配器构造函数是同步的。我们决定适配器只接受已初始化的 `Database` 实例（与 flextree-sqlite-adapter 一致），wasm 加载（`locateFile` 等 bundler 强相关的细节）由调用方完成。

## Considered Options

- **适配器内部 open() 时 await initSqlJs()**（bun-sqlite 模式）：被否决。`locateFile` 的正确写法因 bundler 而异（Vite `?url`、webpack file-loader、CDN 路径各不相同），适配器一旦接手初始化就被迫处理这些环境细节，职责越界且无法在所有环境下正确默认。

## Consequences

- 适配器保持纯同步构造、零环境假设，可在 Node（单测）与浏览器（示例）中以相同方式使用。
- 示例代码需展示完整的初始化样板（initSqlJs + locateFile + new Database），这是注入模式的代价，由 examples/sqljs 承担。
