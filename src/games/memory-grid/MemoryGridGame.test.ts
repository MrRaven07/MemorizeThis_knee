import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import MemoryGridGame from './MemoryGridGame.vue'
import { MEMORY_GRID_DEFAULTS, generatePattern } from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []

describe('MemoryGridGame', () => {
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

  function setup() {
    const pattern = generatePattern(createRng(1), 4, 4)
    const w = mount(MemoryGridGame, {
      props: { settings: MEMORY_GRID_DEFAULTS, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, pattern }
  }

  async function toRecall(w: ReturnType<typeof setup>['w']) {
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(1650)
    await flushPromises()
  }

  it('shows the pattern, hides it, and an exact copy passes', async () => {
    const { w, pattern } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    await w.find('button.start').trigger('click')
    const all = w.findAll('.cell').map((c) => c.element)
    expect(w.findAll('.cell.on').map((c) => all.indexOf(c.element))).toEqual(pattern)
    vi.advanceTimersByTime(1650)
    await flushPromises()
    expect(w.findAll('.cell.on')).toHaveLength(0)
    for (const i of pattern) await w.findAll('button.cell')[i]!.trigger('click')
    expect(w.findAll('button.cell')[pattern[0]!]!.attributes('aria-pressed')).toBe('true')
    await w.find('button.check').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({
      success: true,
      level: 1,
      accuracy: 1,
      metrics: { hits: 4, misses: 0, wrong: 0, size: 4, lit: 4 },
    })
  })

  it('tapping again undoes; Clear empties', async () => {
    const { w, pattern } = setup()
    await toRecall(w)
    const cell = w.findAll('button.cell')[pattern[0]!]!
    await cell.trigger('click')
    await cell.trigger('click')
    expect(cell.attributes('aria-pressed')).toBe('false')
    await cell.trigger('click')
    await w.find('button.clear').trigger('click')
    expect(w.findAll('button.cell[aria-pressed="true"]')).toHaveLength(0)
  })

  it('a wrong copy fails, stays at the minimum level, and marks cells', async () => {
    const { w, pattern } = setup()
    await toRecall(w)
    const wrong = Array.from({ length: 16 }, (_, i) => i).find((i) => !pattern.includes(i))!
    await w.findAll('button.cell')[pattern[0]!]!.trigger('click')
    await w.findAll('button.cell')[wrong]!.trigger('click')
    await w.find('button.check').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({ success: false, metrics: { hits: 1, misses: 3, wrong: 1 } })
    expect(w.findAll('.cell.hit')).toHaveLength(1)
    expect(w.findAll('.cell.missed')).toHaveLength(3)
    expect(w.findAll('.cell.wrong')).toHaveLength(1)
    expect(w.find('.cell.wrong').text()).toContain('✗')
  })

  it('arrow keys move focus across the grid', async () => {
    const { w } = setup()
    await toRecall(w)
    const cells = w.findAll('button.cell')
    ;(cells[0]!.element as HTMLButtonElement).focus()
    await cells[0]!.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(document.activeElement).toBe(cells[4]!.element)
  })

  it('Esc during the show skips to recall (prevented)', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc)
    await flushPromises()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('button.check').exists()).toBe(true)
  })

  it('the top level is a 13×13 grid with 26 lit cells; arrows clamp at the edges', async () => {
    useStatsStore().saveStaircase('memory-grid', { level: 20, streakRight: 0, streakWrong: 0 })
    const w = mount(MemoryGridGame, {
      props: { settings: MEMORY_GRID_DEFAULTS, rng: createRng(2) },
      attachTo: document.body,
    })
    mounted.push(w)
    expect(w.text()).toContain('13×13')
    await w.find('button.start').trigger('click')
    expect(w.findAll('.cell')).toHaveLength(169)
    expect(w.findAll('.cell.on')).toHaveLength(26)
    vi.advanceTimersByTime(5000)
    await flushPromises()
    const cells = w.findAll('button.cell')
    expect(cells).toHaveLength(169)
    ;(cells[12]!.element as HTMLButtonElement).focus()
    await cells[12]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cells[12]!.element)
    await cells[12]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cells[25]!.element)
    expect(w.find('.grid').classes()).toContain('dense')
  })

  it('a perfect round at level 1 moves the streak, three in a row level up to 4×4/5', async () => {
    const rng = createRng(5)
    const mirror = createRng(5)
    const w = mount(MemoryGridGame, {
      props: { settings: MEMORY_GRID_DEFAULTS, rng },
      attachTo: document.body,
    })
    mounted.push(w)
    let prev: number[] | undefined
    for (let round = 0; round < 3; round++) {
      const pattern = generatePattern(mirror, 4, 4, prev)
      prev = pattern
      await w.find(round === 0 ? 'button.start' : 'button.next').trigger('click')
      vi.advanceTimersByTime(1650)
      await flushPromises()
      for (const i of pattern) await w.findAll('button.cell')[i]!.trigger('click')
      await w.find('button.check').trigger('click')
    }
    expect(w.emitted('level')!.at(-1)).toEqual([2])
    expect(w.text()).toContain('Level 1 → 2')
  })

  it('Clear keeps keyboard focus on the grid; the result is described for screen readers', async () => {
    const { w, pattern } = setup()
    await toRecall(w)
    await w.findAll('button.cell')[pattern[0]!]!.trigger('click')
    await w.find('button.clear').trigger('click')
    await flushPromises()
    expect((document.activeElement as HTMLElement).classList.contains('cell')).toBe(true)
    await w.findAll('button.cell')[pattern[0]!]!.trigger('click')
    await w.find('button.check').trigger('click')
    expect(w.find('.grid').attributes('aria-label')).toContain('1 found, 3 missed, 0 wrong')
  })
})
