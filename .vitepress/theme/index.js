import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import './custom.css'
import HomeComponent from '../home.vue'
import TechParticles from './TechParticles.vue'

export default {
  ...DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-before': () => h(TechParticles),
    })
  },
  enhanceApp({ app }) {
    // 注册全局组件
    app.component('HomeComponent', HomeComponent)
  },
}
