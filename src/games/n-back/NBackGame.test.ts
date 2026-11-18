import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import NBackGame from './NBackGame.vue'
import {
  DIGITS,
  N_BACK_DEFAULTS,
  POSITIONS,
  generateStream,
  isTarget,
  levelKey,
  trialsFor,
  type NBackSettings,
} from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []
let visibility: DocumentVisibilityState = 'visible'
const T = N_BACK_DEFAULTS.trialMs

function key(k: string) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  document.body.dispatchEvent(e)
  return e
}

describe('NBackGame', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'Date',
      ],
    })
  })
  afterEach(() => {
    for (const w of mounted.splice(0)) w.unmount()
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  function setup(settings: NBackSettings = N_BACK_DEFAULTS) {
    const mirror = createRng(1)
    const pos = settings.mode === 'digit' ? [] : generateStream(mirror, 2, trialsFor(2), POSITIONS)
    const dig = settings.mode === 'position' ? [] : generateStream(mirror, 2, trialsFor(2), DIGITS)
    const w = mount(NBackGame, { props: { settings, rng: createRng(1) }, attachTo: document.body })
    mounted.push(w)
    return { w, pos, dig }
  }

  /** Moves to `ms` into trial t (from the round start), letting frames run. */
  async function goTo(t: number, ms = 100) {
    const target = t * T + ms
    while (performance.now() - start < target) {
      vi.advanceTimersByTime(Math.min(250, target - (performance.now() - start)))
      await flushPromises()
    }
  }
  let start = 0

  async function begin(w: ReturnType<typeof setup>['w']) {
    await w.find('button.start').trigger('click')
    start = performance.now()
  }

  async function playAll(w: ReturnType<typeof setup>['w'], press: (t: number) => void) {
    for (let t = 0; t < trialsFor(2); t++) {
      await goTo(t)
      press(t)
      await flushPromises()
    }
    await goTo(trialsFor(2), 50)
  }

  it('a perfect position round', async () => {
    const { w, pos } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([2])
    await begin(w)
    await goTo(0)
    expect(w.findAll('.cell.lit')).toHaveLength(1)
    expect(w.findAll('.cell')[pos[0]!]!.classes()).toContain('lit')
    await goTo(0, 700)
    expect(w.findAll('.cell.lit')).toHaveLength(0)
    await playAll(w, (t) => {
      if (isTarget(pos, 2, t)) key(' ')
    })
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({
      success: true,
      level: 2,
      accuracy: 1,
      metrics: { n: 2, mode: 0, hits: 6, misses: 0, falseAlarms: 0 },
    })
  })

  it('never pressing scores 0 and drops N', async () => {
    const { w } = setup()
    await begin(w)
    await playAll(w, () => {})
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result.accuracy).toBe(0)
    expect(w.emitted('level')!.at(-1)).toEqual([1])
  })

  it('one press per trial; no presses in the first N trials', async () => {
    const { w, pos } = setup()
    await begin(w)
    await goTo(0)
    expect(w.find('button.match').attributes('disabled')).toBeDefined()
    key(' ')
    await playAll(w, (t) => {
      if (isTarget(pos, 2, t)) {
        key(' ')
        key('m')
      }
    })
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result.metrics).toMatchObject({ hits: 6, falseAlarms: 0 })
  })

  it('a hidden tab pauses the round', async () => {
    const { w } = setup()
    await begin(w)
    await goTo(0, 1000)
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(w.find('.trial').text()).toContain('1 /')
  })

  it('dual mode uses A and L and keeps its own level', async () => {
    useStatsStore().saveStaircase(levelKey('position'), {
      level: 5,
      streakRight: 0,
      streakWrong: 0,
    })
    const { w, pos, dig } = setup({ ...N_BACK_DEFAULTS, mode: 'dual' })
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([2])
    await begin(w)
    await playAll(w, (t) => {
      if (isTarget(pos, 2, t)) key('a')
      if (isTarget(dig, 2, t)) key('l')
    })
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({ success: true, accuracy: 1, metrics: { mode: 2, hits: 12 } })
    expect(useStatsStore().staircases[levelKey('position')]!.level).toBe(5)
  })

  it('feedback shows ✓ on a correct press', async () => {
    const { w, pos } = setup()
    await begin(w)
    const t = pos.findIndex((_, i) => isTarget(pos, 2, i))
    await goTo(t)
    key(' ')
    await flushPromises()
    expect(w.find('button.match').text()).toContain('✓')
  })

  it('Esc during the round is left to the shell (quit)', async () => {
    const { w } = setup()
    await begin(w)
    await goTo(1)
    expect(key('Escape').defaultPrevented).toBe(false)
  })

  it('switching mode on the ready screen shows the N of that mode', async () => {
    useStatsStore().saveStaircase(levelKey('position'), {
      level: 5,
      streakRight: 0,
      streakWrong: 0,
    })
    const { w } = setup()
    await flushPromises()
    expect(w.text()).toContain('N = 5')
    await w.setProps({ settings: { ...N_BACK_DEFAULTS, mode: 'dual' } })
    await flushPromises()
    expect(w.text()).toContain('N = 2')
    expect(w.emitted('level')!.at(-1)).toEqual([2])
  })

  it('feedback colours the button; the first N trials show a hint', async () => {
    const { w, pos } = setup()
    await begin(w)
    await goTo(0)
    expect(w.text()).toContain('Remember the first 2')
    const t = pos.findIndex((_, i) => isTarget(pos, 2, i))
    await goTo(t)
    expect(w.text()).not.toContain('Remember the first')
    key(' ')
    await flushPromises()
    expect(w.find('button.match').classes()).toContain('fb-ok')
    expect(w.find('.sr-feedback').text()).toBe('correct')
  })

  it('a middle-zone result says the streak was reset', async () => {
    const { w, pos } = setup()
    await begin(w)
    let pressed = 0
    await playAll(w, (t) => {
      if (isTarget(pos, 2, t) && pressed < 4) {
        key(' ')
        pressed++
      }
    })
    expect(w.text()).toContain('streak reset')
  })
})
