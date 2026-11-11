import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import DeckMemoryGame from './DeckMemoryGame.vue'
import { cardCode } from './cards'
import { DECK_MEMORY_DEFAULTS, dealSequence, type DeckMemorySettings } from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []
let visibility: DocumentVisibilityState = 'visible'

describe('DeckMemoryGame', () => {
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

  function setup(settings: DeckMemorySettings = DECK_MEMORY_DEFAULTS) {
    const expected = dealSequence(createRng(1), 4)
    const w = mount(DeckMemoryGame, {
      props: { settings, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, expected }
  }

  const key = (k: string) =>
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
    )

  async function pickAll(w: ReturnType<typeof setup>['w'], ids: number[]) {
    for (const id of ids) await w.findAll('button.pick')[id]!.trigger('click')
  }

  it('one-at-a-time memorize, picker recall, perfect round', async () => {
    const { w, expected } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    await w.find('button.start').trigger('click')
    expect(w.text()).toContain('1 / 4')
    expect(w.findAll('.memorize .playing-card')).toHaveLength(1)
    key('ArrowRight')
    await flushPromises()
    expect(w.text()).toContain('2 / 4')
    await w.find('button.done').trigger('click')
    await flushPromises()
    await pickAll(w, expected)
    await w.find('button.check').trigger('click')
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({ success: true, level: 1, metrics: { cards: 4, correct: 4 } })
  })

  it('typed codes are appended; Enter in the empty box checks', async () => {
    const { w, expected } = setup()
    await w.find('button.start').trigger('click')
    await w.find('button.done').trigger('click')
    await flushPromises()
    const box = w.find('input[name="codes"]')
    await box.setValue(expected.map(cardCode).join(' ').toLowerCase() + ' zz')
    await box.trigger('keydown', { key: 'Enter' })
    expect(w.findAll('.answer .playing-card')).toHaveLength(4)
    expect((box.element as HTMLInputElement).value).toBe('zz')
    expect(w.find('.code-problems').text()).toContain('zz')
    await box.setValue('')
    await box.trigger('keydown', { key: 'Enter' })
    expect((w.emitted('round-complete')![0] as [RoundResult])[0].success).toBe(true)
  })

  it('a used card cannot be picked again; Undo and Backspace remove the last', async () => {
    const { w, expected } = setup()
    await w.find('button.start').trigger('click')
    await w.find('button.done').trigger('click')
    await flushPromises()
    await pickAll(w, [expected[0]!])
    expect(w.findAll('button.pick')[expected[0]!]!.attributes('aria-disabled')).toBe('true')
    await pickAll(w, [expected[1]!])
    await w.find('button.undo').trigger('click')
    expect(w.findAll('.answer .playing-card')).toHaveLength(1)
    ;(document.activeElement as HTMLElement | null)?.blur()
    key('Backspace')
    await flushPromises()
    expect(w.findAll('.answer .playing-card')).toHaveLength(0)
  })

  it('hidden time does not count as memorization time', async () => {
    const { w, expected } = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(500)
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(10_000)
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(500)
    await w.find('button.done').trigger('click')
    await flushPromises()
    await pickAll(w, expected)
    await w.find('button.check').trigger('click')
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result.metrics.memoMs).toBeLessThan(2000)
  })

  it('row view shows all cards at once', async () => {
    const { w } = setup({ ...DECK_MEMORY_DEFAULTS, view: 'row' })
    await w.find('button.start').trigger('click')
    expect(w.findAll('.memorize .playing-card')).toHaveLength(4)
  })

  it('Esc ends memorizing (prevented); Next has the 300 ms guard', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc)
    await flushPromises()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('button.check').exists()).toBe(true)
    await w.find('button.check').trigger('click')
    ;(document.activeElement as HTMLElement | null)?.blur()
    vi.advanceTimersByTime(100)
    key('Enter')
    await flushPromises()
    expect(w.find('button.next').exists()).toBe(true)
    vi.advanceTimersByTime(300)
    key('Enter')
    await flushPromises()
    expect(w.find('button.next').exists()).toBe(false)
  })

  it('a wrong card fails the round and is shown as wrong', async () => {
    const { w, expected } = setup()
    await w.find('button.start').trigger('click')
    await w.find('button.done').trigger('click')
    await flushPromises()
    const wrong = [0, 1, 2, 3, 4].find((id) => !expected.includes(id))!
    await pickAll(w, [expected[0]!, wrong, expected[2]!, expected[3]!])
    await w.find('button.check').trigger('click')
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result.success).toBe(false)
    expect(w.find('.op-substitute').exists()).toBe(true)
  })

  it('a held Enter (key repeat) does not skip memorizing or submit early', async () => {
    const { w, expected } = setup()
    await flushPromises()
    key('Enter')
    await flushPromises()
    expect(w.find('.memorize').exists()).toBe(true)
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect(w.find('.memorize').exists()).toBe(true)
    await w.find('button.done').trigger('click')
    await flushPromises()
    const box = w.find('input[name="codes"]')
    await box.setValue(cardCode(expected[0]!))
    await box.trigger('keydown', { key: 'Enter' })
    await box.trigger('keydown', { key: 'Enter', repeat: true })
    expect(w.emitted('round-complete')).toBeUndefined()
  })

  it('the picker sits above the answer strip (it never moves while placing cards)', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    await w.find('button.done').trigger('click')
    await flushPromises()
    const html = w.html()
    expect(html.indexOf('class="picker"')).toBeLessThan(html.indexOf('class="answer"'))
  })
})
