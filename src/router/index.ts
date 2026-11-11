import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { getGame } from '@/games/registry'
import HomeView from '@/views/HomeView.vue'
import { useDecksStore } from '@/stores/decks'
import { useSessionStore } from '@/stores/session'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView },
  {
    path: '/play/:gameId',
    name: 'play',
    component: () => import('@/views/GameView.vue'),
    props: true,
    beforeEnter: (to) => (getGame(String(to.params.gameId)) ? true : { name: 'home' }),
  },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  { path: '/major', name: 'major', component: () => import('@/views/MajorView.vue') },
  {
    path: '/major/:deckId',
    name: 'deck',
    component: () => import('@/views/DeckView.vue'),
    props: true,
    beforeEnter: (to) =>
      useDecksStore().getDeck(String(to.params.deckId)) ? true : { name: 'major' },
  },
  {
    path: '/major/:deckId/study',
    name: 'study',
    component: () => import('@/views/StudyView.vue'),
    props: (route) => ({
      deckId: String(route.params.deckId),
      mode: route.query.mode === 'shuffle' ? 'shuffle' : 'smart',
      dir: route.query.dir === 'reverse' ? 'reverse' : 'forward',
    }),
    beforeEnter: (to) =>
      useDecksStore().getDeck(String(to.params.deckId)) ? true : { name: 'major' },
  },
  { path: '/stats', name: 'stats', component: () => import('@/views/StatsView.vue') },
  {
    path: '/session/:id',
    name: 'session',
    component: () => import('@/views/SessionSummaryView.vue'),
    props: true,
    beforeEnter: (to) =>
      useSessionStore().sessions.some((s) => s.id === String(to.params.id))
        ? true
        : { name: 'stats' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

// Hash history works from any base path, including a Capacitor WebView later.
const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
