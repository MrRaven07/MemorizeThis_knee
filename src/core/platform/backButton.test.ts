import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { handleBack } from './backButton'

const Page = { render: () => h('p') }

function makeRouter() {
  window.history.replaceState(null, '', '/') // a fresh history entry per test
  return createRouter({
    history: createWebHashHistory(), // the app's real history (keeps `back` in state)
    routes: [
      { path: '/', name: 'home', component: Page },
      { path: '/stats', name: 'stats', component: Page },
      { path: '/settings', name: 'settings', component: Page },
    ],
  })
}

describe('Android back button', () => {
  it('exits the app on Home', async () => {
    const router = makeRouter()
    await router.push('/')
    const exitApp = vi.fn<() => void>()
    await handleBack(router, { exitApp })
    expect(exitApp).toHaveBeenCalledTimes(1)
  })

  it('goes back when there is history', async () => {
    const router = makeRouter()
    await router.push('/')
    await router.push('/stats')
    await router.push('/settings')
    await handleBack(router, { exitApp: vi.fn<() => void>() })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('stats'))
  })

  it('goes Home when the page was opened directly', async () => {
    const router = makeRouter()
    await router.push('/stats')
    await handleBack(router, { exitApp: vi.fn<() => void>() })
    expect(router.currentRoute.value.name).toBe('home')
  })
})
