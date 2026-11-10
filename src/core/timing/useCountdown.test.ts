import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useCountdown } from './useCountdown'

let visibility: DocumentVisibilityState = 'visible'

function setVisibility(v: DocumentVisibilityState) {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'],
    })
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function setup() {
    const scope = effectScope()
    const cd = scope.run(() => useCountdown({ clock: () => Date.now() }))!
    return { scope, cd }
  }

  it('resolves done after the duration', async () => {
    const { scope, cd } = setup()
    const p = cd.start(1000)
    expect(cd.running.value).toBe(true)
    vi.advanceTimersByTime(500)
    expect(cd.remainingMs.value).toBeGreaterThan(400)
    expect(cd.remainingMs.value).toBeLessThanOrEqual(516) // display updates once per ~16 ms frame
    vi.advanceTimersByTime(520)
    await expect(p).resolves.toBe('done')
    expect(cd.running.value).toBe(false)
    expect(cd.progress.value).toBe(1)
    scope.stop()
  })

  it('pauses while the tab is hidden', async () => {
    const { scope, cd } = setup()
    const p = cd.start(1000)
    vi.advanceTimersByTime(400)
    setVisibility('hidden')
    vi.advanceTimersByTime(5000)
    expect(cd.running.value).toBe(true)
    expect(cd.remainingMs.value).toBeGreaterThan(550)
    expect(cd.remainingMs.value).toBeLessThanOrEqual(616)
    setVisibility('visible')
    vi.advanceTimersByTime(650)
    await expect(p).resolves.toBe('done')
    scope.stop()
  })

  it('finishNow resolves done immediately (Skip)', async () => {
    const { scope, cd } = setup()
    const p = cd.start(10_000)
    cd.finishNow()
    await expect(p).resolves.toBe('done')
    expect(cd.running.value).toBe(false)
    scope.stop()
  })

  it('cancel resolves cancelled', async () => {
    const { scope, cd } = setup()
    const p = cd.start(1000)
    cd.cancel()
    await expect(p).resolves.toBe('cancelled')
    scope.stop()
  })

  it('disposing the scope cancels a running countdown', async () => {
    const { scope, cd } = setup()
    const p = cd.start(1000)
    scope.stop()
    await expect(p).resolves.toBe('cancelled')
  })

  it('starting again cancels the previous run', async () => {
    const { scope, cd } = setup()
    const first = cd.start(1000)
    const second = cd.start(200)
    await expect(first).resolves.toBe('cancelled')
    vi.advanceTimersByTime(250)
    await expect(second).resolves.toBe('done')
    scope.stop()
  })
})
