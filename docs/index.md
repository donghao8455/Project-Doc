---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "DongHao's"
  # text: "在线文档库"
  tagline: 记录学习，分享知识，个人在线项目文档库
  image:
    src: /logo.svg
    alt: 图片的提示信息
  actions:
    - theme: brand
      text: 个人简介
      link: /introduceMe.md
    - theme: alt
      text: 笔记更新历程
      link: /笔记更新历程.md
    - theme: brand
      text: Java面试
      link: /E_Java面试宝典/基本概念
    - theme: alt
      text: AI大模型开发
      link: /AI大模型开发.md
      
features:
  - title: 不断更新
    details: 持续迭代，创新不息：不断保持活力与创新，在变化中不断进步与完善！
  - title: 开源共享
    details: 开放代码，共享智慧：开源让世界自由创新，共同交流和进步！
  - title: 联系方式
    details: 邮箱：donghao8455@163.com <br>微信：donghao_517208455
---

<HomeComponent />

<style>
@media (max-width: 768px) {
  .VPImage.image-src {
    display: none;
  }
}
</style>