import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng, randomDigits } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import NumberFlashGame from './NumberFlashGame.vue'
import {
  NUMBER_FLASH_DEFAULTS,
  NUMBER_FLASH_ID,
  numberFlashStaircase,
  type NumberFlashSettings,
} from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const cfg = numberFlashStaircase(NUMBER_FLASH_DEFAULTS)
const mounted: { unmount(): void }[] = []

function press(key: string, init: KeyboardEventInit = {}) {
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  )
}

describe('NumberFlashGame', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
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
    // unmount so earlier games' document key listeners can't react in later tests
    for (const w of mounted.splice(0)) {
      try {
        w.unmount()
      } catch {
        // already unmounted by the test
      }
    }
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  function setup(settings: NumberFlashSettings = NUMBER_FLASH_DEFAULTS) {
    const rng = createRng(1)
    const mirror = createRng(1) // generates the same digits as the game
    const w = mount(NumberFlashGame, { props: { settings, rng }, attachTo: document.body })
    mounted.push(w)
    return { w, nextDigits: (n: number) => randomDigits(mirror, n) }
  }

  async function playRound(
    w: ReturnType<typeof setup>['w'],
    answer: string,
    startSelector = 'button.start',
  ) {
    await w.find(startSelector).trigger('click')
    vi.advanceTimersByTime(20_000)
    await flushPromises()
    const input = w.find('input')
    await input.setValue(answer)
    await input.trigger('keydown', { key: 'Enter' })
  }

  it('plays a round', async () => {
    const { w, nextDigits } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([4])
    const digits = nextDigits(4)
    await w.find('button.start').trigger('click')
    expect(w.findAll('.digit.shown')).toHaveLength(1)
    vi.advanceTimersByTime(800)
    await flushPromises()
    expect(w.findAll('.digit.shown')).toHaveLength(4)
    expect(w.find('.digits').text().replace(/\s/g, '')).toBe(digits)
    vi.advanceTimersByTime(3250)
    await flushPromises()
    const input = w.find('input')
    expect(input.exists()).toBe(true)
    await input.setValue(digits)
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.findAll('.diff-match')).toHaveLength(4)
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({ success: true, level: 4, metrics: { length: 4, correct: 4 } })
    expect(w.text()).toContain('streak 1/3')
  })

  it('three correct in a row level up', async () => {
    const { w, nextDigits } = setup()
    await playRound(w, nextDigits(4))
    await playRound(w, nextDigits(4), 'button.next')
    await playRound(w, nextDigits(4), 'button.next')
    expect(w.emitted('level')!.at(-1)).toEqual([5])
    expect(w.text()).toContain('4 → 5')
    expect(useStatsStore().getStaircase(NUMBER_FLASH_ID, cfg).level).toBe(5)
  })

  it('a wrong answer levels down', async () => {
    const { w } = setup()
    await playRound(w, 'xxxx')
    expect(w.emitted('level')!.at(-1)).toEqual([3])
    expect(w.text()).toContain('4 → 3')
  })

  it('ignores Enter for 300 ms and repeats', async () => {
    const { w } = setup()
    await playRound(w, 'xxxx')
    vi.advanceTimersByTime(100)
    press('Enter')
    await flushPromises()
    expect(w.find('button.next').exists()).toBe(true)
    vi.advanceTimersByTime(300)
    press('Enter', { repeat: true })
    await flushPromises()
    expect(w.find('button.next').exists()).toBe(true)
    press('Enter')
    await flushPromises()
    expect(w.find('.digit').exists()).toBe(true)
  })

  it('resumes the saved level', async () => {
    useStatsStore().saveStaircase(NUMBER_FLASH_ID, { level: 7, streakRight: 0, streakWrong: 0 })
    const { w } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([7])
    expect(w.text()).toContain('Length 7')
  })

  it('unmount during reveal records nothing', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(500)
    w.unmount()
    await flushPromises()
    expect(w.emitted('round-complete')).toBeUndefined()
    expect(useStatsStore().staircases[NUMBER_FLASH_ID]).toBeUndefined()
  })

  it('Esc during the reveal skips to recall and is marked handled', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc)
    await flushPromises()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('input').exists()).toBe(true)
  })

  it('settings snapshot', async () => {
    const { w, nextDigits } = setup()
    const digits = nextDigits(4)
    await w.find('button.start').trigger('click')
    await w.setProps({ settings: { ...NUMBER_FLASH_DEFAULTS, upAfter: 5 } })
    vi.advanceTimersByTime(20_000)
    await flushPromises()
    await w.find('input').setValue(digits)
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(w.text()).toContain('streak 1/3')
  })
})
