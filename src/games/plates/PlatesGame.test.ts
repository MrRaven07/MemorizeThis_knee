import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import PlatesGame from './PlatesGame.vue'
import { ro } from './formats/ro'
import { generateRound, PLATES_DEFAULTS, PLATES_ID } from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []

describe('PlatesGame', () => {
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
    for (const w of mounted.splice(0)) w.unmount()
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  function setup(level = 1) {
    if (level !== 1) {
      useStatsStore().saveStaircase(PLATES_ID, { level, streakRight: 0, streakWrong: 0 })
    }
    const expected = generateRound(createRng(1), level, ro)
    const w = mount(PlatesGame, {
      props: { settings: PLATES_DEFAULTS, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, expected }
  }

  async function reveal(w: ReturnType<typeof setup>['w']) {
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(30_000)
    await flushPromises()
  }

  it('plays a level-1 round', async () => {
    const { w, expected } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    await w.find('button.start').trigger('click')
    const shown = w.findAll('.plate')
    expect(shown).toHaveLength(1)
    expect(shown[0]!.findAll('.seg').map((x) => x.text())).toEqual(expected.plates[0]!.segments)
    vi.advanceTimersByTime(6050)
    await flushPromises()
    const inputs = w.findAll('input')
    expect(inputs).toHaveLength(1)
    await inputs[0]!.setValue(expected.plates[0]!.text.toLowerCase())
    await inputs[0]!.trigger('keydown', { key: 'Enter' })
    const chars = expected.plates[0]!.segments.join('').length
    expect(w.findAll('.diff-match')).toHaveLength(chars)
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({ success: true, level: 1, metrics: { plates: 1, correct: 1 } })
  })

  it('Enter moves between plate inputs', async () => {
    const { w, expected } = setup(3)
    await reveal(w)
    const inputs = w.findAll('input')
    expect(inputs).toHaveLength(2)
    await inputs[0]!.setValue(expected.plates[0]!.text)
    await inputs[0]!.trigger('keydown', { key: 'Enter' })
    expect(document.activeElement).toBe(inputs[1]!.element)
    expect(w.emitted('round-complete')).toBeUndefined()
    await inputs[1]!.setValue(expected.plates[1]!.text)
    await inputs[1]!.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('round-complete')).toHaveLength(1)
  })

  it('one wrong plate fails the round and levels down', async () => {
    const { w, expected } = setup(3)
    await reveal(w)
    const inputs = w.findAll('input')
    await inputs[0]!.setValue(expected.plates[0]!.text)
    await inputs[1]!.setValue('XX 00 XXX')
    await w.find('button.finish').trigger('click')
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({ success: false, level: 3, metrics: { plates: 2, correct: 1 } })
    expect(w.emitted('level')!.at(-1)).toEqual([2])
    expect(w.text()).toContain('3 → 2')
  })

  it('plates are capped to the screen width', async () => {
    const { w } = setup(12)
    await w.find('button.start').trigger('click')
    const plates = w.findAll('.plate')
    expect(plates).toHaveLength(6)
    for (const p of plates) expect(p.attributes('style')).toContain('max-width: 100%')
  })

  it('Esc during the reveal skips to recall and is marked handled', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc)
    await flushPromises()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.findAll('input')).toHaveLength(1)
  })

  it('the level-up setting shows in the streak (Q007)', async () => {
    const expected = generateRound(createRng(1), 1, ro)
    const w = mount(PlatesGame, {
      props: { settings: { ...PLATES_DEFAULTS, upAfter: 4 }, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(6050)
    await flushPromises()
    await w.find('input').setValue(expected.plates[0]!.text)
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(w.text()).toContain('streak 1/4')
  })
})
