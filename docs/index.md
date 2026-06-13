---
layout: home

hero:
  name: "DongHao's Docs"
  text: |
    个人在线文档库
  tagline: 记录学习 · 分享知识 · 持续迭代 —— 覆盖前端、后端、AI大模型开发与面试全栈知识
  image:
    src: /logo.svg
    alt: 文档库 Logo
  actions:
    - theme: brand
      text: 🚀 AI大模型面试突击
      link: /E_AI大模型应用面试/01_面试突击方案
    - theme: alt
      text: 🤖 AI大模型开发指南
      link: /F_AI大模型开发/AI大模型开发
    - theme: brand
      text: ☕ Java面试宝典
      link: /E_Java面试宝典/基本概念
    - theme: alt
      text: 👤 个人简介
      link: /introduceMe
    - theme: alt
      text: 📝 笔记更新历程
      link: /笔记更新历程

features:
  - icon: 🤖
    title: AI大模型开发
    details: 从LLM基础到RAG、Agent、微调与部署，完整的AI应用开发知识体系。
    link: /F_AI大模型开发/AI大模型开发
    linkText: 进入学习 →
  - icon: 🎯
    title: 面试突击题库
    details: Java后端 / AI大模型两大方向的高频面试题，附详细解析与学习路线。
    link: /E_AI大模型应用面试/01_面试突击方案
    linkText: 查看题库 →
  - icon: 💻
    title: 前端技术栈
    details: Vue3、Pinia、Element Plus、TailwindCSS、CesiumJs 等前端框架与工具的实践笔记。
    link: /F_Vue3/基本概念
    linkText: 进入前端 →
  - icon: 🔧
    title: 后端技术栈
    details: Java / Spring / MyBatis / NestJs / Django，覆盖主流后端框架与数据交互方案。
    link: /B_Java/基本概念
    linkText: 进入后端 →
  - icon: 🗄️
    title: 数据库相关
    details: MySQL、PostgreSQL 的基础使用、性能优化与常见问题解决方案。
    link: /D_MySQL/基本概念
    linkText: 进入数据库 →
  - icon: 🛠️
    title: 开发工具与环境
    details: Git、Docker、VSCode、Vim、Linux 等工程化工具的使用技巧与最佳实践。
    link: /T_Git/基本概念
    linkText: 进入工具 →
  - icon: 📡
    title: 网络与通信
    details: 网络协议、Socket编程、MQTT、Protobuf 等通信协议与框架笔记。
    link: /W_网络相关概念/基本概念
    linkText: 进入网络 →
  - icon: 📚
    title: 经验与积累
    details: 真实项目踩坑记录、开发经验、架构设计思考，以及学习规划汇总。
    link: /E_开发积累-All/基本概念
    linkText: 查看经验 →
---

<HomeComponent />

<style>
@media (max-width: 768px) {
  .VPImage.image-src {
    display: none;
  }
  .VPHero .name {
    font-size: 36px !important;
  }
  .VPHero .text {
    font-size: 24px !important;
  }
  .VPHero .actions {
    justify-content: center;
  }
}
</style>
