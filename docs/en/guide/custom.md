# Customization

`FlexTree` lets you customize key fields and extend node fields.

## Key Fields

In `FlexTree`, by default every node has the five key fields `id`, `level`, `leftValue`, `rightValue`, and `name`. To store multiple trees in a single table, you additionally need the `treeId` field.


You can customize the key fields with the following approach:

```ts

const tree = new FlexTreeManager<{},
// Generic parameter: node extension fields
    {
        id:['pk',string],      // id field name and type
        treeId:['tree',number],
        name:string
    }
>('tree', {
    // Custom field names
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

- The above renames the `id` field to `pk`, `treeId` to `tree`, `name` to `title`, `leftValue` to `lft`, `rightValue` to `rgt`, and `level` to `lv`.
- The generic parameter re-declares the names and types of the key fields.
- The type of the `treeId` field can be `number` or `string`. When a tree's identifier is a string in your business domain (such as `"org"` or `"dept"`), you can declare it as `treeId:['tree',string]`.


## Extension Fields


In addition to the five key fields `id`, `level`, `leftValue`, `rightValue`, and `name`, you can declare other fields via the first generic parameter, for example:

```ts

const tree = new FlexTreeManager<{
    size:number
    color:string
    icon:string
},
// Generic parameter: node extension fields
    {
        id:['pk',string],      // id field name and type
        treeId:['tree',number],
        name:string
    }
>('tree', {
    // Custom field names
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
