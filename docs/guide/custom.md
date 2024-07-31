# 自定义

`FlexTree`允许自定义关键字段和扩展节点字段。

## 关键字段

`FlexTree`中，默认情况下，每一个节点均具`id`、`level`、`leftValue`、`rightValue`、`name`这五个关键字段，如果要在一个表中存储多棵树，还需要加上`treeId`字段。


可以通过以下方法自定义关键字段,方法如下：

```ts

const tree = new FlexTreeManager<{},
// 泛型参数：节点扩展字段
    {
        id:['pk',string],      // id字段名称和类型
        treeId:['tree',number],
        name:string
    }
>('tree', {
    // 自定义字段名称
    fields:{
        id:'pk',
        treeId:'tree',
        name:'title',
        leftValue:'lft',
        rightValue:"rgt",
        level:'lv'
    }
})

```

- 以上将`id`字段改为`pk`，`treeId`字段改为`tree`，`name`字段改为`title`，`leftValue`字段改为`lft`，`rightValue`字段改为`rgt`，`level`字段改为`lv`。
- 通过泛型参数重新声明关键字段的名称和类型。


## 扩展字段


除了`id`、`level`、`leftValue`、`rightValue`、`name`这五个关键字段，还可以通过第一个泛型参数声明其他字段，比如：

```ts

const tree = new FlexTreeManager<{
    size:number
    color:string
    icon:string
},
// 泛型参数：节点扩展字段
    {
        id:['pk',string],      // id字段名称和类型
        treeId:['tree',number],
        name:string
    }
>('tree', {
    // 自定义字段名称
    fields:{
        id:'pk',
        treeId:'tree',
        name:'title',
        leftValue:'lft',
        rightValue:"rgt",
        level:'lv'
    }
})

```