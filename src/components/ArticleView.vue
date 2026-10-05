<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import { articleById, rich } from '../lib/help'
const props = defineProps({ id: String })
const emit = defineEmits(['go'])
const a = computed(() => articleById(props.id))
const related = computed(() => (a.value?.related || []).map(articleById).filter(Boolean))
</script>

<template>
  <div v-if="a" class="article stack" style="--gap: 16px">
    <p class="muted">{{ a.summary }}</p>
    <span v-if="a.admin" class="badge b-brand plain" style="align-self: flex-start"><Icon name="shield" :size="13" />Solo administradores</span>
    <ol class="steps-list">
      <li v-for="(s, i) in a.steps" :key="i"><span class="step-n">{{ i + 1 }}</span><span v-html="rich(s)" /></li>
    </ol>
    <div v-for="(t, i) in a.tips || []" :key="'t' + i" class="tip"><Icon name="sparkles" :size="16" /><span v-html="rich(t)" /></div>
    <div v-if="related.length" class="stack" style="--gap: 6px">
      <span class="section-label">También te puede servir</span>
      <button v-for="r in related" :key="r.id" class="rel-link" @click="emit('go', r.id)"><Icon name="arrowRight" :size="15" />{{ r.title }}</button>
    </div>
  </div>
</template>

<style>
.steps-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.steps-list li { display: flex; gap: 12px; align-items: flex-start; line-height: 1.55; }
.step-n { width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center; flex: none; font-weight: 800; font-size: .85rem; background: linear-gradient(135deg, var(--brand-500), var(--brand-800)); color: #fff; }
.ui-btn { display: inline-flex; align-items: center; padding: 1px 9px; border-radius: 8px; font-weight: 700; font-size: .84em; background: var(--brand-100); color: var(--brand-700); border: 1px solid var(--line-strong); white-space: nowrap; }
.tip { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 14px; background: var(--gold-100); font-size: .9rem; }
.tip svg { color: var(--gold-600); flex: none; margin-top: 2px; }
.rel-link { display: flex; align-items: center; gap: 8px; border: 0; background: none; padding: 6px 0; color: var(--brand-600); font-weight: 700; cursor: pointer; text-align: left; }
</style>
