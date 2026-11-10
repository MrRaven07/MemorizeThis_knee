import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history works from any base path, including a Capacitor WebView later.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [],
})

export default router
