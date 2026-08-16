export type NonUndefined<T> = T extends undefined ? never : T;

export type FlexTreeKeyFieldNames = ["name", "leftValue", "rightValue", "level"];

// 节点相对位置
export enum FlexNodeRelPosition {
  LastChild = 0,
  FirstChild = 1,
  NextSibling = 2,
  PreviousSibling = 3,
}

export enum FlexTreeNodeRelation {
  Self = 0,
  Parent = 1,
  Child = 2,
  Siblings = 3,
  Descendants = 4,
  Ancestors = 5,
  DiffTree = 6,
  SameTree = 7,
  SameLevel = 8,
  Unknow = 9,
}

// 用来声明自定义的树关键字段
// export interface CustomTreeKeyFields {
//   id?: [string, string | number]
//   treeId?: [string, string | number]
//   name?: string
//   level?: string
//   leftValue?: string
//   rightValue?: string
// }

export type CustomTreeKeyFields = {
  id?: [string, string | number];
  treeId?: [string, string | number];
} & {
  [K in FlexTreeKeyFieldNames[number]]?: string;
};

export interface DefaultTreeKeyFields {
  id: ["id", number];
  treeId: ["treeId", number | string];
  name: "name";
  level: "level";
  leftValue: "leftValue";
  rightValue: "rightValue";
}
export interface DefaultTreeKeyNameFields {
  id: "id";
  treeId: "treeId";
  name: "name";
  level: "level";
  leftValue: "leftValue";
  rightValue: "rightValue";
}

export type PickKeyFieldType<
  KeyFields extends Record<string, string | [string, any]>,
  Name extends string,
  DefaultType = any,
> = KeyFields[Name] extends [infer K, infer V]
  ? K extends string
    ? { [P in K]: V }
    : { [P in Name]: DefaultType }
  : KeyFields[Name] extends string
    ? { [P in KeyFields[Name]]: DefaultType }
    : { [K in Name]: DefaultType };

export type IFlexTreeNodeFields<
  Fields extends Record<string, any> = Record<string, any>,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> = PickKeyFieldType<KeyFields, "id", number> &
  PickKeyFieldType<KeyFields, "treeId", number> &
  PickKeyFieldType<KeyFields, "name", string> &
  PickKeyFieldType<KeyFields, "level", number> &
  PickKeyFieldType<KeyFields, "leftValue", number> &
  PickKeyFieldType<KeyFields, "rightValue", number> &
  Fields;

export type RemoveKeyFields<
  T extends Record<string, any>,
  KeyFields extends CustomTreeKeyFields,
> = {
  [K in keyof T]: K extends KeyFields[keyof KeyFields] ? never : T[K];
};

export type FlexTreeEvents = {
  "write:before": undefined; // 当执行写操作前触发
  // 当执行写操作后触发（提交或回滚均触发）；committed=true 表示事务已成功提交，false 表示已回滚
  "write:after": { committed: boolean } | undefined;
  // 事务 COMMIT 前触发：聚合本次 write 收集到的全部 SQL（只读通知，监听器异常不回滚；空批不触发）
  "write:commit": { tree: any; sqls: string[] };
  "node:added": { tree: any; nodes: any[]; at: any; pos: FlexNodeRelPosition }; // 增加节点
  "node:deleted": { tree: any; node: any; recycled?: boolean }; // 删除节点；recycled=true 表示经回收站逻辑删除（站外→站内跃迁）
  "node:recycled": { tree: any; node: any }; // 节点被移入回收站（deleteNode recycle 专用）
  "node:cleared": { tree: any }; // 清空节点
  "node:updated": { tree: any; node: any }; // 清空节点
  "node:moved": {
    tree: any; // 移动发起时的源树
    toTree: any; // 落点所在树（同树移动时 === tree）
    from: any;
    to: any;
    pos: FlexNodeRelPosition;
  }; // 移动节点
};

// 两种导出格式, nested: 层级嵌套结构,使用children表示子节点集; pid: 使用pid表示父节点id
export interface FlexTreeExportJsonOptions<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  Children extends string = "children",
> {
  childrenField?: Children;
  level?: number; // 限定导出的级别
  fields?: (keyof IFlexTreeNodeFields<Fields, KeyFields>)[];
  includeKeyFields?: boolean;
  countField?: string; // 指定后在每条节点数据上附加该字段，值为后代节点数量（可见口径，不受 level 截断影响）
}

export type FlexTreeExportJsonFormat<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  Children extends string = "children",
> = TreeNode & {
  [K in Children]?: FlexTreeExportJsonFormat<Fields, KeyFields, TreeNode, NodeId, Children>[];
} & { count?: number };

// 嵌套节点输入类型，支持递归结构
// 注意：children字段仅用于输入格式，不会插入数据库
export type FlexTreeNodeInput<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  Children extends string = "children",
> = Partial<IFlexTreeNodeFields<Fields, KeyFields>> & {
  [K in Children]?: FlexTreeNodeInput<Fields, KeyFields, Children>[];
};

export interface FlexTreeExportListOptions<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
> {
  pidField?: string;
  level?: number; // 限定导出的级别
  fields?: (keyof IFlexTreeNodeFields<Fields, KeyFields>)[];
  includeKeyFields?: boolean;
  countField?: string; // 指定后在每条节点数据上附加该字段，值为后代节点数量（可见口径，不受 level 截断影响）
}

export type FlexTreeExportListFormat<
  Fields extends Record<string, any> = object,
  KeyFields extends CustomTreeKeyFields = DefaultTreeKeyFields,
  TreeNode extends IFlexTreeNodeFields<Fields, KeyFields> = IFlexTreeNodeFields<Fields, KeyFields>,
  NodeId = NonUndefined<KeyFields["id"]>[1],
  OPTIONS extends FlexTreeExportListOptions<Fields, KeyFields> = FlexTreeExportListOptions<
    Fields,
    KeyFields
  >,
> = ((OPTIONS["fields"] extends string[]
  ? Extract<TreeNode, OPTIONS["fields"][number]>
  : TreeNode) & { [P in OPTIONS["pidField"] & string]: NodeId } & { count?: number })[];

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

 