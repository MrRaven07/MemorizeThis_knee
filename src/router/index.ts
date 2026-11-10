import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { getGame } from '@/games/registry'
import HomeView from '@/views/HomeView.vue'
import { useDecksStore } from '@/stores/decks'

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
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

// Hash history works from any base path, including a Capacitor WebView later.
const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
