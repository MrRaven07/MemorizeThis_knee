import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appStorage } from '@/core/storage/persist'
import { initStaircase, type StaircaseConfig } from '@/core/difficulty/staircase'
import { useSessionStore } from './session'
import { PROGRESS_KEY, ROUNDS_KEY, useStatsStore } from './stats'
import { SETTINGS_KEY, useSettingsStore } from './settings'
import type { GameModule } from '@/games/types'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const result = {
  success: true,
  level: null,
  accuracy: 1,
  durationMs: 1200,
  metrics: { length: 10 },
}
const cfg: StaircaseConfig = {
  start: 4,
  min: 3,
  max: 30,
  upAfter: 3,
  upStep: 1,
  downAfter: 1,
  downStep: 1,
}

describe('stats store', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
  })

  it('recordRound stores a full record, persists it and counts the session round', () => {
    const stats = useStatsStore()
    const rec = stats.recordRound('long-number', result)
    expect(rec).toMatchObject({ ...result, gameId: 'long-number' })
    expect(typeof rec.id).toBe('string')
    expect(typeof rec.at).toBe('number')
    expect(rec.sessionId).toBe(useSessionStore().current!.id)
    expect(useSessionStore().current!.rounds).toBe(1)
    expect(JSON.parse(appStorage.get(ROUNDS_KEY)!)).toHaveLength(1)
    expect(stats.roundsFor('long-number')).toHaveLength(1)
    expect(stats.roundsFor('other')).toHaveLength(0)
  })

  it('rounds survive a reload', () => {
    useStatsStore().recordRound('long-number', result)
    setActivePinia(createPinia())
    expect(useStatsStore().rounds).toHaveLength(1)
  })

  it('staircase: init first, then the saved (clamped) state', () => {
    const stats = useStatsStore()
    expect(stats.getStaircase('number-flash', cfg)).toEqual(initStaircase(cfg))
    stats.saveStaircase('number-flash', { level: 99, streakRight: 1, streakWrong: 0 })
    expect(JSON.parse(appStorage.get(PROGRESS_KEY)!)['number-flash'].level).toBe(99)
    expect(stats.getStaircase('number-flash', cfg).level).toBe(30)
  })
})

describe('settings store', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
  })

  const fake = {
    id: 'fake',
    defaultSettings: { n: 10 },
    settingsFields: [{ key: 'n', label: 'N', type: 'number', min: 1, max: 50 }],
  } as unknown as GameModule<{ n: number }>

  it('returns sanitized defaults, then saved values', () => {
    const s = useSettingsStore()
    expect(s.gameSettings(fake)).toEqual({ n: 10 })
    s.setGameSettings('fake', { n: 0 })
    expect(s.gameSettings(fake)).toEqual({ n: 1 })
    expect(JSON.parse(appStorage.get(SETTINGS_KEY)!).games.fake).toEqual({ n: 0 })
  })

  it('maze key set defaults to wasd and persists', () => {
    const s = useSettingsStore()
    expect(s.mazeKeys).toBe('wasd')
    s.setMazeKeys('1234')
    setActivePinia(createPinia())
    expect(useSettingsStore().mazeKeys).toBe('1234')
  })
})
