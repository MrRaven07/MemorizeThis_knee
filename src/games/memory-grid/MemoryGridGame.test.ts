import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
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
    const pattern = generatePattern(createRng(1), 3, 3)
    const w = mount(MemoryGridGame, {
      props: { settings: MEMORY_GRID_DEFAULTS, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, pattern }
  }

  async function toRecall(w: ReturnType<typeof setup>['w']) {
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(1500)
    await flushPromises()
  }

  it('shows the pattern, hides it, and an exact copy passes', async () => {
    const { w, pattern } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    await w.find('button.start').trigger('click')
    const all = w.findAll('.cell').map((c) => c.element)
    expect(w.findAll('.cell.on').map((c) => all.indexOf(c.element))).toEqual(pattern)
    vi.advanceTimersByTime(1500)
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
      metrics: { hits: 3, misses: 0, wrong: 0, size: 3, lit: 3 },
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
    const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((i) => !pattern.includes(i))!
    await w.findAll('button.cell')[pattern[0]!]!.trigger('click')
    await w.findAll('button.cell')[wrong]!.trigger('click')
    await w.find('button.check').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({ success: false, metrics: { hits: 1, misses: 2, wrong: 1 } })
    expect(w.findAll('.cell.hit')).toHaveLength(1)
    expect(w.findAll('.cell.missed')).toHaveLength(2)
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
    expect(document.activeElement).toBe(cells[3]!.element)
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
})
