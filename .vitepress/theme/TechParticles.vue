<template>
  <div class="tech-particles" aria-hidden="true">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'

const canvasEl = ref(null)
let ctx = null
let raf = 0
let particles = []
let width = 0
let height = 0

const COLOR = '34, 211, 238'
const COUNT = 70
const LINK_DIST = 140

function initParticles() {
  particles = Array.from({ length: COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    r: Math.random() * 1.8 + 0.6,
  }))
}

function resize() {
  const canvas = canvasEl.value
  if (!canvas) return
  const parent = canvas.parentElement
  if (!parent) return
  width = parent.clientWidth
  height = parent.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  initParticles()
}

function draw() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0 || p.x > width) p.vx *= -1
    if (p.y < 0 || p.y > height) p.vy *= -1

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${COLOR}, 0.8)`
    ctx.fill()

    for (let j = i + 1; j < particles.length; j++) {
      const q = particles[j]
      const dx = p.x - q.x
      const dy = p.y - q.y
      const dist = Math.hypot(dx, dy)
      if (dist < LINK_DIST) {
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(q.x, q.y)
        ctx.strokeStyle = `rgba(${COLOR}, ${0.18 * (1 - dist / LINK_DIST)})`
        ctx.lineWidth = 0.6
        ctx.stroke()
      }
    }
  }
  raf = requestAnimationFrame(draw)
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(draw)

  // Hero 标题打字机 + Features 卡片 3D 跟随
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
const timers = []

function runTypewriter() {
  const el = document.querySelector('.VPHero .name .clip')
  if (!el || el.dataset.typed === '1') return
  const full = el.textContent || ''
  if (!full) return
  el.dataset.typed = '1'

  // 预留原始宽度，避免逐字时布局抖动
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
