import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import './custom.css'
import HomeComponent from '../home.vue';
import MatrixRain from './MatrixRain.vue'

export default {
  ...DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-before': () => h(MatrixRain),
    })
  },
  enhanceApp({ app }) {
    // 注册全局组件
    app.component('HomeComponent', HomeComponent);
  },
}
