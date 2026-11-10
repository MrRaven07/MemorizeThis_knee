import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appStorage } from '@/core/storage/persist'
import { SESSION_CURRENT_KEY, SESSIONS_KEY, useSessionStore } from './session'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

let visibility: DocumentVisibilityState = 'visible'
function setVisibility(v: DocumentVisibilityState) {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
}

const MIN = 60_000

describe('session store', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    vi.useFakeTimers({
      toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
    })
    vi.setSystemTime(new Date('2026-11-10T10:00:00Z'))
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('beginActivity opens a session and counts active time', () => {
    const s = useSessionStore()
    expect(s.current).toBeNull()
    s.beginActivity('long-number')
    expect(s.current).not.toBeNull()
    expect(s.isActive).toBe(true)
    vi.advanceTimersByTime(5000)
    expect(s.liveActiveMs).toBe(5000)
    s.endActivity()
    expect(s.isActive).toBe(false)
    expect(s.current!.activeMs).toBe(5000)
    expect(s.current!.perGameMs).toEqual({ 'long-number': 5000 })
  })

  it('noteRound counts rounds and saves the current session', () => {
    const s = useSessionStore()
    s.beginActivity('long-number')
    s.noteRound()
    expect(s.current!.rounds).toBe(1)
    expect(JSON.parse(appStorage.get(SESSION_CURRENT_KEY)!).rounds).toBe(1)
  })

  it('endSession finalizes, persists and clears the current session', () => {
    const s = useSessionStore()
    s.beginActivity('long-number')
    vi.advanceTimersByTime(2000)
    const rec = s.endSession()!
    expect(rec.endedAt).toBe(Date.now())
    expect(rec.activeMs).toBe(2000)
    expect(s.current).toBeNull()
    expect(s.sessions).toHaveLength(1)
    expect(JSON.parse(appStorage.get(SESSIONS_KEY)!)).toHaveLength(1)
    expect(appStorage.get(SESSION_CURRENT_KEY)).toBeNull()
  })

  it('a new activity after 30 idle minutes starts a new session', () => {
    const s = useSessionStore()
    s.beginActivity('long-number')
    s.endActivity()
    const firstId = s.current!.id
    vi.setSystemTime(Date.now() + 31 * MIN)
    s.beginActivity('long-number')
    expect(s.sessions).toHaveLength(1)
    expect(s.sessions[0]!.id).toBe(firstId)
    expect(s.current!.id).not.toBe(firstId)
  })

  it('resumes an unexpired saved session after a reload', () => {
    appStorage.set(
      SESSION_CURRENT_KEY,
      JSON.stringify({
        id: 'saved',
        startedAt: Date.now() - 20 * MIN,
        endedAt: null,
        activeMs: MIN,
        rounds: 3,
        perGameMs: { 'long-number': MIN },
        lastActivityAt: Date.now() - 5 * MIN,
      }),
    )
    const s = useSessionStore()
    expect(s.current!.id).toBe('saved')
    s.beginActivity('long-number')
    vi.advanceTimersByTime(1000)
    s.endActivity()
    expect(s.current!.activeMs).toBe(MIN + 1000)
  })

  it('finalizes an expired saved session on load', () => {
    appStorage.set(
      SESSION_CURRENT_KEY,
      JSON.stringify({
        id: 'old',
        startedAt: Date.now() - 3 * 60 * MIN,
        endedAt: null,
        activeMs: MIN,
        rounds: 1,
        perGameMs: {},
        lastActivityAt: Date.now() - 2 * 60 * MIN,
      }),
    )
    const s = useSessionStore()
    expect(s.current).toBeNull()
    expect(s.sessions.map((x) => x.id)).toEqual(['old'])
    expect(s.sessions[0]!.endedAt).toBe(Date.now() - 2 * 60 * MIN)
  })

  it('leaving the game while hidden does not resume counting on visible', () => {
    const s = useSessionStore()
    s.beginActivity('long-number')
    setVisibility('hidden')
    s.endActivity() // e.g. the game screen unmounted while hidden
    setVisibility('visible')
    expect(s.isActive).toBe(false)
  })

  it('hidden tab time does not count', () => {
    const s = useSessionStore()
    s.beginActivity('long-number')
    vi.advanceTimersByTime(1000)
    setVisibility('hidden')
    expect(s.isActive).toBe(false)
    vi.advanceTimersByTime(60_000)
    setVisibility('visible')
    expect(s.isActive).toBe(true)
    vi.advanceTimersByTime(1000)
    s.endActivity()
    expect(s.current!.activeMs).toBe(2000)
  })
})
