import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import CardMatchGame from './CardMatchGame.vue'
import { CARD_MATCH_DEFAULTS, dealCards, type CardMatchSettings } from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []

/** Index pairs [[a, b], …] for a dealt level-1 board (3 pairs). */
function pairsFor(cards: number[]): [number, number][] {
  const bySymbol = new Map<number, number[]>()
  cards.forEach((c, i) => bySymbol.set(c, [...(bySymbol.get(c) ?? []), i]))
  return [...bySymbol.values()].map((v) => [v[0]!, v[1]!])
}

describe('CardMatchGame', () => {
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

  function setup(settings: CardMatchSettings = CARD_MATCH_DEFAULTS) {
    const cards = dealCards(createRng(1), 3)
    const w = mount(CardMatchGame, {
      props: { settings, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, pairs: pairsFor(cards) }
  }

  const click = async (w: ReturnType<typeof setup>['w'], i: number) => {
    await w.findAll('button.card')[i]!.trigger('click')
    await flushPromises()
  }

  it('perfect round with preview', async () => {
    const { w, pairs } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    await w.find('button.start').trigger('click')
    expect(w.findAll('.card.up')).toHaveLength(6)
    vi.advanceTimersByTime(1550)
    await flushPromises()
    expect(w.findAll('.card.up')).toHaveLength(0)
    for (const [a, b] of pairs) {
      await click(w, a)
      await click(w, b)
    }
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({
      success: true,
      level: 1,
      accuracy: 1,
      metrics: { moves: 3, memoryMistakes: 0, extraMoves: 0, preview: 1, pairs: 3 },
    })
    expect(w.text()).toContain('minimum 3')
  })

  it('no preview: a lucky mismatch is no mistake', async () => {
    const { w, pairs } = setup({ previewSecondsPerPair: 0 })
    await w.find('button.start').trigger('click')
    expect(w.findAll('button.card')).toHaveLength(6)
    expect(w.findAll('.card.up')).toHaveLength(0)
    const [p0, p1] = pairs as [[number, number], [number, number]]
    await click(w, p0[0])
    await click(w, p1[0])
    expect(w.findAll('.card.up')).toHaveLength(2)
    vi.advanceTimersByTime(750)
    await flushPromises()
    expect(w.findAll('.card.up')).toHaveLength(0)
    for (const [a, b] of pairs) {
      await click(w, a)
      await click(w, b)
    }
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({
      success: true,
      metrics: { memoryMistakes: 0, moves: 4, extraMoves: 1, preview: 0 },
    })
  })

  it('fast third click during flip-back', async () => {
    const { w, pairs } = setup({ previewSecondsPerPair: 0 })
    await w.find('button.start').trigger('click')
    const [p0, p1, p2] = pairs as [[number, number], [number, number], [number, number]]
    await click(w, p0[0])
    await click(w, p1[0])
    await click(w, p2[0])
    const up = w.findAll('.card.up:not(.matched)')
    expect(up).toHaveLength(1)
    expect(w.findAll('button.card')[p2[0]]!.classes()).toContain('up')
  })

  it('a memory mistake fails the round and keeps level 1', async () => {
    const { w, pairs } = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(1550)
    await flushPromises()
    const [p0, p1] = pairs as [[number, number], [number, number]]
    await click(w, p0[0])
    await click(w, p1[0]) // everything was seen in the preview → mistake
    for (const [a, b] of pairs) {
      await click(w, a)
      await click(w, b)
    }
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({ success: false, metrics: { memoryMistakes: 1 } })
    expect(w.emitted('level')!.at(-1)).toEqual([1])
    expect(w.text()).toContain('Memory mistakes: 1')
  })

  it('keyboard play: arrows move focus, native click flips', async () => {
    const { w } = setup({ previewSecondsPerPair: 0 })
    await w.find('button.start').trigger('click')
    const buttons = w.findAll('button.card')
    ;(buttons[0]!.element as HTMLButtonElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    ;(document.activeElement as HTMLButtonElement).click()
    await flushPromises()
    expect(w.findAll('button.card')[1]!.classes()).toContain('up')
  })

  it('Esc skips the preview; Esc during play is left to the shell', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    const esc1 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc1)
    await flushPromises()
    expect(esc1.defaultPrevented).toBe(true)
    expect(w.findAll('.card.up')).toHaveLength(0)
    const esc2 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc2)
    expect(esc2.defaultPrevented).toBe(false)
  })

  it('keyboard focus lands on the cards when play starts', async () => {
    const { w } = setup({ previewSecondsPerPair: 0 })
    await w.find('button.start').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(w.findAll('button.card')[0]!.element)
  })

  it('a stale flip-back timer does not hide the third card', async () => {
    const { w, pairs } = setup({ previewSecondsPerPair: 0 })
    await w.find('button.start').trigger('click')
    const [p0, p1, p2] = pairs as [[number, number], [number, number], [number, number]]
    await click(w, p0[0])
    await click(w, p1[0])
    await click(w, p2[0])
    vi.advanceTimersByTime(750)
    await flushPromises()
    expect(w.findAll('button.card')[p2[0]]!.classes()).toContain('up')
  })
})
