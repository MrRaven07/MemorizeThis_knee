import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import NamesFacesGame from './NamesFacesGame.vue'
import { generateFaces } from './faces'
import { NAMES_FACES_DEFAULTS, assignNames, type NamesFacesSettings, type Person } from './logic'
import { ro } from './names/ro'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []

describe('NamesFacesGame', () => {
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

  /** Mirrors the game's RNG use: faces, names, then the recall order. */
  function setup(settings: NamesFacesSettings = NAMES_FACES_DEFAULTS, faces = 3) {
    const mirror = createRng(1)
    const people = assignNames(mirror, generateFaces(mirror, faces), ro, settings.nameStyle)
    const order = mirror.shuffle(people.map((_, i) => i))
    const w = mount(NamesFacesGame, {
      props: { settings, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, people, recall: order.map((i) => people[i]!) }
  }

  async function study(w: ReturnType<typeof setup>['w']) {
    await w.find('button.start').trigger('click')
    await w.find('button.done').trigger('click')
    await flushPromises()
  }

  async function type(w: ReturnType<typeof setup>['w'], sel: string, value: string) {
    const input = w.find(sel)
    await input.setValue(value)
    await input.trigger('keydown', { key: 'Enter' })
  }

  it('study shows every face with its name; recall in a new order; all correct passes', async () => {
    const { w, people, recall } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    await w.find('button.start').trigger('click')
    expect(w.findAll('.study-card')).toHaveLength(3)
    for (const p of people) expect(w.text()).toContain(p.first)
    await w.find('button.done').trigger('click')
    await flushPromises()
    for (const p of recall) await type(w, 'input[name="first"]', p.first.toLowerCase())
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({
      success: true,
      level: 1,
      accuracy: 1,
      metrics: { faces: 3, points: 3, fullNames: 0 },
    })
  })

  it('diacritics are optional when typing; the result shows the exact name', async () => {
    const { w, recall } = setup()
    await study(w)
    const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
    for (const p of recall) await type(w, 'input[name="first"]', strip(p.first))
    expect((w.emitted('round-complete')![0] as [RoundResult])[0].accuracy).toBe(1)
    for (const p of recall) expect(w.find('.results').text()).toContain(p.first)
  })

  it('Back fixes the previous answer before checking', async () => {
    const { w, recall } = setup()
    await study(w)
    await type(w, 'input[name="first"]', 'Nobody')
    await w.find('button.back').trigger('click')
    expect((w.find('input[name="first"]').element as HTMLInputElement).value).toBe('Nobody')
    await type(w, 'input[name="first"]', recall[0]!.first)
    for (const p of recall.slice(1)) await type(w, 'input[name="first"]', p.first)
    expect((w.emitted('round-complete')![0] as [RoundResult])[0].accuracy).toBe(1)
  })

  it('full names: two inputs, Enter moves first → last, half a point each', async () => {
    const { w, recall } = setup({ ...NAMES_FACES_DEFAULTS, nameStyle: 'full' })
    await study(w)
    const [a, ...rest] = recall as [Person, ...Person[]]
    await type(w, 'input[name="first"]', a.first)
    expect(document.activeElement).toBe(w.find('input[name="last"]').element)
    await type(w, 'input[name="last"]', 'Wrongescu')
    for (const p of rest) {
      await type(w, 'input[name="first"]', p.first)
      await type(w, 'input[name="last"]', p.last)
    }
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r.metrics).toMatchObject({ points: 2.5, fullNames: 1 })
    expect(r.accuracy).toBeCloseTo(2.5 / 3)
    expect(w.find('.results .wrong').text()).toContain('✗')
  })

  it('faces carry a text description for screen readers', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    expect(w.find('.study-card').attributes('aria-label')).toMatch(/hair/)
  })

  it('Esc ends studying (prevented)', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc)
    await flushPromises()
    expect(esc.defaultPrevented).toBe(true)
    expect(w.find('input[name="first"]').exists()).toBe(true)
  })

  it('a hidden tab pauses the study time', async () => {
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    const { w } = setup()
    await w.find('button.start').trigger('click')
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    expect(w.find('.study-card').exists()).toBe(true)
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
  })

  it('recall: the face is an image for screen readers; empty Enter skips; held Enter is ignored', async () => {
    const { w, recall } = setup()
    await study(w)
    expect(w.find('.recall-card').attributes('role')).toBe('img')
    const input = w.find('input[name="first"]')
    await input.trigger('keydown', { key: 'Enter', repeat: true })
    expect(w.text()).toContain('Face 1 / 3')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.text()).toContain('Face 2 / 3')
    for (const p of recall.slice(1)) await type(w, 'input[name="first"]', p.first)
    expect((w.emitted('round-complete')![0] as [RoundResult])[0].metrics.points).toBe(2)
  })

  it('Check before the last face scores the rest as missing; quitting records nothing', async () => {
    const { w, recall } = setup()
    await study(w)
    await type(w, 'input[name="first"]', recall[0]!.first)
    await w.find('button.check').trigger('click')
    expect((w.emitted('round-complete')![0] as [RoundResult])[0].metrics.points).toBe(1)
    const q = setup()
    await study(q.w)
    q.w.unmount()
    expect(q.w.emitted('round-complete')).toBeUndefined()
  })

  it('full names: the result names each part; only the wrong part gets a diff', async () => {
    const { w, recall } = setup({ ...NAMES_FACES_DEFAULTS, nameStyle: 'full' })
    await study(w)
    const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    const [a, ...rest] = recall as [Person, ...Person[]]
    await type(w, 'input[name="first"]', strip(a.first))
    await type(w, 'input[name="last"]', 'Wrongescu')
    for (const p of rest) {
      await type(w, 'input[name="first"]', p.first)
      await type(w, 'input[name="last"]', p.last)
    }
    const row = w.find('.results .wrong')
    expect(row.attributes('aria-label')).toContain('first name right, last name wrong')
    expect(row.text()).toContain('first ✓ · last ✗')
    expect(row.findAll('.diff')).toHaveLength(1)
    expect(
      row.find('.diff .diff-substitute').exists() || row.find('.diff .diff-missing').exists(),
    ).toBe(true)
  })

  it('recall buttons keep the keyboard open; inputs turn off autocorrect', async () => {
    const { w } = setup()
    await study(w)
    expect(w.find('input[name="first"]').attributes('autocorrect')).toBe('off')
    for (const sel of ['button.back', 'button.check']) {
      const e = new Event('pointerdown', { cancelable: true, bubbles: true })
      w.find(sel).element.dispatchEvent(e)
      expect(e.defaultPrevented).toBe(true)
    }
  })
})
