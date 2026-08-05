# FlexTree 文档翻译规范与术语表

本文件是中文→英文文档翻译的统一基准，供翻译执行与人工校对使用。
英文文件统一输出到 `docs/en/` 下与中文**完全镜像**的路径。

---

## 1. 翻译总则

**翻译（中→英）：**
- 正文段落、标题、列表项、表格单元格中的中文叙述
- 代码块内的**注释**（`//`、`/* */`、`#`）
- VitePress 容器（`:::tip` / `:::warning` / `:::info`）内的中文正文
- frontmatter 中描述性文案（如 home 页 `hero` / `features` 的值）

**保持原样（绝不翻译）：**
- 所有 API 标识符：类名、方法名、字段名、类型名、枚举值
  例：`FlexTreeManager`、`addNodes`、`leftValue`、`FlexNodeRelPosition.LastChild`、`IFlexTreeAdapter`
- 代码块内的**示例字符串字面量**（如 `'根节点'`、`"ROOT"`、`"company-a"`）
- SQL 语句、表名、列名、Prisma `model` 定义
- 代码语法、变量名、类型注解、泛型参数

---

## 2. VitePress / Markdown 语法保留

以下必须**原样保留**，不得改动：
- 代码围栏及语言标注：` ```ts `、` ```ts {3,4} `、` ```sql `、` ```prisma `
- 行高亮标记：`// [!code ++]`、`// [!code focus]`、`// [!code warning]`
- 容器语法：`:::tip 标题` … `:::`（**标题词可译**，但 `:::` 与类型关键字保留）
- 自定义组件：`<LiteTree>…</LiteTree>` 及其内部缩进树文本（节点名 `root` / `A` / `A-1` 等不译）
- frontmatter 边界 `---` 与键名（`layout` / `hero` / `features` 等），仅译值中的中文文案
- 图片引用 `![](./lr.png)`、链接 URL 部分

---

## 3. 链接处理规则

- **相对链接**（`./xxx`、`../intro/about`、`./createtree.md`）：**原样保留**。
  英文文件位于 `en/` 下镜像路径，相对链接自动指向 `en/` 内同级文件。
- **站内绝对链接**（`/guide/xxx`、`/intro/about`、`/adapters/sqlite`）：**加 `/en` 前缀** → `/en/guide/xxx`。
- **外链**（`https://…`、`http://…`）：原样保留。
- 链接的**显示文本**中的中文需翻译。

---

## 4. 术语对照表

### 算法与模型
| 中文 | English |
|---|---|
| 左右值算法 | Left-Right Value algorithm |
| 左右值 | left/right values |
| 嵌套树模型 / 嵌套集合模型 | Nested Set Model |
| 邻接列表（结构） | Adjacency List |
| 路径枚举（结构） | Path Enumeration |
| 闭包表（结构） | Closure Table |
| 深度优先遍历 | Depth-First Search (DFS) |
| 广度优先遍历 | Breadth-First Search (BFS) |
| 递归查询 | recursive query |
| 查询优先 | read-optimized / query-first |

### 节点与关系
| 中文 | English |
|---|---|
| 树 | tree |
| 节点 | node |
| 根节点 | root node |
| 子节点 | child node |
| 父节点 | parent node |
| 后代节点 | descendants |
| 祖先节点 | ancestors |
| 兄弟节点 | siblings |
| 子树 | subtree |
| 层级 | level |
| 叶子节点 | leaf node |

### 字段（标识符保持英文，概念译）
| 中文概念 | English 表述 |
|---|---|
| 左值 / 右值 | left value / right value（字段名 `leftValue` / `rightValue` 不变） |
| 树ID | tree id（字段名 `treeId` 不变） |
| 关键字段 | key fields |
| 扩展字段 | custom fields |
| 主键 | primary key (pk) |
| 父节点引用 | parent id (pid) |

### 操作（API 名保持英文，描述译）
| 中文 | English 描述 |
|---|---|
| 创建根节点 | create root node |
| 添加节点 | add nodes |
| 删除节点 | delete node |
| 移动节点 | move node |
| 更新节点 | update node |
| 查找节点 | find node(s) |
| 校验 | verify |
| 修复 | repair |
| 遍历 | traverse |
| 导出 | export |
| 清空（树） | clear |

### 相对位置（`FlexNodeRelPosition` 枚举值保持英文）
| 中文 | English |
|---|---|
| 最后子节点 | last child |
| 第一个子节点 | first child |
| 上一个兄弟 | previous sibling |
| 下一个兄弟 | next sibling |
| 上移 / 下移 | move up / move down |

### 架构与通用
| 中文 | English |
|---|---|
| 管理器 | manager |
| 适配器 | adapter |
| 单例（模式） | singleton |
| 事务 | transaction |
| 并发 | concurrency |
| 回滚 | rollback |
| 单表多树 | multiple trees in a single table |
| 泛型 | generics |
| 类型提示 | type hints |
| 懒加载 | lazy loading |
| 内存树 | in-memory tree |
| 默认 | default |
| 参数 | parameter |
| 可选 | optional |
| 必填 | required |
| 示例 | example |
| 说明 | note |

---

## 5. 风格

- 语气：简洁的技术文档英语，主动语态为主，现在时。
- 中英文混排时保留空格（如 `FlexTree` 两侧）。
- 不添加原文没有的内容，不删减原文含义。
- 保留原文的 emoji（如 🎯 ⚡ ✨）。
