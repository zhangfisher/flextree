import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
    base: '/flextree/',
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
            { text: '开源推荐', link: 'https://zhangfisher.github.io/repos/'}
        ],

        sidebar: [
            { text: '关于', link: '/intro/about' },
            { text: '快速入门', link: '/intro/get-started' },
            { text: '工作原理', link: '/intro/principle' },
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
                        items:[
                            { text: '添加节点', link: '/guide/add' },                             
                            { text: '删除节点', link: '/guide/delete' },                           
                            { text: '移动节点', link: '/guide/move' },
                            { text: '更新节点', link: '/guide/update'}
                        ]
                    },                   
                    { text: '查找节点', link: '/guide/find' },
                    { text: '节点关系', link: '/guide/relation' },
                    { text: 'FlexTree', link: '/guide/flextree' },
                    { text: '校验', link: '/guide/verify' },
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
