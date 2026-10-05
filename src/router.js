import { createRouter, createWebHistory } from 'vue-router'
import { session, sessionReady } from './lib/session'

const routes = [
  { path: '/login', component: () => import('./views/Login.vue'), meta: { guest: true } },
  { path: '/', component: () => import('./views/Home.vue'), meta: { auth: true } },
  { path: '/rifa/nueva', component: () => import('./views/admin/RaffleEditor.vue'), meta: { auth: true, owner: true } },
  { path: '/rifa/:id', component: () => import('./views/RaffleView.vue'), meta: { auth: true } },
  { path: '/rifa/:id/editar', component: () => import('./views/admin/RaffleEditor.vue'), meta: { auth: true } },
  { path: '/equipo', component: () => import('./views/admin/Team.vue'), meta: { auth: true, owner: true } },
  { path: '/organizaciones', component: () => import('./views/admin/Orgs.vue'), meta: { auth: true, super: true } },
  { path: '/ayuda', component: () => import('./views/Help.vue'), meta: { auth: true } },
  { path: '/ajustes', component: () => import('./views/Settings.vue'), meta: { auth: true } },
  { path: '/r/:slug', component: () => import('./views/public/PublicRaffle.vue'), meta: { public: true } },
  { path: '/t/:rid/:token', component: () => import('./views/public/Verify.vue'), meta: { public: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || (to.path === from.path ? undefined : { top: 0 })
})

router.beforeEach(async to => {
  if (to.meta.public) return true
  await sessionReady
  const logged = !!session.profile && session.profile.active
  if (to.meta.guest) return logged ? '/' : true
  if (to.meta.auth && !logged) return { path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} }
  const role = session.profile?.role
  if (to.meta.super && role !== 'super') return '/'
  if (to.meta.owner && !['owner', 'super'].includes(role)) return '/'
  return true
})
