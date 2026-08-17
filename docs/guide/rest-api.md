# API

路径以 `/{tree}` 开头（注册名）。query 参数 camelCase，与库方法选项一一对应；**不支持或不属于该端点的参数一律 400**（严格模式）。

## 树级

| Method | Path | 说明 |
|---|---|---|
| GET | `/` | 注册树列表 `{trees:[{name, multiRoot, recyclebinEnabled}]}` |
| GET | `/{tree}` | 树信息 + 导出，`?format=json\|list`（默认 json）、`?includeRecyclebin` |
| DELETE | `/{tree}` | 清空整树（不可逆） |
| POST | `/{tree}/verify` | 校验，返回 `200 {valid, errors[]}`（校验失败也是 200） |
| POST | `/{tree}/repair` | 修复 |

## 节点

| Method | Path | Query / Body |
|---|---|---|
| GET | `/{tree}/nodes` | `level`（精确层级，`?level=0`≡根列表）· `fields` · `countField` · `includeRecyclebin` + where 平铺等值（白名单字段） |
| POST | `/{tree}/nodes` | body `{nodes, at?, pos?, includeRecyclebin?}` → **201 + Location**（`at` 缺省=顶层添加） |
| GET | `/{tree}/nodes/{id}` | `includeChildren`（+1 级）/ `includeDescendants`（全子树）互斥；`format=json\|list` 仅展开时有效 |
| PATCH | `/{tree}/nodes/{id}` | body 节点字段（非关键字段） |
| DELETE | `/{tree}/nodes/{id}` | `recycle=true\|false` · `includeRecyclebin`（允许删除站内节点） |

`pos` 取值：`lastChild`（默认）/ `firstChild` / `nextSibling` / `previousSibling`。

URL 中的 `{id}`：纯数字无前导零按 number 匹配（`"0"` 是 number，`"007"` 是 string）；注册时可用 `idType` 固定类型。

## 节点关系

前缀 `/{tree}/nodes/{id}`，全部支持 `countField` + `includeRecyclebin`：

| Path 后缀 | 额外参数 | 返回 |
|---|---|---|
| `/children` | `includeDescendants` | 节点数组 |
| `/children/{n}` | n 为 1-based 整数，负数从尾数 | 节点 |
| `/descendants` | `level` · `includeSelf` · `includeDescendants` | 节点数组 |
| `/descendants/count` | `level` | `{count}` |
| `/ancestors` | `includeSelf` | 节点数组 |
| `/ancestors/count` | | `{count}` |
| `/parent` | | 节点 |
| `/siblings` | `includeSelf` | 节点数组 |
| `/nextsibling` · `/previoussibling` | | 节点或 `null` |

> `fields` 字段裁剪仅 `GET /{tree}/nodes` 支持（库方法签名限制），关系端点传 `fields` → 400。

## 节点动作

| Method | Path 后缀 | Body / Query |
|---|---|---|
| POST | `/move` | `{to?, pos?, treeId?, includeRecyclebin?}`；恢复=带 `includeRecyclebin:true`；跨树迁出新根= `to` 缺省 + `treeId` |
| POST | `/copy` | `{includeDescendants?, to?, pos?, treeId?, fields?}` → 201 + 副本根 |
| POST | `/moveup` · `/movedown` | |
| GET | `/canmoveto` | query `to` · `pos` → `{allowed}` |

## 回收站

| Method | Path | 说明 |
|---|---|---|
| GET | `/{tree}/recyclebin` | 被回收节点列表 |
| DELETE | `/{tree}/recyclebin` | 永久清空 |

树未启用回收站 → `409 RECYCLEBIN_NOT_ENABLED`。**恢复** = `POST .../move` + `includeRecyclebin:true`（把站内节点移出）。

## 错误格式

错误统一为 RFC 9457 `application/problem+json`：

```json
{
    "type": "about:blank",
    "title": "Node not found",
    "status": 404,
    "detail": "Node not found",
    "code": "NODE_NOT_FOUND"
}
```

| code | HTTP | 场景 |
|---|---|---|
| `UNKNOWN_PARAM` / `INVALID_POS` / `INVALID_BODY` / `VALIDATION_FAILED` / `FIELD_NOT_ALLOWED` | 400 | 严格模式校验、validate hook |
| `TREE_NOT_FOUND` / `NODE_NOT_FOUND` / `ROUTE_NOT_FOUND` | 404 | 未注册树 / 节点不存在或逻辑不可见 / 路径不存在 |
| `METHOD_NOT_ALLOWED` | 405 | 路径存在但方法错 |
| `RECYCLEBIN_NOT_ENABLED` | 409 | 树未配置回收站 |
| `NODE_INVALID_OPERATION` | 422 | 无效移动等 |
| `DRIVER_ERROR` | 503 | 数据库断连 |
| `VERIFY_FAILED` / `FLEXTREE_ERROR` / `INTERNAL_ERROR` | 500 | 其他库错误 / 未知 |

自定义映射：`new FlexTreeApiService({ onError: (err) => ({ ... }) })`，返回 problem 对象覆盖默认，返回 `undefined` 走默认。

## v1 边界

无分页（用 `level` / where 缩小范围）、无 OpenAPI 生成、无事件透传（SSE/Webhook）、DELETE 不暴露 `detach`。写请求在单棵树上串行——大树高频写吞吐受限于串行队列（Nested Set Model 的固有代价，读不受影响）。
