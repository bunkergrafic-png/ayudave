<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import Sheet from '../components/Sheet.vue'
import ArticleView from '../components/ArticleView.vue'
import { session } from '../lib/session'
import { CATEGORIES, ARTICLES, FAQS, GLOSSARY, searchHelp, articleById } from '../lib/help'

const route = useRoute()
const router = useRouter()
const q = ref(String(route.query.q || ''))
const tab = ref('guias')
const openFaq = ref(-1)
const isAdmin = computed(() => ['super', 'owner'].includes(session.profile?.role))

const article = computed({
  get: () => (articleById(String(route.query.a || '')) ? String(route.query.a) : ''),
  set: id => router.replace({ query: { ...route.query, a: id || undefined } })
})
watch(q, v => router.replace({ query: { ...route.query, q: v || undefined } }))

const results = computed(() => searchHelp(q.value, 15))
const POPULAR = ['Vender un número', 'Registrar un abono', 'Pago móvil', '¿Quién tiene un número?', 'Apartados de la página', 'Efectivo por entregar']
const byCat = computed(() => CATEGORIES.map(c => ({ ...c, items: ARTICLES.filter(a => a.cat === c.id && (isAdmin.value || !a.admin)) })).filter(c => c.items.length))
const letters = computed(() => {
  const g = {}
  for (const t of GLOSSARY) (g[t.term[0].toUpperCase()] ||= []).push(t)
  return Object.entries(g).sort(([a], [b]) => a.localeCompare(b))
})
const TYPE = { article: ['Guía', 'b-brand'], faq: ['Pregunta', 'b-gold'], term: ['Glosario', 'b-info'] }
function openResult(r) {
  if (r.type === 'article') article.value = r.id
  else if (r.ref.link) article.value = r.ref.link
}
</script>

<template>
  <div class="container help stack" style="--gap: 18px">
    <section class="help-hero">
      <h1>¿En qué te ayudo?</h1>
      <p>Escribe tu duda con tus palabras: “me pagaron la mitad”, “cómo aparto”, “olvidé mi clave”…</p>
      <div class="input-group help-search">
        <span class="prefix"><Icon name="search" :size="20" /></span>
        <input v-model="q" class="input" placeholder="Buscar en la ayuda" aria-label="Buscar en la ayuda" autofocus />
      </div>
      <div v-if="!q" class="row wrap" style="--gap: 6px">
        <button v-for="p in POPULAR" :key="p" class="chip" @click="q = p">{{ p }}</button>
      </div>
    </section>

    <!-- Resultados -->
    <section v-if="q.trim()" class="stack" style="--gap: 8px">
      <p v-if="!results.length" class="card empty">No encontré nada con “{{ q }}”. Prueba con otras palabras, por ejemplo “pago”, “apartar” o “clave”.</p>
      <button v-for="r in results" :key="r.type + r.id" class="card help-result" @click="openResult(r)">
        <span class="badge plain" :class="TYPE[r.type][1]">{{ TYPE[r.type][0] }}</span>
        <div class="grow" style="min-width: 0">
          <b>{{ r.title }}</b>
          <p class="small muted">{{ r.type === 'article' ? r.ref.summary : r.type === 'faq' ? r.ref.a : r.ref.def }}</p>
        </div>
        <Icon v-if="r.type === 'article' || r.ref.link" name="chevronRight" :size="18" class="faint" />
      </button>
    </section>

    <template v-else>
      <div class="segmented">
        <button :class="{ on: tab === 'guias' }" @click="tab = 'guias'">Guías paso a paso</button>
        <button :class="{ on: tab === 'faq' }" @click="tab = 'faq'">Preguntas frecuentes</button>
        <button :class="{ on: tab === 'glosario' }" @click="tab = 'glosario'">Glosario</button>
      </div>

      <div v-if="tab === 'guias'" class="help-cats">
        <section v-for="c in byCat" :key="c.id" class="card">
          <div class="row" style="--gap: 10px; margin-bottom: 10px"><span class="cat-ico"><Icon :name="c.icon" :size="18" /></span><h3>{{ c.label }}</h3></div>
          <button v-for="a in c.items" :key="a.id" class="guide-link" @click="article = a.id">
            <span class="grow">{{ a.title }}</span><Icon name="chevronRight" :size="16" />
          </button>
        </section>
      </div>

      <div v-else-if="tab === 'faq'" class="card pad-0">
        <div v-for="(f, i) in FAQS" :key="i" class="faq" :class="{ open: openFaq === i }">
          <button class="faq-q" @click="openFaq = openFaq === i ? -1 : i"><span class="grow">{{ f.q }}</span><Icon name="chevronDown" :size="18" /></button>
          <div v-if="openFaq === i" class="faq-a">
            <p>{{ f.a }}</p>
            <button v-if="f.link" class="link-btn" @click="article = f.link">Ver paso a paso →</button>
          </div>
        </div>
      </div>

      <div v-else class="stack" style="--gap: 12px">
        <section v-for="[l, terms] in letters" :key="l" class="card">
          <div class="gl-letter">{{ l }}</div>
          <div v-for="t in terms" :key="t.term" class="gl-row">
            <b>{{ t.term }}</b>
            <p class="small muted">{{ t.def }} <button v-if="t.link" class="link-btn small" @click="article = t.link">Ver guía</button></p>
          </div>
        </section>
      </div>
    </template>

    <Sheet :open="!!article" :title="articleById(article)?.title || ''" @close="article = ''">
      <ArticleView :id="article" @go="article = $event" />
      <template #footer><button class="btn btn-primary" @click="article = ''">Entendido</button></template>
    </Sheet>
  </div>
</template>

<style>
.help { max-width: 900px; }
.help-hero { border-radius: 24px; padding: 26px 22px; color: #fff; display: flex; flex-direction: column; gap: 12px;
  background: radial-gradient(500px 240px at 0% 0%, #7C3AED, transparent), linear-gradient(150deg, #4C1D95, #1E0A47); box-shadow: var(--shadow); }
.help-hero p { opacity: .85; }
.help-search .input { height: 54px; font-size: 1.05rem; border: 0; }
.help-search .prefix { color: var(--brand-600); }
.chip { border: 1px solid rgba(255, 255, 255, .25); background: rgba(255, 255, 255, .12); color: #fff; padding: 6px 12px; border-radius: 99px; font-weight: 600; font-size: .82rem; cursor: pointer; }
.chip:hover { background: rgba(255, 255, 255, .22); }
.help-result { display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer; padding: 14px 16px; }
.help-result:hover { border-color: var(--brand-400); }
.help-cats { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.cat-ico { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; background: var(--brand-100); color: var(--brand-600); }
.guide-link { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 4px; border: 0; border-top: 1px solid var(--line); background: none; text-align: left; font-weight: 600; cursor: pointer; color: var(--text); }
.guide-link:hover { color: var(--brand-600); }
.faq { border-bottom: 1px solid var(--line); }
.faq:last-child { border-bottom: 0; }
.faq-q { display: flex; align-items: center; gap: 10px; width: 100%; padding: 16px; border: 0; background: none; text-align: left; font-weight: 700; cursor: pointer; color: var(--text); }
.faq.open .faq-q svg { transform: rotate(180deg); }
.faq-a { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 8px; color: var(--text-2); }
.gl-letter { font-family: var(--font-display); font-weight: 800; font-size: 1.4rem; color: var(--brand-600); margin-bottom: 6px; }
.gl-row { padding: 8px 0; border-top: 1px solid var(--line); }
</style>
