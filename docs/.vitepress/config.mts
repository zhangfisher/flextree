import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    base: '/flextree/',
    title: 'FlexTree',
    description: 'A quick tree database access tool library based on Left Right Value Algorithm',
    locales: {
        // 默认语言：简体中文（挂根路径，URL 无前缀，保住现有外链与 SEO）
        root: {
            label: '简体中文',
            lang: 'zh-CN',
            themeConfig: {
                outline: {
                    label: '目录',
                    level: [2, 5],
                },
                // https://vitepress.dev/reference/default-theme-config
                nav: [
                    { text: '首页', link: '/' },
                    { text: '指南', link: '/guide' },
                    { text: '开源推荐', link: 'https://zhangfisher.github.io/repos/' }
                ],
                sidebar: [
                    { text: '关于', link: '/intro/about' },
                    { text: '快速入门', link: '/intro/get-started' },
                    { text: '工作原理', link: '/intro/principle' },
                    { text: '功能优势', link: '/intro/features' },
                    { text: '常见问题', link: '/intro/question' },
                    { text: '更新历史', link: '/intro/history' },
                    {
                        text: '指南',
                        items: [
                            { text: '创建树', link: '/guide/createtree' },
                            { text: '管理器', link: '/guide/manager' },
                            { text: '查询树', link: '/guide/query' },
                            {
                                text: '更新操作',
                                link: '/guide/write',
                                items: [
                                    { text: '添加节点', link: '/guide/add' },
                                    { text: '删除节点', link: '/guide/delete' },
                                    { text: '移动节点', link: '/guide/move' },
                                    { text: '更新节点', link: '/guide/update' }
                                ]
                            },
                            { text: '查找节点', link: '/guide/find' },
                            { text: '节点关系', link: '/guide/relation' },
                            { text: 'FlexTree', link: '/guide/flextree' },
                            { text: '校验', link: '/guide/verify' },
                            { text: '修复', link: '/guide/repair' },
                            { text: '导出', link: '/guide/export' },
                            { text: '自定义', link: '/guide/custom' },
                            { text: '多树表', link: '/guide/multitree' },
                            { text: '数据库适配', link: '/guide/adapters' },
                        ],
                    },
                    {
                        text: '适配器',
                        items: [
                            { text: 'Sqlite', link: '/adapters/sqlite' },
                            { text: 'Prisma', link: '/adapters/prisma' },
                            { text: 'Bun Sqlite', link: '/adapters/bun-sqlite' },
                        ],
                    },
                ],
            },
        },
        // English：挂 /en/ 路径，sidebar/nav 与中文 1:1 镜像（语言切换器不致 404）
        en: {
            label: 'English',
            lang: 'en-US',
            link: '/en/',
            themeConfig: {
                outline: {
                    label: 'On this page',
                    level: [2, 5],
                },
                nav: [
                    { text: 'Home', link: '/en/' },
                    { text: 'Guide', link: '/en/guide' },
                    { text: 'Open Source', link: 'https://zhangfisher.github.io/repos/' }
                ],
                sidebar: [
                    { text: 'About', link: '/en/intro/about' },
                    { text: 'Getting Started', link: '/en/intro/get-started' },
                    { text: 'How It Works', link: '/en/intro/principle' },
                    { text: 'Features', link: '/en/intro/features' },
                    { text: 'FAQ', link: '/en/intro/question' },
                    { text: 'Changelog', link: '/en/intro/history' },
                    {
                        text: 'Guide',
                        items: [
                            { text: 'Create Tree', link: '/en/guide/createtree' },
                            { text: 'Manager', link: '/en/guide/manager' },
                            { text: 'Query Tree', link: '/en/guide/query' },
                            {
                                text: 'Update Operations',
                                link: '/en/guide/write',
                                items: [
                                    { text: 'Add Node', link: '/en/guide/add' },
                                    { text: 'Delete Node', link: '/en/guide/delete' },
                                    { text: 'Move Node', link: '/en/guide/move' },
                                    { text: 'Update Node', link: '/en/guide/update' }
                                ]
                            },
                            { text: 'Find Node', link: '/en/guide/find' },
                            { text: 'Node Relations', link: '/en/guide/relation' },
                            { text: 'FlexTree', link: '/en/guide/flextree' },
                            { text: 'Verify', link: '/en/guide/verify' },
                            { text: 'Repair', link: '/en/guide/repair' },
                            { text: 'Export', link: '/en/guide/export' },
                            { text: 'Customization', link: '/en/guide/custom' },
                            { text: 'Multi-Tree Table', link: '/en/guide/multitree' },
                            { text: 'Database Adapters', link: '/en/guide/adapters' },
                        ],
                    },
                    {
                        text: 'Adapters',
                        items: [
                            { text: 'Sqlite', link: '/en/adapters/sqlite' },
                            { text: 'Prisma', link: '/en/adapters/prisma' },
                            { text: 'Bun Sqlite', link: '/en/adapters/bun-sqlite' },
                        ],
                    },
                ],
            },
        },
    },
    themeConfig: {
        // 公共配置（所有语言共享）
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
    markdown: {
        codeTransformers: [
            transformerTwoslash({
                // typesCache: createFileSystemTypesCache()
            })
        ],
        // Explicitly load these languages for types hightlighting
        //languages: ['js', 'jsx', 'ts', 'tsx']
    }
})
