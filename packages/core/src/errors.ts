export class FlexTreeError extends Error { }
export class FlexTreeNotExists extends FlexTreeError { }
export class FlexTreeVerifyError extends Error { }
export class FlexTreeInvalidError extends FlexTreeError { }
export class FlexTreeAbortError extends FlexTreeError { }

export class FlexTreeNotFoundError extends FlexTreeError { }
export class FlexTreeDriverError extends FlexTreeError { }
// 当树操作没有在update方法内更新时抛出
export class FlexTreeInvalidUpdateError extends FlexTreeError { }

// 节点
export class FlexTreeNodeError extends FlexTreeError { }
export class FlexTreeNodeNotFoundError extends FlexTreeNodeError { }
export class FlexTreeNodeInvalidOperationError extends FlexTreeNodeError { }
