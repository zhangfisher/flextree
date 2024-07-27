import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: 'FlexTree',
    description: 'A quick tree database access tool library based on Left Right Value Algorithm',
    themeConfig: {
        outline: {
            label: '目录',
            level: [2, 5],
        },
        // https://vitepress.dev/reference/default-theme-config
        nav: [
            { text: '首页', link: '/' },
            { text: '指南', link: '/guide' },
            { text: 'API', link: '/api' },
        ],

        sidebar: [
            { text: '关于', link: '/intro/about' },
            { text: '快速入门', link: '/intro/get-starts' },
            { text: '工作原理', link: '/intro/principle' },
            { text: '常见问题', link: '/intro/question' },
            { text: '更新历史', link: '/intro/history' },
            {
                text: '指南',
                items: [
                    { text: '管理器', link: '/guide/manager' },
                    { text: '查询树', link: '/guide/query' },
                    { text: '更新树', link: '/guide/update' },
                    { text: '移动树', link: '/guide/move' },
                    { text: '节点关系', link: '/guide/relation' },
                    { text: '校验', link: '/guide/verify' },
                    { text: '多树表', link: '/guide/multitree' },
                    { text: '校验', link: '/guide/verify' },
                    { text: '导入导出', link: '/guide/import_export' },
                    { text: '数据库', link: '/guide/adapters' },
                ],
            },
            {
                text: '数据库适配',
                items: [
                    { text: 'Sqlite', link: '/adapters/sqlite' },
                    { text: 'Prisma', link: '/adapters/prisma' },
                ],
            },
        ],

        socialLinks: [
            { icon: 'github', link: 'https://github.com/zhangfisher/flextree' },
        ],
    },
    vue: {
        template: {
            compilerOptions: {
                whitespace: 'preserve',
            },
        },
    },
})
