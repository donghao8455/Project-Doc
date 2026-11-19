import { defineConfig } from 'vitepress'
import nav from './nav'
import sidebar from './sidebar'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "DongHao's 个人在线文档库",
  description: "分享个人的开发学习文档",
  srcDir: "./docs/",
  // base: '/Project-Doc/',
  // Matrix 主题：强制深色，保证代码雨/CRT效果一致
  appearance: 'force-dark',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: '/logo.svg',
    search: {
      provider: 'local'
    },
    nav,
    sidebar,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/donghao8455' },
      { icon: 'gitee', link: 'https://gitee.com/donghao8455' },
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2021-present DongHao\'s'
    }
  }
})
