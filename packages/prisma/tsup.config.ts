import { defineConfig } from 'tsup'

export default defineConfig({
    entry: ['src/index.ts'],
    dts: true,
    clean: true,
    sourcemap: true,
    format: ['cjs', 'esm'],
    outDir: 'dist',
    minify: true,
    noExternal: [
        'flex-tools',
        'mitt',
        'ts-mixer',
        'sqlstring',
    ],

})
