# core 零 node: 依赖，浏览器原生可运行

core（flextree）此前通过 `node:buffer`（escaper 二进制值转义）与 `node:async_hooks`（write 读写守卫的调用链判定）绑定 Node 运行时，浏览器消费者必须在构建器里配 alias 替换这两个模块才能运行（见 sqljs example 的历史 stub）。为让浏览器场景零配置使用 core，决定 core 源码彻底移除 `node:` 前缀导入：Buffer 品牌检查与转换统一收敛到 `instanceof Uint8Array` 分支（Buffer 是其子类，Node 调用方零破坏），十六进制编码改为手写查表循环；`AsyncLocalStorage` 换为 core 内置的模块级标志位实现（`_isWriting` 已保证 write 串行，语义等价）。

## Considered Options

- **双产物 + package.json browser 条件映射**：Node 语义零损失，但 tsup 双构建、两份产物同步维护，复杂度不成比例。
- **标志位 + 可选注入 ALS**：把上下文机制塞进 adapter 契约违反其单一职责。

## Consequences

- 公开类型面：`SqlValue` 的 `Buffer` 成员与 `Escaper.bufferToString` 签名统一改为 `Uint8Array`（Buffer 结构上可赋值，非破坏性）。
- 语义损失（已接受）：异步适配器（Prisma）下「write 未 await 时外部并发读同一 manager」不再等待事务完成，可能读到中间态。同步适配器（sqlite/sqljs）本就无交错，不受影响。未来有真实并发诉求再加注入接口。
