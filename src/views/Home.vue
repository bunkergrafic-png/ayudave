<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Icon from '../components/Icon.vue'
import RaffleCard from '../components/RaffleCard.vue'
import { session } from '../lib/session'
import { rafflesFor } from '../lib/raffles'
import { firstName } from '../lib/format'
import { toastError } from '../lib/ui'
import { VERSION_LABEL } from '../lib/version'

const router = useRouter()
const raffles = ref(null)
const tab = ref('active')
const canCreate = computed(() => ['owner', 'super'].includes(session.profile?.role))

onMounted(async () => {
  try {
    const list = await rafflesFor(session.profile)
    raffles.value = list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  } catch (e) { toastError(e); raffles.value = [] }
})
const shown = computed(() => (raffles.value || []).filter(r => tab.value === 'active' ? r.status !== 'drawn' : r.status === 'drawn'))
const hour = new Date().getHours()
const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
</script>

<template>
  <div class="container stack" style="--gap: 20px">
    <div class="row wrap between">
      <div>
        <p class="muted">{{ greet }}, {{ firstName(session.profile?.name) }} 👋</p>
        <h1>Tus rifas</h1>
      </div>
      <button v-if="canCreate" class="btn btn-gold" @click="router.push('/rifa/nueva')"><Icon name="plus" />Nueva rifa</button>
    </div>

    <div class="segmented">
      <button :class="{ on: tab === 'active' }" @click="tab = 'active'">Activas</button>
      <button :class="{ on: tab === 'done' }" @click="tab = 'done'">Sorteadas</button>
    </div>

    <div v-if="raffles === null" class="cards-grid">
      <div v-for="i in 3" :key="i" class="skeleton" style="height: 250px; border-radius: 20px" />
    </div>
    <div v-else-if="!shown.length" class="card empty">
      <div class="ico"><Icon name="ticket" /></div>
      <h3>{{ tab === 'active' ? 'Aún no hay rifas activas' : 'Todavía no hay rifas sorteadas' }}</h3>
      <p class="small" style="margin: 6px 0 16px">{{ canCreate ? 'Crea tu primera rifa en menos de 2 minutos.' : 'Cuando el organizador te asigne a una rifa, aparecerá aquí.' }}</p>
      <button v-if="canCreate && tab === 'active'" class="btn btn-primary" @click="router.push('/rifa/nueva')"><Icon name="plus" />Crear rifa</button>
    </div>
    <div v-else class="cards-grid">
      <RaffleCard v-for="r in shown" :key="r.id" :raffle="r" />
    </div>
    <p class="app-version">Rifalo {{ VERSION_LABEL }}</p>
  </div>
</template>

<style>
.cards-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
</style>
