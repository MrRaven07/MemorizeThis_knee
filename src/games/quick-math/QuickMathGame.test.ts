import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import QuickMathGame from './QuickMathGame.vue'
import { QUICK_MATH_DEFAULTS, enabledOps, generateProblem, type QuickMathSettings } from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []
const SPRINT: QuickMathSettings = { ...QUICK_MATH_DEFAULTS, sprintSeconds: 30 }

describe('QuickMathGame', () => {
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

  function setup(settings: QuickMathSettings = SPRINT) {
    const mirror = createRng(1)
    const ops = enabledOps(settings).ops
    let prev: string | undefined
    const next = () => {
      const p = generateProblem(mirror, 1, ops, prev)
      prev = p.text
      return p
    }
    const w = mount(QuickMathGame, {
      props: { settings, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, next }
  }

  async function answer(w: ReturnType<typeof setup>['w'], value: string) {
    const input = w.find('input')
    await input.setValue(value)
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
  }

  it('a fast, accurate sprint passes', async () => {
    const { w, next } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    await w.find('button.start').trigger('click')
    for (let i = 0; i < 11; i++) {
      const p = next()
      expect(w.find('.problem').text()).toBe(p.text)
      await answer(w, String(p.answer))
    }
    vi.advanceTimersByTime(31_000)
    await flushPromises()
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({
      success: true,
      level: 1,
      accuracy: 1,
      metrics: { correct: 11, wrong: 0, sprintSeconds: 30 },
    })
    expect(w.text()).toContain('streak 1/3')
  })

  it('a wrong answer shows the right one, then moves on and counts as wrong', async () => {
    const { w, next } = setup()
    await w.find('button.start').trigger('click')
    const p = next()
    await answer(w, String(p.answer + 1))
    expect(w.find('.reveal').text()).toContain(String(p.answer))
    vi.advanceTimersByTime(450)
    await flushPromises()
    expect(w.find('.problem').text()).toBe(next().text)
    vi.advanceTimersByTime(31_000)
    await flushPromises()
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r.metrics).toMatchObject({ correct: 0, wrong: 1 })
  })

  it('an empty Enter is ignored; 07 counts as 7', async () => {
    const { w, next } = setup({
      ...SPRINT,
      add: false,
      sub: false,
      mul: true,
      div: false,
      mod: false,
    })
    await w.find('button.start').trigger('click')
    const p = next()
    await answer(w, '')
    expect(w.find('.problem').text()).toBe(p.text)
    await answer(w, `0${p.answer}`)
    expect(w.find('.problem').text()).not.toBe(p.text)
  })

  it('all operations off: says so and uses all', async () => {
    const { w } = setup({ ...SPRINT, add: false, sub: false, mul: false, div: false, mod: false })
    await flushPromises()
    expect(w.text()).toContain('All operations were off')
  })

  it('quitting mid-sprint records nothing', async () => {
    const { w, next } = setup()
    await w.find('button.start').trigger('click')
    await answer(w, String(next().answer))
    mounted.splice(0)
    w.unmount()
    vi.advanceTimersByTime(40_000)
    await flushPromises()
    expect(w.emitted('round-complete')).toBeUndefined()
  })
})
