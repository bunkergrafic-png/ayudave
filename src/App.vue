<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from './components/AppShell.vue'
import Overlays from './components/Overlays.vue'
import { session } from './lib/session'

const route = useRoute()
const router = useRouter()
const bare = computed(() => route.meta.public || route.meta.guest)

// Si se cierra la sesión (o se desactiva el acceso) estando dentro, volver al inicio de sesión.
watch(() => [session.ready, session.profile?.active, session.user], () => {
  if (!session.ready || !route.meta.auth) return
  if (!session.user || (session.profile && !session.profile.active)) router.replace('/login')
})
</script>

<template>
  <RouterView v-if="bare" />
  <AppShell v-else>
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in"><component :is="Component" :key="$route.path" /></Transition>
    </RouterView>
  </AppShell>
  <Overlays />
</template>
