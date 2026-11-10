import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import App from '@/App.vue'
import { routes } from '@/router'
import { useCountdown } from '@/core/timing/useCountdown'
import { appStorage } from '@/core/storage/persist'
import type { GameModule } from '@/games/types'
import { longNumber } from '@/games/long-number'
import { useSessionStore } from '@/stores/session'
import { useStatsStore } from '@/stores/stats'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mockGames = vi.hoisted(() => [] as GameModule[])
vi.mock('@/games/registry', () => ({
  games: mockGames,
  getGame: (id: string) => mockGames.find((g) => g.id === id),
}))

const EmitsRound = defineComponent({
  props: { settings: { type: Object, required: true } },
  emits: ['round-complete'],
  setup(_, { emit }) {
    return () =>
      h(
        'button',
        {
          class: 'finish',
          onClick: () =>
            emit('round-complete', {
              success: true,
              level: null,
              accuracy: 1,
              durationMs: 5,
              metrics: {},
            }),
        },
        'finish',
      )
  },
})

const LongTimer = defineComponent({
  props: { settings: { type: Object, required: true } },
  emits: ['round-complete'],
  setup(_, { emit }) {
    const cd = useCountdown()
    cd.start(60_000).then((outcome) => {
      if (outcome === 'done') {
        emit('round-complete', {
          success: true,
          level: null,
          accuracy: 1,
          durationMs: 5,
          metrics: {},
        })
      }
    })
    return () => h('p', 'memorizing')
  },
})

function fakeModule(id: string, component: unknown): GameModule {
  return {
    id,
    name: `Game ${id}`,
    tagline: 'A fake game',
    trains: 'nothing',
    defaultSettings: { n: 3 },
    settingsFields: [{ key: 'n', label: 'N', type: 'number', min: 1, max: 9 }],
    component: () => Promise.resolve(component as never),
    summarize: (rounds) => ({ headline: `played ${rounds.length}`, stats: [] }),
  }
}

async function mountAt(path: string): Promise<{ router: Router; w: ReturnType<typeof mount> }> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  const w = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  await vi.dynamicImportSettled() // let lazily-loaded game components finish loading
  await flushPromises()
  return { router, w }
}

describe('views', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
    mockGames.length = 0
  })
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('Home lists games with their headline and links to them', async () => {
    mockGames.push(fakeModule('fake', EmitsRound))
    const { w } = await mountAt('/')
    expect(w.text()).toContain('Game fake')
    expect(w.text()).toContain('played 0')
    expect(w.find('a[href$="/play/fake"]').exists()).toBe(true)
  })

  it('Home says when there are no games', async () => {
    const { w } = await mountAt('/')
    expect(w.text()).toContain('No games yet.')
  })

  it('unknown game ids redirect home', async () => {
    const { router } = await mountAt('/play/nope')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('GameView records a completed round', async () => {
    mockGames.push(fakeModule('fake', EmitsRound))
    const { w } = await mountAt('/play/fake')
    await w.find('button.finish').trigger('click')
    const rounds = useStatsStore().rounds
    expect(rounds).toHaveLength(1)
    expect(rounds[0]!.gameId).toBe('fake')
  })

  it('quitting mid-round cancels timers, records nothing and stops session time', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockGames.push(fakeModule('slow', LongTimer))
    const { router, w } = await mountAt('/play/slow')
    expect(w.text()).toContain('memorizing')
    expect(useSessionStore().isActive).toBe(true)
    await w.find('button.quit').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(useStatsStore().rounds).toHaveLength(0)
    expect(useSessionStore().isActive).toBe(false)
    expect(errors).not.toHaveBeenCalled()
    expect(warns).not.toHaveBeenCalled()
    errors.mockRestore()
    warns.mockRestore()
  })

  it('settings drawer saves sanitized settings', async () => {
    mockGames.push(fakeModule('fake', EmitsRound))
    const { w } = await mountAt('/play/fake')
    await w.find('button[aria-label="Game settings"]').trigger('click')
    const input = w.find('input[name="n"]')
    await input.setValue('99')
    await input.trigger('change')
    const { useSettingsStore } = await import('@/stores/settings')
    expect(useSettingsStore().gameSettings(mockGames[0]!)).toEqual({ n: 9 })
  })

  it("Esc during a real game's memorize phase skips instead of quitting", async () => {
    mockGames.push(longNumber)
    const { router, w } = await mountAt('/play/long-number')
    await w.find('button.start').trigger('click')
    expect(w.find('.number').exists()).toBe(true)
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/play/long-number')
    expect(w.find('.number').exists()).toBe(false)
    expect(w.text()).toContain('Get ready') // default settings have a 5 s wait before recall
  })

  it('Enter inside the settings drawer does not start a round', async () => {
    mockGames.push(longNumber)
    const { w } = await mountAt('/play/long-number')
    await w.find('button[aria-label="Game settings"]').trigger('click')
    const input = w.find('input[name="digitsPerGroup"]')
    ;(input.element as HTMLInputElement).focus()
    input.element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect(w.find('.number').exists()).toBe(false)
  })
})
