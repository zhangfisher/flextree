---
"flextree": patch
"flextree-sqlite-adapter": patch
"flextree-prisma-adapter": patch
"flextree-bun-sqlite-adapter": patch
"flextree-sqljs-adapter": patch
---

[fix] 修复发布到 npm 的包入口指向 src/index.ts 源码的问题：发布流程现在会在 publish 前将 publishConfig 中的入口字段（main/module/types/exports）提升到 package.json 顶层，同时通过 files 字段收窄发布产物至 dist 目录
