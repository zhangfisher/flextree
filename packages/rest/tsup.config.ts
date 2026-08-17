import { defineConfig } from 'tsup'

export default defineConfig({
    // 主入口 + 各框架 routes 子路径入口（flextree-rest/hono 等按需引入）。
    // entry 用对象映射到 dist 根：源文件虽在 src/bindings/ 子目录，产物须平铺（package.json exports 指向 dist/hono.js 等）
    entry: {
        index: 'src/index.ts',
        hono: 'src/bindings/hono.ts',
        express: 'src/bindings/express.ts',
        elysia: 'src/bindings/elysia.ts',
        nextjs: 'src/bindings/nextjs.ts',
    },
    dts: true,
    clean: true,
    sourcemap: true,
    format: ['cjs', 'esm'],
    outDir: 'dist',
    minify: true,
})
