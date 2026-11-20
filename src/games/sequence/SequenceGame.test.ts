import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import SequenceGame from './SequenceGame.vue'
import {
  LEAD_MS,
  SEQUENCE_DEFAULTS,
  SEQUENCE_ID,
  createSequence,
  gapMs,
  itemMs,
  type SequenceSettings,
} from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const tones = vi.hoisted(() => ({
  unlock: vi.fn<() => void>(),
  play: vi.fn<(pad: number, ms: number, volume: number) => void>(),
  buzz: vi.fn<(ms: number, volume: number) => void>(),
  dispose: vi.fn<() => void>(),
}))
vi.mock('@/core/audio/tones', () => ({ createTonePlayer: () => tones }))

const SEED = 1
const FAST: SequenceSettings = { ...SEQUENCE_DEFAULTS, baseMs: 400 }
const mounted: { unmount(): void }[] = []
let visibility: DocumentVisibilityState = 'visible'

function key(k: string, code = '') {
  const e = new KeyboardEvent('keydown', { key: k, code, bubbles: true, cancelable: true })
  document.body.dispatchEvent(e)
  return e
}

async function advance(ms: number) {
  const end = performance.now() + ms
  while (performance.now() < end) {
    vi.advanceTimersByTime(Math.min(50, end - performance.now()))
    await flushPromises()
  }
}

describe('SequenceGame', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
    for (const f of Object.values(tones)) f.mockClear()
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

  function setup(settings: SequenceSettings = FAST, pads = 4) {
    const mirror = createSequence(createRng(SEED), pads)
    mirror.growTo(999)
    const w = mount(SequenceGame, {
      props: { settings, rng: createRng(SEED) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, seq: (i: number) => mirror.at(i) }
  }

  type W = ReturnType<typeof setup>['w']
  const phase = (w: W) => w.find('.sequence').attributes('data-phase')

  async function waitForInput(w: W) {
    for (let i = 0; i < 20_000 && phase(w) !== 'input'; i++) await advance(50)
    expect(phase(w)).toBe('input')
  }

  /** Repeats the current sequence of length n correctly with number keys. */
  async function repeat(w: W, seq: (i: number) => number, n: number) {
    await waitForInput(w)
    for (let i = 0; i < n; i++) key(String(seq(i) + 1))
    await flushPromises()
  }

  it('a full run: playback, repeats, then one mistake ends it with one emit', async () => {
    const { w, seq } = setup()
    expect(w.find('button.from-best').exists()).toBe(false)
    await w.find('button.start').trigger('click')
    expect(tones.unlock).toHaveBeenCalled()
    expect(phase(w)).toBe('play')
    // lead-in: everything dark
    await advance(LEAD_MS - 100)
    expect(w.findAll('button.pad.lit')).toHaveLength(0)
    await advance(150)
    expect(w.findAll('button.pad.lit')).toHaveLength(1)
    expect(w.findAll('button.pad')[seq(0)]!.classes()).toContain('lit')
    expect(tones.play).toHaveBeenCalledWith(seq(0), 400, 60)
    // input during playback is ignored
    key(String(seq(0) + 1))
    await repeat(w, seq, 1)
    await repeat(w, seq, 2)
    await repeat(w, seq, 3)
    await waitForInput(w)
    expect(w.find('.step').text()).toContain('4')
    const wrong = (seq(0) + 1) % 4
    key(String(wrong + 1))
    await flushPromises()
    key(String(wrong + 1))
    await flushPromises()
    expect(w.emitted('round-complete')).toHaveLength(1)
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({
      success: true,
      level: null,
      accuracy: null,
      metrics: { reached: 3, startLength: 1, pads: 4, steps: 3 },
    })
    expect(tones.buzz).toHaveBeenCalled()
    expect(phase(w)).toBe('result')
    const pads = w.findAll('button.pad')
    expect(pads[seq(0)]!.classes()).toContain('expected')
    expect(pads[seq(0)]!.text()).toContain('✓')
    expect(pads[wrong]!.classes()).toContain('pressed')
    expect(pads[wrong]!.text()).toContain('✗')
  })

  it('pads can be tapped, and Q W A S work for 4 pads', async () => {
    const { w, seq } = setup()
    await w.find('button.start').trigger('click')
    await waitForInput(w)
    await w.findAll('button.pad')[seq(0)]!.trigger('click')
    await waitForInput(w)
    key('qwas'[seq(0)]!)
    key('qwas'[seq(1)]!)
    await flushPromises()
    await waitForInput(w)
    expect(w.find('.progress').text()).toContain('0 / 3')
    expect(w.emitted('round-complete')).toBeUndefined()
  })

  it('tones mode keeps pads dark but plays tones; colours mode is silent', async () => {
    const { w } = setup({ ...FAST, feedback: 'tones' })
    await w.find('button.start').trigger('click')
    await advance(LEAD_MS + 100)
    expect(w.findAll('button.pad.lit')).toHaveLength(0)
    expect(tones.play).toHaveBeenCalledTimes(1)
    w.unmount()
    mounted.pop()
    tones.play.mockClear()
    const b = setup({ ...FAST, feedback: 'colors' })
    await b.w.find('button.start').trigger('click')
    await advance(LEAD_MS + 100)
    expect(b.w.findAll('button.pad.lit')).toHaveLength(1)
    expect(tones.play).not.toHaveBeenCalled()
  })

  it('Esc asks "End run?"; keep going replays; Esc twice ends and records', async () => {
    const { w, seq } = setup()
    await w.find('button.start').trigger('click')
    await repeat(w, seq, 1)
    await repeat(w, seq, 2)
    await advance(100)
    expect(key('Escape').defaultPrevented).toBe(true)
    await flushPromises()
    expect(w.find('.confirm').exists()).toBe(true)
    await w.find('button.keep').trigger('click')
    expect(w.find('.confirm').exists()).toBe(false)
    expect(phase(w)).toBe('play')
    await repeat(w, seq, 3)
    expect(key('Escape').defaultPrevented).toBe(true)
    expect(key('Escape').defaultPrevented).toBe(true)
    await flushPromises()
    expect(w.emitted('round-complete')).toHaveLength(1)
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r.metrics).toMatchObject({ reached: 3, steps: 3 })
    expect(phase(w)).toBe('result')
    // on the result screen Esc goes to the shell (quit)
    expect(key('Escape').defaultPrevented).toBe(false)
  })

  it('the End run button opens the same confirmation', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    await w.find('button.end').trigger('click')
    await w.find('button.end-run').trigger('click')
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r.metrics).toMatchObject({ reached: 0, steps: 0, startLength: 1 })
  })

  it('start from best − 3, and success needs to tie the previous best', async () => {
    useStatsStore().recordRound(SEQUENCE_ID, {
      success: true,
      level: null,
      accuracy: null,
      durationMs: 1,
      metrics: { reached: 12, startLength: 1, pads: 4, steps: 12 },
    })
    const { w, seq } = setup()
    expect(w.find('button.from-best').text()).toContain('9')
    await w.find('button.from-best').trigger('click')
    await waitForInput(w)
    expect(w.find('.progress').text()).toContain('0 / 9')
    key(String(((seq(0) + 1) % 4) + 1))
    await flushPromises()
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r).toMatchObject({ success: false, metrics: { reached: 0, startLength: 9, steps: 0 } })
  })

  it('input timeout ends the run after a long pause', async () => {
    const { w, seq } = setup({ ...FAST, inputTimeout: 2 })
    await w.find('button.start').trigger('click')
    await repeat(w, seq, 1)
    await waitForInput(w)
    await advance(1500)
    key(String(seq(0) + 1))
    await advance(1500)
    expect(w.emitted('round-complete')).toBeUndefined()
    await advance(600)
    const [r] = w.emitted('round-complete')![0] as [RoundResult]
    expect(r.metrics).toMatchObject({ reached: 1, steps: 1 })
    expect(w.findAll('button.pad')[seq(1)]!.classes()).toContain('expected')
  })

  it('settings changed mid-run apply from the next run', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    await w.setProps({ settings: { ...FAST, pads: '9' } })
    expect(w.findAll('button.pad')).toHaveLength(4)
    key('Escape')
    key('Escape')
    await flushPromises()
    await advance(400)
    key('Enter')
    await flushPromises()
    expect(w.findAll('button.pad')).toHaveLength(9)
  })

  it('long sequences: start length 50, timing stays exact at item 40 of step 2', async () => {
    const { w, seq } = setup({ ...FAST, startLength: 50 })
    await w.find('button.start').trigger('click')
    await repeat(w, seq, 50)
    expect(phase(w)).toBe('play')
    const ms = itemMs(400, 2)
    const slot = ms + gapMs(ms)
    await advance(LEAD_MS + 40 * slot + 20)
    expect(w.findAll('button.pad.lit')).toHaveLength(1)
    expect(w.findAll('button.pad')[seq(40)]!.classes()).toContain('lit')
    expect(w.find('.progress').text()).toContain('41 / 51')
    await repeat(w, seq, 51)
    expect(w.find('.step').text()).toContain('3')
    expect(w.emitted('round-complete')).toBeUndefined()
  })

  it('a hidden tab pauses the playback', async () => {
    const { w, seq } = setup()
    await w.find('button.start').trigger('click')
    await advance(LEAD_MS - 300)
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await advance(400)
    expect(w.findAll('button.pad')[seq(0)]!.classes()).toContain('lit')
  })

  it('unmounting mid-run records nothing and releases audio', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    await advance(500)
    w.unmount()
    mounted.pop()
    expect(w.emitted('round-complete')).toBeUndefined()
    expect(tones.dispose).toHaveBeenCalled()
  })
})
