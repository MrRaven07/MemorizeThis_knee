import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import KimsGame from './KimsGame.vue'
import {
  KIMS_GAME_DEFAULTS,
  chooseMissing,
  generateTray,
  listPicker,
  trayObjects,
  type KimsGameSettings,
} from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []
const MISSING: KimsGameSettings = { ...KIMS_GAME_DEFAULTS, mode: 'missing' }

function key(k: string) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })
  document.body.dispatchEvent(e)
  return e
}

describe('KimsGame', () => {
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

  function setup(settings: KimsGameSettings = KIMS_GAME_DEFAULTS, seed = 1) {
    const w = mount(KimsGame, {
      props: { settings, rng: createRng(seed) },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  const pick = (w: ReturnType<typeof setup>, id: string) =>
    w.find(`button.choice[data-id="${id}"]`).trigger('click')

  it('list mode: shows the tray, hides it, and picking exactly the tray passes', async () => {
    const tray = generateTray(createRng(1), 10)
    const w = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    expect(w.text()).toContain('10 objects')
    await w.find('button.start').trigger('click')
    const cells = w.findAll('.tray .cell')
    expect(cells).toHaveLength(20)
    expect(cells.map((c) => c.attributes('data-id') ?? null)).toEqual(tray)
    vi.advanceTimersByTime(10000)
    await flushPromises()
    expect(w.find('.tray').exists()).toBe(false)
    const choices = w.findAll('button.choice')
    expect(choices).toHaveLength(20)
    expect(document.activeElement).toBe(choices[0]!.element)
    for (const id of trayObjects(tray)) await pick(w, id)
    expect(w.find(`button.choice[data-id="${trayObjects(tray)[0]}"]`).attributes('aria-pressed')).toBe(
      'true',
    )
    await w.find('button.check').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({
      success: true,
      level: 1,
      accuracy: 1,
      metrics: { mode: 0, objects: 10, missing: 0, hits: 10, misses: 0, wrong: 0, viewMs: 10000 },
    })
    expect(w.findAll('.tray .cell.hit')).toHaveLength(10)
    expect(w.text()).toContain('Level 1 (streak 1/3)')
  })

  it('tapping again undoes a pick', async () => {
    const tray = generateTray(createRng(1), 10)
    const w = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(10000)
    await flushPromises()
    const id = trayObjects(tray)[0]!
    await pick(w, id)
    await pick(w, id)
    expect(w.find(`button.choice[data-id="${id}"]`).attributes('aria-pressed')).toBe('false')
  })

  it('picking everything fails; the result marks hits ✓, misses ○ and wrong picks ✗', async () => {
    const w = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(10000)
    await flushPromises()
    for (const b of w.findAll('button.choice')) await b.trigger('click')
    await w.find('button.check').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({ success: false, accuracy: 0.5, metrics: { hits: 10, wrong: 10 } })
    expect(w.findAll('.tray .cell.hit')).toHaveLength(10)
    expect(w.findAll('.wrong-list li')).toHaveLength(10)
    expect(w.find('.wrong-list').text()).toContain('✗')
    expect(w.find('.tray .cell.hit').text()).toContain('✓')
  })

  it('checking with nothing picked is allowed and marks every object missed', async () => {
    const w = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(10000)
    await flushPromises()
    expect(w.find('button.check').attributes('disabled')).toBeUndefined()
    await w.find('button.check').trigger('click')
    expect(w.findAll('.tray .cell.missed')).toHaveLength(10)
    expect(w.find('.tray .cell.missed').text()).toContain('○')
    expect(w.find('.wrong-list').exists()).toBe(false)
  })

  it('missing mode: blank, then the same tray minus k objects; picking the missing one passes', async () => {
    const mirror = createRng(3)
    const tray = generateTray(mirror, 10)
    const missing = chooseMissing(mirror, tray, 1)
    const w = setup(MISSING, 3)
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(10000)
    await flushPromises()
    expect(w.find('.tray').exists()).toBe(false)
    expect(w.find('.blank').exists()).toBe(true)
    vi.advanceTimersByTime(1100)
    await flushPromises()
    const cells = w.findAll('.tray .cell')
    expect(cells).toHaveLength(20)
    tray.forEach((id, i) => {
      const expected = id !== null && missing.includes(id) ? null : id
      expect(cells[i]!.attributes('data-id') ?? null).toBe(expected)
    })
    // the emptied cell looks like any other empty cell
    const gone = tray.indexOf(missing[0]!)
    expect(cells[gone]!.classes()).toEqual(['cell', 'empty'])
    expect(w.findAll('button.choice')).toHaveLength(5)
    await pick(w, missing[0]!)
    await w.find('button.check').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({
      success: true,
      metrics: { mode: 1, objects: 10, missing: 1, hits: 1, misses: 0, wrong: 0 },
    })
    expect(w.findAll('.tray .cell.hit')).toHaveLength(1)
  })

  it('each mode keeps its own level', async () => {
    useStatsStore().saveStaircase('kims-game:missing', { level: 5, streakRight: 0, streakWrong: 0 })
    const w = setup()
    expect(w.text()).toContain('Level 1')
    await w.setProps({ settings: MISSING })
    expect(w.text()).toContain('Level 5')
    expect(w.text()).toContain('14 objects')
    expect(w.text()).toContain('2 missing')
    expect(w.emitted('level')!.at(-1)).toEqual([5])
    // a failed missing round only moves the missing level
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(13300)
    await flushPromises()
    vi.advanceTimersByTime(1100)
    await flushPromises()
    await w.find('button.check').trigger('click')
    const stats = useStatsStore()
    expect(stats.staircases['kims-game:missing']!.level).toBe(4)
    expect(stats.staircases['kims-game:list']).toBeUndefined()
  })

  it('settings changed mid-round apply from the next round', async () => {
    const w = setup()
    await w.find('button.start').trigger('click')
    await w.setProps({ settings: { ...MISSING, timeMultiplier: 2 } })
    vi.advanceTimersByTime(10000)
    await flushPromises()
    expect(w.findAll('button.choice')).toHaveLength(20)
    await w.find('button.check').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r.metrics).toMatchObject({ mode: 0, viewMs: 10000 })
    await w.find('button.next').trigger('click')
    vi.advanceTimersByTime(10000)
    await flushPromises()
    expect(w.find('button.choice').exists()).toBe(false) // 20 s view this time
    vi.advanceTimersByTime(10100)
    await flushPromises()
    expect(w.find('.blank').exists()).toBe(true) // now in missing mode
    vi.advanceTimersByTime(1100)
    await flushPromises()
    expect(w.find('button.choice').exists()).toBe(true)
    expect(w.findAll('button.choice')).toHaveLength(5)
  })

  it('Esc during the view skips it (prevented) and records the shorter exposure', async () => {
    const w = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(4000)
    const esc = key('Escape')
    await flushPromises()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('button.check').exists()).toBe(true)
    await w.find('button.check').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r.metrics.viewMs).toBeGreaterThanOrEqual(3900)
    expect(r.metrics.viewMs).toBeLessThanOrEqual(4100)
  })

  it('Enter starts a round from the intro and the next one from the result', async () => {
    const w = setup()
    const enter = key('Enter')
    await flushPromises()
    expect(enter.defaultPrevented).toBe(true)
    const first = w.findAll('.tray .cell').map((c) => c.attributes('data-id') ?? null)
    expect(first.filter(Boolean)).toHaveLength(10)
    vi.advanceTimersByTime(10000)
    await flushPromises()
    await w.find('button.check').trigger('click')
    vi.advanceTimersByTime(500)
    key('Enter')
    await flushPromises()
    const second = w.findAll('.tray .cell').map((c) => c.attributes('data-id') ?? null)
    expect(second.filter(Boolean)).toHaveLength(10)
    expect(second).not.toEqual(first)
  })

  it('arrow keys move focus across the picker (roving tabindex)', async () => {
    const w = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(10000)
    await flushPromises()
    const choices = w.findAll('button.choice')
    expect(choices.filter((c) => c.attributes('tabindex') === '0')).toHaveLength(1)
    await choices[0]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(choices[4]!.element)
    await choices[4]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(choices[5]!.element)
    await choices[5]!.trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(choices[1]!.element)
    await choices[1]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(choices[0]!.element)
    await choices[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(choices[0]!.element)
    expect(choices[0]!.attributes('tabindex')).toBe('0')
  })

  it('picker buttons are labelled by name and show the emoji and the name', async () => {
    const mirror = createRng(1)
    const tray = generateTray(mirror, 10)
    const picker = listPicker(mirror, tray)
    const w = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(10000)
    await flushPromises()
    expect(w.findAll('button.choice').map((b) => b.attributes('data-id'))).toEqual(picker)
    const first = w.find('button.choice')
    expect(first.attributes('aria-label')).toBeTruthy()
    expect(first.text()).toContain(first.attributes('aria-label'))
  })
})
