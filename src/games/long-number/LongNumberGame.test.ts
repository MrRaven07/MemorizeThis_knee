import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRng } from '@/core/random/rng'
import type { RoundResult } from '@/games/types'
import LongNumberGame from './LongNumberGame.vue'
import { generateGroups, LONG_NUMBER_DEFAULTS, type LongNumberSettings } from './logic'

const settings: LongNumberSettings = {
  ...LONG_NUMBER_DEFAULTS,
  digitsPerGroup: 4,
  memorizeSeconds: 1,
  delaySeconds: 0,
}

const mounted: { unmount(): void }[] = []

describe('LongNumberGame', () => {
  beforeEach(() => {
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

  function setup(s: LongNumberSettings = settings) {
    const expected = generateGroups(createRng(1), s).join('')
    const w = mount(LongNumberGame, {
      props: { settings: s, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, expected }
  }

  it('plays a full round: memorize → recall → result', async () => {
    const { w, expected } = setup()
    expect(w.text()).toContain('4 digits')
    await w.find('button.start').trigger('click')
    expect(w.find('.number').text()).toBe(expected)

    vi.advanceTimersByTime(1050)
    await flushPromises()
    expect(w.find('.number').exists()).toBe(false)
    const input = w.find('input')
    expect(input.exists()).toBe(true)

    await input.setValue(expected)
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.findAll('.diff-match')).toHaveLength(4)
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({ success: true, accuracy: 1, metrics: { length: 4, correct: 4 } })
    expect(w.text()).toContain('4 of 4')
  })

  it('Skip during memorize goes straight to recall', async () => {
    const { w } = setup({ ...settings, memorizeSeconds: 60 })
    await w.find('button.start').trigger('click')
    await w.find('button.skip').trigger('click')
    await flushPromises()
    expect(w.find('input').exists()).toBe(true)
  })

  it('Esc during memorize skips and is marked as handled (so the shell does not quit)', async () => {
    const { w } = setup({ ...settings, memorizeSeconds: 60 })
    await w.find('button.start').trigger('click')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc)
    await flushPromises()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('input').exists()).toBe(true)
  })

  it('the recall time limit finishes the round on its own', async () => {
    const { w } = setup({ ...settings, recallSeconds: 2 })
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(1050)
    await flushPromises()
    vi.advanceTimersByTime(2050)
    await flushPromises()
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result.success).toBe(false)
    expect(result.metrics.correct).toBe(0)
  })

  it('settings changed mid-round apply from the next round', async () => {
    const { w } = setup({ ...settings, memorizeSeconds: 60 })
    await w.find('button.start').trigger('click')
    await w.setProps({ settings: { ...settings, digitsPerGroup: 8 } })
    expect(w.find('.number').text()).toHaveLength(4)
    await w.find('button.skip').trigger('click')
    await flushPromises()
    await w.find('input').trigger('keydown', { key: 'Enter' })
    await w.find('button.again').trigger('click')
    expect(w.find('.number').text()).toHaveLength(8)
  })

  it('recall time excludes a hidden tab', async () => {
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    const { w, expected } = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(1050)
    await flushPromises()
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(30_000)
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await w.find('input').setValue(expected)
    await w.find('input').trigger('keydown', { key: 'Enter' })
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result.durationMs).toBeLessThan(5000)
  })
})
