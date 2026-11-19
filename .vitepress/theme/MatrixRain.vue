<template>
  <div class="matrix-rain" aria-hidden="true">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const canvasEl = ref(null)
let ctx = null
let raf = 0
let width = 0
let height = 0
let columns = 0
let drops = []
let speeds = []
const timers = []

/* 经典字符池：片假名 + 数字 + 符号 */
const CHARS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン' +
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<>{}[]()/\\|=+*#@$%&'

const FONT_SIZE = 16
const FRAME_MS = 50 /* ~20fps，经典雨速 */

function initColumns() {
  columns = Math.floor(width / FONT_SIZE)
  drops = Array.from({ length: columns }, () => Math.random() * -60)
  speeds = Array.from({ length: columns }, () => Math.random() * 0.8 + 0.4)
}

function resize() {
  const canvas = canvasEl.value
  if (!canvas || !canvas.parentElement) return
  width = window.innerWidth
  height = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  /* 不透明墨绿黑底，雨丝在其上拖尾 */
  ctx.fillStyle = '#010402'
  ctx.fillRect(0, 0, width, height)
  initColumns()
}

function draw() {
  /* 半透明黑覆盖制造拖尾 */
  ctx.fillStyle = 'rgba(1, 4, 2, 0.09)'
  ctx.fillRect(0, 0, width, height)
  ctx.font = FONT_SIZE + 'px Consolas, monospace'

  for (let i = 0; i < columns; i++) {
    const char = CHARS[(Math.random() * CHARS.length) | 0]
    const x = i * FONT_SIZE
    const y = drops[i] * FONT_SIZE

    /* 雨头：随机闪白，其余荧光绿 */
    if (Math.random() > 0.976) {
      ctx.fillStyle = '#ccffcc'
      ctx.shadowColor = '#00ff41'
      ctx.shadowBlur = 8
    } else {
      ctx.fillStyle = '#00ff41'
      ctx.shadowBlur = 0
    }
    ctx.fillText(char, x, y)
    ctx.shadowBlur = 0

    if (y > height && Math.random() > 0.975) drops[i] = Math.random() * -20
    drops[i] += speeds[i]
  }
}

let last = 0
function loop(t) {
  raf = requestAnimationFrame(loop)
  if (t - last < FRAME_MS) return
  last = t
  draw()
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(loop)

  /* 标题打字机 + Features 卡片 3D 跟随 */
  setTimeout(() => {
    runTypewriter()
    initTilt()
  }, 120)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', resize)
  timers.forEach((t) => clearInterval(t))
})

/* ---------------- Hero 标题打字机 ---------------- */
function runTypewriter() {
  const el = document.querySelector('.VPHero .name .clip')
  if (!el || el.dataset.typed === '1') return
  const full = el.textContent || ''
  if (!full) return
  el.dataset.typed = '1'

  const rect = el.getBoundingClientRect()
  if (rect.width) el.style.minWidth = Math.ceil(rect.width) + 'px'

  el.textContent = ''
  el.classList.add('typing-cursor')
  let i = 0
  const timer = setInterval(() => {
    el.textContent = full.slice(0, ++i)
    if (i >= full.length) {
      clearInterval(timer)
      setTimeout(() => el.classList.remove('typing-cursor'), 1500)
    }
  }, 110)
  timers.push(timer)
}

/* ---------------- Features 卡片 3D 跟随 ---------------- */
function initTilt() {
  document.querySelectorAll('.VPFeature').forEach((card) => {
    if (card.dataset.tilt === '1') return
    card.dataset.tilt = '1'
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      card.style.transform = `perspective(900px) rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateY(-6px)`
    })
    card.addEventListener('mouseleave', () => {
      card.style.transform = ''
    })
  })
}
</script>
