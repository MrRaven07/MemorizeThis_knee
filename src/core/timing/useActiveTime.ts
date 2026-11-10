import { onScopeDispose } from 'vue'
import { defaultClock, type Clock } from './countdown'

/**
 * Measures how long something was actually on screen: time while the tab is
 * hidden is not counted. Use for round durations.
 */
export function useActiveTime(opts: { clock?: Clock } = {}) {
  const clock = opts.clock ?? defaultClock
  let banked = 0
  let since: number | null = null
  let running = false

  function onVisibility() {
    if (!running) return
    if (document.visibilityState === 'hidden') {
      if (since !== null) banked += clock() - since
      since = null
    } else if (since === null) {
      since = clock()
    }
  }

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  onScopeDispose(() => {
    if (typeof document !== 'undefined')
      document.removeEventListener('visibilitychange', onVisibility)
  })

  const elapsed = () => banked + (since !== null ? clock() - since : 0)

  return {
    start() {
      banked = 0
      running = true
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      since = hidden ? null : clock()
    },
    /** Stops and returns the active milliseconds. */
    stop(): number {
      const total = elapsed()
      banked = total
      since = null
      running = false
      return total
    },
    elapsed,
  }
}
