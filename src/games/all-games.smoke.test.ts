import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { appStorage } from '@/core/storage/persist'
import { routes } from '@/router'
import { useSessionStore } from '@/stores/session'
import { games } from './registry'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

/**
 * Smoke test: every registered game loads through the real app (router +
 * GameView + GameShell), shows a Start button, renders its settings, starts
 * a round, and quits cleanly — with no console errors or warnings.
 */
describe.each(games.map((g) => [g.id, g] as const))('%s in the composed app', (_id, game) => {
  const mounted: { unmount(): void }[] = []
  let errors: ReturnType<typeof vi.spyOn>
  let warns: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
    errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    warns = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    for (const w of mounted.splice(0)) w.unmount()
    errors.mockRestore()
    warns.mockRestore()
    document.body.replaceChildren()
  })

  async function open() {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push(`/play/${game.id}`)
    await router.isReady()
    const w = mount(App, { global: { plugins: [router] }, attachTo: document.body })
    mounted.push(w)
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()
    return { w, router }
  }

  it('loads, shows its name and a Start button, and counts session time', async () => {
    const { w } = await open()
    expect(w.find('h1.title').text()).toBe(game.name)
    expect(w.find('button.start').exists()).toBe(true)
    expect(useSessionStore().isActive).toBe(true)
    expect(errors).not.toHaveBeenCalled()
    expect(warns).not.toHaveBeenCalled()
  })

  it('renders every setting in the drawer', async () => {
    const { w } = await open()
    await w.find('button[aria-label="Game settings"]').trigger('click')
    for (const f of game.settingsFields) expect(w.find(`[name="${f.key}"]`).exists()).toBe(true)
  })

  it('starts a round and quits without recording anything', async () => {
    const { w, router } = await open()
    await w.find('button.start').trigger('click')
    await flushPromises()
    expect(w.find('button.start').exists()).toBe(false)
    await w.find('button.quit').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('home')
    expect(useSessionStore().isActive).toBe(false)
    expect(errors).not.toHaveBeenCalled()
    expect(warns).not.toHaveBeenCalled()
  })
})
