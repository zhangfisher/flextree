import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import { defineConfig } from "vitepress";
import { vitepressDemoPlugin } from "vitepress-demo-plugin";
import react from "@vitejs/plugin-react";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  base: "/flextree/",
  title: "FlexTree",
  description: "A quick tree database access tool library based on Left Right Value Algorithm",
  locales: {
    // 默认语言：简体中文（挂根路径，URL 无前缀，保住现有外链与 SEO）
    root: {
      label: "简体中文",
      lang: "zh-CN",
      themeConfig: {
        outline: {
          label: "目录",
          level: [2, 5],
        },
        // https://vitepress.dev/reference/default-theme-config
        nav: [
          { text: "首页", link: "/" },
          { text: "指南", link: "/intro/about" },
          { text: "开源推荐", link: "https://zhangfisher.github.io/repos/" },
        ],
        sidebar: [
          {
            text: "开始",
            items: [
              { text: "关于", link: "/intro/about" },
              { text: "快速入门", link: "/intro/get-started" },
              { text: "工作原理", link: "/intro/principle" },
              { text: "功能优势", link: "/intro/features" },
              { text: "读写成本", link: "/intro/cost" },
              { text: "Skill", link: "/intro/skill" },
              { text: "常见问题", link: "/intro/question" },
              { text: "更新历史", link: "/intro/history" },
              { text: "完整示例", link: "/intro/example" },
            ],
          },
          {
            text: "指南",
            items: [
              { text: "创建树", link: "/guide/createtree" },
              { text: "管理器", link: "/guide/manager" },
              { text: "查询树", link: "/guide/query" },
              {
                text: "更新操作",
                link: "/guide/write",
                items: [
                  { text: "添加节点", link: "/guide/add" },
                  { text: "删除节点", link: "/guide/delete" },
                  { text: "移动节点", link: "/guide/move" },
                  { text: "更新节点", link: "/guide/update" },
                  { text: "复制节点", link: "/guide/copy" },
                ],
              },
              { text: "查找节点", link: "/guide/find" },
              { text: "节点关系", link: "/guide/relation" },
              { text: "FlexTree", link: "/guide/flextree" },
              { text: "校验", link: "/guide/verify" },
              { text: "修复", link: "/guide/repair" },
              { text: "导出", link: "/guide/export" },
              { text: "自定义", link: "/guide/custom" },
              { text: "多树表", link: "/guide/multitree" },
              { text: "多根树", link: "/guide/multiroot" },
              { text: "多根内存树", link: "/guide/multiroottree" },
              { text: "回收站", link: "/guide/recyclebin" },
              { text: "数据库适配", link: "/guide/adapters" },
            ],
          },
          {
            text: "适配器",
            items: [
              { text: "Sqlite", link: "/adapters/sqlite" },
              { text: "Prisma", link: "/adapters/prisma" },
              { text: "Bun Sqlite", link: "/adapters/bun-sqlite" },
              { text: "Sql.js", link: "/adapters/sqljs" },
            ],
          },
          {
            text: "Restful API",
            items: [
              { text: "安装", link: "/guide/rest" },
              {
                text: "快速入门",
                link: "/guide/rest-getting-started",
              },
              { text: "API", link: "/guide/rest-api" },
              { text: "OpenAPI", link: "/guide/rest-openapi" },
              {
                text: "集成",
                items: [
                  { text: "Express", link: "/guide/rest-integrations#express" },
                  { text: "Next.js", link: "/guide/rest-integrations#nextjs" },
                  { text: "Hono", link: "/guide/rest-integrations#hono" },
                  { text: "Elysia", link: "/guide/rest-integrations#elysia" },
                ],
              },
            ],
          },
        ],
      },
    },
    // English：挂 /en/ 路径，sidebar/nav 与中文 1:1 镜像（语言切换器不致 404）
    en: {
      label: "English",
      lang: "en-US",
      link: "/en/",
      themeConfig: {
        outline: {
          label: "On this page",
          level: [2, 5],
        },
        nav: [
          { text: "Home", link: "/en/" },
          { text: "Guide", link: "/en/guide" },
          { text: "Open Source", link: "https://zhangfisher.github.io/repos/" },
        ],
        sidebar: [
          { text: "About", link: "/en/intro/about" },
          { text: "Getting Started", link: "/en/intro/get-started" },
          { text: "How It Works", link: "/en/intro/principle" },
          { text: "Features", link: "/en/intro/features" },
          { text: "Read/Write Costs", link: "/en/intro/cost" },
          { text: "FAQ", link: "/en/intro/question" },
          { text: "Changelog", link: "/en/intro/history" },
          { text: "Example", link: "/en/intro/example" },
          {
            text: "Guide",
            items: [
              { text: "Create Tree", link: "/en/guide/createtree" },
              { text: "Manager", link: "/en/guide/manager" },
              { text: "Query Tree", link: "/en/guide/query" },
              {
                text: "Update Operations",
                link: "/en/guide/write",
                items: [
                  { text: "Add Node", link: "/en/guide/add" },
                  { text: "Delete Node", link: "/en/guide/delete" },
                  { text: "Move Node", link: "/en/guide/move" },
                  { text: "Update Node", link: "/en/guide/update" },
                  { text: "Copy Node", link: "/en/guide/copy" },
                ],
              },
              { text: "Find Node", link: "/en/guide/find" },
              { text: "Node Relations", link: "/en/guide/relation" },
              { text: "FlexTree", link: "/en/guide/flextree" },
              { text: "Verify", link: "/en/guide/verify" },
              { text: "Repair", link: "/en/guide/repair" },
              { text: "Export", link: "/en/guide/export" },
              { text: "Customization", link: "/en/guide/custom" },
              { text: "Multi-Tree Table", link: "/en/guide/multitree" },
              { text: "Multi-Root Tree", link: "/en/guide/multiroot" },
              { text: "Multi-Root Memory Tree", link: "/en/guide/multiroottree" },
              { text: "Recycle Bin", link: "/en/guide/recyclebin" },
              { text: "Database Adapters", link: "/en/guide/adapters" },
            ],
          },
          {
            text: "Adapters",
            items: [
              { text: "Sqlite", link: "/en/adapters/sqlite" },
              { text: "Prisma", link: "/en/adapters/prisma" },
              { text: "Bun Sqlite", link: "/en/adapters/bun-sqlite" },
              { text: "Sql.js", link: "/en/adapters/sqljs" },
            ],
          },
          {
            text: "Restful API",
            items: [
              { text: "Install", link: "/en/guide/rest" },
              { text: "Getting Started", link: "/en/guide/rest-getting-started" },
              { text: "API", link: "/en/guide/rest-api" },
              { text: "OpenAPI", link: "/en/guide/rest-openapi" },
              {
                text: "Integrations",
                items: [
                  { text: "Express", link: "/en/guide/rest-integrations#express" },
                  { text: "Next.js", link: "/en/guide/rest-integrations#nextjs" },
                  { text: "Hono", link: "/en/guide/rest-integrations#hono" },
                  { text: "Elysia", link: "/en/guide/rest-integrations#elysia" },
                ],
              },
            ],
          },
        ],
      },
    },
  },
  themeConfig: {
    // 公共配置（所有语言共享）
    socialLinks: [{ icon: "github", link: "https://github.com/zhangfisher/flextree" }],
  },
  vue: {
    template: {
      compilerOptions: {
        whitespace: "preserve",
      },
    },
  },
  // 示例页 React demo（vitepress-demo-plugin）需要 JSX 编译支持；
  // jsxRuntime=automatic：demo 源码没有 import React，须用自动运行时注入 jsx 工厂
  vite: {
    plugins: [
      react({
        include: [/\.vitepress\/demos\/.*\.tsx?$/],
        jsxRuntime: "automatic",
      }),
    ],
  },
  markdown: {
    config(md) {
      // <demo react="../.vitepress/demos/xxx.tsx" /> 组件预览（示例页）
      md.use(vitepressDemoPlugin);
    },
    codeTransformers: [
      transformerTwoslash({
        // typesCache: createFileSystemTypesCache()
      }),
    ],
    // Explicitly load these languages for types hightlighting
    //languages: ['js', 'jsx', 'ts', 'tsx']
  },
});
