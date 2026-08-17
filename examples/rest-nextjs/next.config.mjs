/** flextree-rest nextjs example：workspace 直引源码（含装饰器语法），需 transpile */
export default {
    transpilePackages: ["flextree", "flextree-rest", "flextree-bun-sqlite-adapter"],
    experimental: {
        serverComponentsExternalPackages: ["better-sqlite3"],
    },
};
