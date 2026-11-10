import { onScopeDispose, ref, type Ref } from 'vue'
import { createCountdown, defaultClock, type Clock, type Countdown } from './countdown'

export type CountdownOutcome = 'done' | 'cancelled'

export interface UseCountdown {
  remainingMs: Ref<number>
  /** 0..1 elapsed — feed it to <TimerBar>. */
  progress: Ref<number>
  running: Ref<boolean>
  /** Runs a countdown; resolves 'done' at zero (or on finishNow), 'cancelled' otherwise. */
  start(durationMs: number): Promise<CountdownOutcome>
  /** End the current countdown early as if it finished (the "Skip" button). */
  finishNow(): void
  cancel(): void
}

/**
 * Frame-accurate countdown for game phases. Pauses while the tab is hidden
 * (so hidden time never counts as viewing time) and cancels itself when the
 * component that created it is unmounted.
 *
 *   phase.value = 'memorize'
 *   if ((await countdown.start(4000)) === 'cancelled') return
 *   phase.value = 'recall'
 */
export function useCountdown(
  opts: { pauseWhenHidden?: boolean; clock?: Clock } = {},
): UseCountdown {
  const { pauseWhenHidden = true, clock = defaultClock } = opts

  const remainingMs = ref(0)
  const progress = ref(0)
  const running = ref(false)

  let current: Countdown | null = null
  let resolveCurrent: ((o: CountdownOutcome) => void) | null = null
  let frame: number | null = null

  function stopLoop() {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
  }

  function settle(outcome: CountdownOutcome) {
    stopLoop()
    const resolve = resolveCurrent
    current = null
    resolveCurrent = null
    running.value = false
    if (outcome === 'done') {
      remainingMs.value = 0
      progress.value = 1
    }
    resolve?.(outcome)
  }

  function tick() {
    frame = null
    if (!current) return
    remainingMs.value = current.remaining()
    progress.value = current.progress()
    if (current.isDone()) {
      settle('done')
      return
    }
    if (!current.isPaused()) frame = requestAnimationFrame(tick)
  }

  function onVisibilityChange() {
    if (!current) return
    if (document.visibilityState === 'hidden') {
      current.pause()
      stopLoop()
    } else if (current.isPaused()) {
      current.resume()
      if (frame === null) frame = requestAnimationFrame(tick)
    }
  }

  if (pauseWhenHidden && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  onScopeDispose(() => {
    if (pauseWhenHidden && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    if (current) settle('cancelled')
  })

  return {
    remainingMs,
    progress,
    running,
    start(durationMs) {
      if (current) settle('cancelled')
      return new Promise<CountdownOutcome>((resolve) => {
        current = createCountdown(Math.max(0, durationMs), clock)
        resolveCurrent = resolve
        running.value = true
        remainingMs.value = current.remaining()
        progress.value = current.progress()
        if (
          pauseWhenHidden &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'hidden'
        ) {
          current.pause()
        }
        tick()
      })
    },
    finishNow() {
      if (current) settle('done')
    },
    cancel() {
      if (current) settle('cancelled')
    },
  }
}
