# REST 层写队列：每请求一事务，树内写请求串行

`FlexTreeManager.write()` 遇并发直接抛 `FlexTreeInvalidUpdateError`（不排队），而 HTTP 服务天然面对并发写。我们决定 provider 为每棵注册树维护 per-manager promise 链写队列：每个 HTTP 写请求自动包成一个 `manager.write()`（请求内多操作原子、失败整体回滚），写请求在该树上**排队串行执行**，后到者等先到者提交后基于最新状态执行。对客户端完全透明。

串行化后，`FlexTreeInvalidUpdateError` 只可能来自 provider 内部 bug，统一映射 500（不再是对外语义）。

## Considered Options

- **不排队，并发写返回 409/425 让客户端重试**：被否决。"别人正在写所以我失败"对 API 消费者不可理喻，重试风暴是真实成本；promise 链实现约 15 行。
- **全局单队列**：被否决。不同树（不同表/不同 treeId）之间无共享资源，串行化粒度应为 per-manager。

## Consequences

- 单棵大树上的高频写吞吐受限于串行队列——这是 Nested Set Model 重建构操作的固有代价，文档需明示；读操作不受影响（manager 的 `_guardRead` 已自带等待机制）。
- 每请求一事务意味着客户端无法在一个 HTTP 请求里编排跨树原子写——v1 明确不支持，需要时宿主直接在服务端调用 manager。
