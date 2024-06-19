import { FlexNode } from './node';



export class FlexTreeError extends Error{}

export class FlexNodeError extends FlexTreeError{}

export class FlexNodeNotFound extends FlexNodeError{}

export class FlexNodeInvalidOperation extends  FlexNodeError{}