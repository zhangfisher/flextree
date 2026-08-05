# Prisma Adapter

`Prisma` is a widely used database ORM tool in the `Nodejs` ecosystem that helps us interact with databases more easily.

`flextree` provides a `Prisma` adapter so that we can use `flextree` with `Prisma` more easily.

## Install

First install the `flextree-prisma-adapter` adapter.

```bash
npm install flextree-prisma-adapter
// or
yarn add flextree-prisma-adapter
// or
pnpm add flextree-prisma-adapter
```

## Usage

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
