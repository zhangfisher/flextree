# 查询树

当创建好`FlexTreeManager`对象实例后，我们就可以通过`FlexTreeManager`对象实例来查询树。

`FlexTree`提供支持了非常灵活多样的查询树的方式。
 
 
## 查询根节点

```ts
const root = await treeManager.getRoot()
```

## 查询所有节点集

`getNodes`方法用于获取树的所有节点集，支持限制返回的层级。

**方法签名：**

```ts
async getNodes(options?: { level?: number }): Promise<TreeNode[]> 
```

- **返回所有节点集**

```ts
const nodes = await treeManager.getNodes()
```
- **限制返回所有节点集的层级**

```ts
// 只返回第1-3层节点集
const nodes = await treeManager.getNodes(3)
```

**提示**

- `getNodes`方法返回的是有序的节点集。
- `getNodes`方法返回的是节点数组, 如:

<LiteTree>
Root
    A
    B
    C
</LiteTree>

`getNodes`返回的是:

```ts
[
    {id:1,left:1,right:8,level:1,name:"ROOT"},
    {id:2,left:2,right:3,level:2,name:"A"},
    {id:3,left:4,right:5,level:2,name:"B"},
    {id:4,left:6,right:7,level:2,name:"C"}
]
```



 

## 查询指定节点

## 查询后代节点集

## 查询子节点集

## 查询祖先节点集

## 查询父节点

## 查询兄弟节点集

## 查询下一兄弟节点

## 查询上一兄弟节点





