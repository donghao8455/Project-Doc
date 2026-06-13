<template>
    <div class="ui-home">
        <h2 class="ui-title">🚀 个人开源项目</h2>
        <p class="ui-subtitle">
            纯前端的静态项目都已经部署在 GitHub Pages 上，可以点击在线体验查看效果
        </p>
        <div class="ui-project">
            <a
                v-for="data in siteData"
                :key="data.name"
                class="ui-card"
                :href="data.link"
                target="_blank"
                rel="noopener"
            >
                <div class="card-header" :class="data.className">
                    <span class="card-icon">{{ data.icon }}</span>
                    <h3 class="card-title">{{ data.name }}</h3>
                </div>
                <p class="card-desc">{{ data.desc }}</p>
                <div class="card-footer">
                    <a
                        v-if="data.online"
                        class="btn btn-primary"
                        :href="data.online"
                        target="_blank"
                        rel="noopener"
                        @click.stop
                    >
                        🌐 在线体验
                    </a>
                    <div class="btn-group">
                        <a
                            class="btn btn-ghost"
                            :href="data.github"
                            target="_blank"
                            rel="noopener"
                            @click.stop
                        >
                            <img :src="github" class="btn-icon" />
                            GitHub
                        </a>
                        <a
                            class="btn btn-ghost"
                            :href="data.gitee"
                            target="_blank"
                            rel="noopener"
                            @click.stop
                        >
                            <img :src="gitee" class="btn-icon" />
                            Gitee
                        </a>
                    </div>
                </div>
            </a>
        </div>
    </div>
</template>

<script setup>
import { siteData } from './siteData'
import github from '../images/github.svg'
import gitee from '../images/gitee.svg'
</script>

<style>
/* ============ 颜色类（使用 CSS 变量，兼容明暗模式） ============ */
.color-pink {
    background: linear-gradient(135deg, #70c5d3 0%, #5aa8b5 100%);
}

.color-red {
    background: linear-gradient(135deg, #b91d47 0%, #8e1535 100%);
}

.color-blue-deep {
    background: linear-gradient(135deg, #3360a3 0%, #244578 100%);
}

.color-blue {
    background: linear-gradient(135deg, #2db7f5 0%, #1d93c9 100%);
}

.color-ai {
    background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
}

/* ============ 主容器 ============ */
.ui-home {
    width: 100%;
    max-width: 1200px;
    margin: 20px auto;
    padding: 40px 20px;
    color: var(--vp-c-text-1);
    font-family: var(--vp-font-family-base);
}

.ui-home .ui-title {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 0 12px 0;
    font-size: 32px;
    font-weight: 700;
    color: var(--vp-c-text-1);
}

.ui-home .ui-subtitle {
    text-align: center;
    font-size: 15px;
    color: var(--vp-c-text-2);
    margin: 0 0 32px 0;
    line-height: 1.6;
}

/* ============ 项目卡片网格 ============ */
.ui-project {
    display: grid;
    gap: 24px;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.ui-card {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    background: var(--vp-c-bg-soft);
    border: 1px solid var(--vp-c-divider);
    border-radius: 12px;
    overflow: hidden;
    transition: transform 0.25s ease, box-shadow 0.25s ease,
        border-color 0.25s ease;
}

.ui-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
    border-color: var(--vp-c-brand-1);
}

/* 卡片头部 */
.card-header {
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: #fff;
}

.card-icon {
    font-size: 36px;
    line-height: 1;
}

.card-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    text-align: center;
}

/* 描述文本 */
.card-desc {
    flex: 1;
    margin: 20px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--vp-c-text-2);
}

/* 底部操作区 */
.card-footer {
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-top: 1px solid var(--vp-c-divider);
}

/* 按钮通用样式 */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    font-size: 14px;
    border-radius: 6px;
    text-decoration: none;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    cursor: pointer;
}

.btn-icon {
    width: 16px;
    height: 16px;
}

.btn-primary {
    background: var(--vp-c-brand-1);
    color: #fff;
    font-weight: 500;
}

.btn-primary:hover {
    background: var(--vp-c-brand-2);
    color: #fff;
}

.btn-ghost {
    background: transparent;
    color: var(--vp-c-text-2);
    border-color: var(--vp-c-divider);
}

.btn-ghost:hover {
    background: var(--vp-c-bg-alt);
    color: var(--vp-c-text-1);
    border-color: var(--vp-c-divider);
}

.btn-group {
    display: flex;
    gap: 8px;
    justify-content: center;
}

/* ============ 移动端适配 ============ */
@media (max-width: 768px) {
    .ui-home {
        padding: 20px 12px;
    }

    .ui-home .ui-title {
        font-size: 24px;
    }

    .ui-home .ui-subtitle {
        font-size: 13px;
    }

    .ui-project {
        grid-template-columns: 1fr;
        gap: 16px;
    }

    .btn-group {
        flex-direction: column;
    }

    .btn-group .btn {
        width: 100%;
    }
}
</style>
