# Prisma适配器

`Prisma`是一个在`Nodejs`下被广泛使用的数据库ORM工具，它可以帮助我们更容易地与数据库交互。

`flextree`提供了`Prisma`的适配器，可以帮助我们更容易地在`Prisma`中使用`flextree`。

## 安装

首先安装`flextree-prisma-adapter`适配器。

```bash
npm install flextree-prisma-adapter
// or
yarn add flextree-prisma-adapter
// or
pnpm add flextree-prisma-adapter
```

## 使用

```ts
import PrismaAdapter from 'flextree-prisma-adapter'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const adapter = new PrismaAdapter(prisma)

const tree = new FlexTree('tree', {
    adapter: adapter,
})

const tree = new FlexTreeManager('tree', {
    adapter: adapter,
})


```






