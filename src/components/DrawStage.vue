<script setup>
// Animación del sorteo: rodillos de dígitos que se detienen uno a uno en el número ganador.
import { ref, onBeforeUnmount } from 'vue'
const props = defineProps({ digits: { type: Number, default: 3 } })
const reels = ref(Array(props.digits).fill(0))
const stopped = ref(Array(props.digits).fill(false))
const spinning = ref(false)
let timer = null

function start() {
  spinning.value = true
  stopped.value = Array(props.digits).fill(false)
  clearInterval(timer)
  timer = setInterval(() => {
    reels.value = reels.value.map((v, i) => stopped.value[i] ? v : Math.floor(Math.random() * 10))
  }, 60)
}
async function land(number) {
  const s = String(number).padStart(props.digits, '0').split('').map(Number)
  for (let i = 0; i < props.digits; i++) {
    await new Promise(r => setTimeout(r, 650 + i * 250))
    reels.value[i] = s[i]
    stopped.value[i] = true
  }
  clearInterval(timer)
  spinning.value = false
}
onBeforeUnmount(() => clearInterval(timer))
defineExpose({ start, land })
</script>

<template>
  <div class="stage" :class="{ spinning }">
    <div v-for="(d, i) in reels" :key="i" class="reel" :class="{ stop: stopped[i] }">{{ d }}</div>
  </div>
</template>

<style>
.stage { display: flex; justify-content: center; gap: 10px; padding: 24px 12px; }
.reel { width: 74px; height: 104px; border-radius: 18px; display: grid; place-items: center; font-family: var(--font-display); font-weight: 800; font-size: 3.6rem; color: #2A1A00;
  background: linear-gradient(180deg, #FDE68A, #F5A50B); box-shadow: inset 0 -6px 0 rgba(0, 0, 0, .12), 0 14px 30px -12px rgba(245, 165, 11, .8); }
.spinning .reel:not(.stop) { animation: jiggle .12s linear infinite; filter: blur(1px); }
.reel.stop { animation: pop .35s ease; }
@keyframes jiggle { 0% { transform: translateY(-3px) } 50% { transform: translateY(3px) } 100% { transform: translateY(-3px) } }
@media (max-width: 420px) { .reel { width: 56px; height: 82px; font-size: 2.7rem; border-radius: 14px; } }
</style>
