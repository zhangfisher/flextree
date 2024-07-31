import {coverageConfigDefaults,defineConfig } from 'vitest/config'
 
export default defineConfig({
    test: {
        sequence: {
            concurrent: false,
        },
        includeTaskLocation: true, 
        coverage:{
            exclude:[
                "examples/**",
                "node_modules/.pnpm/sqlstring@2.3.3/node_modules/sqlstring/lib/SqlString.js",   
                ".pnpm/**",
                "docs/**",
                "packages/prisma/**",
                "packages/sqlite/**",
                "node_modules/**",
                "**/sqlstring/lib/SqlString.js",
                "packages/core/rsbuild.config.ts",
                "packages/tests",
                ...coverageConfigDefaults.exclude
            ]
        }
    } 
})
