<script setup>
defineProps({ public: Boolean, stats: Object })
</script>
<template>
  <div class="legend">
    <template v-if="public">
      <span><i class="lg free" /> Disponible <b v-if="stats">{{ stats.free }}</b></span>
      <span><i class="lg off" /> Ocupado <b v-if="stats">{{ stats.size - stats.free }}</b></span>
      <span><i class="lg sel" /> Tu selección</span>
    </template>
    <template v-else>
      <span><i class="lg free" /> Libre <b v-if="stats">{{ stats.free }}</b></span>
      <span><i class="lg r" /> Apartado <b v-if="stats">{{ stats.r }}</b></span>
      <span><i class="lg v" /> Por pagar <b v-if="stats">{{ stats.v }}</b></span>
      <span><i class="lg p" /> Pagado <b v-if="stats">{{ stats.p }}</b></span>
    </template>
  </div>
</template>
<style>
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: .78rem; color: var(--text-2); font-weight: 600; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend b { color: var(--text); }
.lg { width: 14px; height: 14px; border-radius: 5px; border: 1.5px solid; display: inline-block; }
.lg.free { background: var(--n-free); border-color: var(--n-free-line); }
.lg.r { background: var(--n-r); border-color: var(--n-r-line); }
.lg.v { background: var(--n-v); border-color: var(--n-v-line); }
.lg.p { background: var(--n-p); border-color: var(--n-p); }
.lg.off { background: var(--surface-2); border-color: var(--line); }
.lg.sel { background: var(--gold-400); border-color: var(--gold-500); }
</style>
