

```ts

import { FlexTree } from "flextree";


const tree = new FlexTree({....})


// 更新操作
tree.update(async ()=>{
    const node = tree.get({....})
    node.children.add({....})
    node.children.add({....})
    node.children.add({....})
    node.children.add({....})
    node.children.insert({...})
})

const node = tree.find({....})

node.update(async (node)={
    node.children.add({....})
    node.children.add({....})
    node
})



```