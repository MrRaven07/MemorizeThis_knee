import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { appStorage } from '@/core/storage/persist'
import { routes } from '@/router'
import { useSessionStore } from '@/stores/session'
import { useStatsStore } from '@/stores/stats'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []

async function mountAt(path: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  const w = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  mounted.push(w)
  await flushPromises()
  await vi.dynamicImportSettled()
  await flushPromises()
  return { w, router }
}

const result = {
  success: true,
  level: 5,
  accuracy: 1,
  durationMs: 1000,
  metrics: { length: 5, correct: 5 },
}
const day = (d: number) => new Date(2026, 10, d, 12).getTime()

describe('stats views', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
  })
  afterEach(() => {
    for (const w of mounted.splice(0)) w.unmount()
    document.body.replaceChildren()
  })

  it('Home: End session appears with a session and opens its summary', async () => {
    const first = await mountAt('/')
    expect(first.w.find('button.end-session').exists()).toBe(false)
    first.w.unmount()
    mounted.splice(0)
    useStatsStore().recordRound('number-flash', result)
    useStatsStore().recordRound('number-flash', result)
    const id = useSessionStore().current!.id
    const { w, router } = await mountAt('/')
    await w.find('button.end-session').trigger('click')
    await flushPromises()
    await vi.dynamicImportSettled()
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(`/session/${id}`)
    expect(w.text()).toContain('Number Flash')
    expect(w.find('.summary-rounds').text()).toContain('2')
  })

  it('summary compares with the previous session', async () => {
    const prev = {
      id: 'p',
      startedAt: day(9),
      endedAt: day(9),
      activeMs: 60_000,
      rounds: 5,
      cards: 0,
      perGameMs: {},
      lastActivityAt: day(9),
    }
    const cur = {
      ...prev,
      id: 'c',
      startedAt: day(10),
      endedAt: day(10),
      activeMs: 13 * 60_000,
      rounds: 2,
    }
    appStorage.set('mt:sessions', JSON.stringify([prev, cur]))
    const { w } = await mountAt('/session/c')
    expect(w.text()).toContain('+12 min')
    expect(w.text()).toContain('−3 rounds')
    expect(w.text()).toContain('vs last time')
  })

  it('unknown session redirects to stats', async () => {
    const { router } = await mountAt('/session/nope')
    expect(router.currentRoute.value.name).toBe('stats')
  })

  it('empty stats page has no NaN', async () => {
    const { w } = await mountAt('/stats')
    expect(w.text()).toContain('No sessions yet')
    expect(w.text()).not.toMatch(/NaN|Infinity/)
  })

  it('trend line after two days; a hint with one day', async () => {
    const r = (d: number, level: number) => ({
      id: `${d}`,
      gameId: 'number-flash',
      at: day(d),
      sessionId: null,
      success: true,
      level,
      accuracy: 1,
      durationMs: 1,
      metrics: { length: level },
    })
    appStorage.set('mt:rounds', JSON.stringify([r(9, 4)]))
    let view = await mountAt('/stats')
    expect(view.w.text()).toContain('The trend appears after two days of play')
    view.w.unmount()
    mounted.splice(0)
    setActivePinia(createPinia())
    appStorage.set('mt:rounds', JSON.stringify([r(9, 4), r(10, 6)]))
    view = await mountAt('/stats')
    expect(view.w.find('svg[role="img"]').attributes('aria-label')).toContain('4 → 6')
  })

  it('recent sessions link to their summary', async () => {
    const s = {
      id: 's1',
      startedAt: day(9),
      endedAt: day(9),
      activeMs: 60_000,
      rounds: 1,
      cards: 0,
      perGameMs: {},
      lastActivityAt: day(9),
    }
    appStorage.set('mt:sessions', JSON.stringify([s]))
    const { w } = await mountAt('/stats')
    expect(w.find('a[href$="/session/s1"]').exists()).toBe(true)
  })

  it('summary shows flashcards for Major System, not rounds', async () => {
    const s = {
      id: 'm',
      startedAt: day(9),
      endedAt: day(9),
      activeMs: 300_000,
      rounds: 0,
      cards: 12,
      perGameMs: { major: 300_000 },
      lastActivityAt: day(9),
    }
    appStorage.set('mt:sessions', JSON.stringify([s]))
    const { w } = await mountAt('/session/m')
    const row = w.findAll('.game').find((r) => r.text().includes('Major System'))!
    expect(row.text()).toContain('12 cards')
    expect(row.text()).not.toContain('0 rounds')
  })

  it('a damaged saved session does not blank the stats page', async () => {
    const good = {
      id: 'g',
      startedAt: day(9),
      endedAt: day(9),
      activeMs: 60_000,
      rounds: 1,
      cards: 0,
      perGameMs: {},
      lastActivityAt: day(9),
    }
    const raw = JSON.stringify([good, null, { id: 'x' }])
    appStorage.set('mt:sessions', raw)
    const { w } = await mountAt('/stats')
    expect(w.text()).toContain('1:00')
    expect(w.text()).not.toMatch(/NaN|Infinity/)
    expect(appStorage.get('mt:sessions.corrupt')).toBe(raw)
  })
})
