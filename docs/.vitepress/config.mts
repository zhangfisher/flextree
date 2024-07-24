import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "FlexTree",
  description: "A quick tree database access tool library based on Left Right Value Algorithm",
  themeConfig: {    
    outline:{
      label:"目录",  
      level:[2,5]
    },
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide' },
      { text: 'API', link: '/api' }
    ],

    sidebar: [
      { text: '关于', link: '/guide/about' },
      { text: '安装', link: '/guide/install' },
      { text: '快速入门', link: '/guide/get-starts' }, 
      { 
        text: '指南',
        items:[
          { text: '管理器', link: '/guide/manager' },
          { text: '访问树', link: '/guide/get' },
          { text: '更新树', link: '/guide/update'},
          { text: '移动树', link: '/guide/move'},
          { text: '多树表', link: '/guide/multitree'},
          { text: '数据库驱动', link: '/guide/update'},          
        ]    
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/zhangfisher/flextree' }
    ]
  },
  vue:{
    template: {                      
      compilerOptions: {
        whitespace: 'preserve'
      }
    }
  }
})
