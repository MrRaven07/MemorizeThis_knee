import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { useActiveTime } from './useActiveTime'

describe('useActiveTime', () => {
  it('excludes time while the tab is hidden', () => {
    let t = 0
    let visibility: DocumentVisibilityState = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    const set = (v: DocumentVisibilityState) => {
      visibility = v
      document.dispatchEvent(new Event('visibilitychange'))
    }
    const scope = effectScope()
    const timer = scope.run(() => useActiveTime({ clock: () => t }))!
    timer.start()
    t = 1000
    set('hidden')
    t = 5000
    expect(timer.elapsed()).toBe(1000)
    set('visible')
    t = 6000
    expect(timer.stop()).toBe(2000)
    t = 9000
    expect(timer.elapsed()).toBe(2000)
    scope.stop()
  })
})
