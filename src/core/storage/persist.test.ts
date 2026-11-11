import { describe, expect, it } from 'vitest'
import { createMemoryAdapter } from './adapter'
import {
  loadJson,
  migrations,
  runMigrations,
  saveJson,
  SCHEMA_VERSION,
  VERSION_KEY,
} from './persist'

describe('runMigrations', () => {
  it('fresh storage migrates to the current version', () => {
    const a = createMemoryAdapter()
    expect(runMigrations(a)).toBe('ok')
    expect(SCHEMA_VERSION).toBe(2)
    expect(a.get(VERSION_KEY)).toBe('2')
  })

  it('runs pending migrations in order', () => {
    const a = createMemoryAdapter({ 'mt:version': '1' })
    const log: number[] = []
    runMigrations(a, { 1: () => log.push(1), 2: () => log.push(2), 3: () => log.push(3) }, 3)
    expect(log).toEqual([2, 3])
    expect(a.get(VERSION_KEY)).toBe('3')
  })

  it('a future version is left untouched', () => {
    const a = createMemoryAdapter({ 'mt:version': '9', 'mt:rounds': '[1]' })
    expect(runMigrations(a)).toBe('future-version')
    expect(a.get('mt:rounds')).toBe('[1]')
    expect(a.get(VERSION_KEY)).toBe('9')
  })
})

describe('loadJson / saveJson', () => {
  it('round-trips values', () => {
    const a = createMemoryAdapter()
    saveJson(a, 'mt:x', { word: 'zeamă' })
    expect(loadJson(a, 'mt:x', null)).toEqual({ word: 'zeamă' })
  })

  it('missing key returns the fallback', () => {
    expect(loadJson(createMemoryAdapter(), 'mt:nope', 5)).toBe(5)
  })

  it('corrupt JSON falls back and keeps the raw text', () => {
    const a = createMemoryAdapter({ 'mt:rounds': '{oops' })
    expect(loadJson(a, 'mt:rounds', [])).toEqual([])
    expect(a.get('mt:rounds.corrupt')).toBe('{oops')
  })

  it('does not overwrite an earlier corrupt copy', () => {
    const a = createMemoryAdapter({ 'mt:rounds': '{second', 'mt:rounds.corrupt': '{first' })
    loadJson(a, 'mt:rounds', [])
    expect(a.get('mt:rounds.corrupt')).toBe('{first')
  })

  it('valid JSON with the wrong shape is treated as corrupt when a guard is given', () => {
    const a = createMemoryAdapter({ 'mt:rounds': 'null' })
    expect(loadJson(a, 'mt:rounds', [], Array.isArray)).toEqual([])
    expect(a.get('mt:rounds.corrupt')).toBe('null')
  })
})

describe('migration 2: sessions count flashcard answers', () => {
  const old = {
    id: 'a',
    startedAt: 1,
    endedAt: 2,
    activeMs: 3,
    rounds: 4,
    perGameMs: { x: 3 },
    lastActivityAt: 2,
    extra: 'kept',
  }

  it('adds cards: 0 to finished and current sessions, keeping other fields', () => {
    const a = createMemoryAdapter({
      'mt:version': '1',
      'mt:sessions': JSON.stringify([old]),
      'mt:session-current': JSON.stringify({ ...old, id: 'b', endedAt: null }),
    })
    expect(runMigrations(a)).toBe('ok')
    expect(a.get(VERSION_KEY)).toBe('2')
    expect(JSON.parse(a.get('mt:sessions')!)).toEqual([{ ...old, cards: 0 }])
    expect(JSON.parse(a.get('mt:session-current')!)).toMatchObject({ id: 'b', cards: 0 })
  })

  it('is idempotent and leaves corrupt or missing values alone', () => {
    const a = createMemoryAdapter({ 'mt:sessions': JSON.stringify([{ ...old, cards: 7 }]) })
    migrations[2]!(a)
    migrations[2]!(a)
    expect(JSON.parse(a.get('mt:sessions')!)[0].cards).toBe(7)
    const b = createMemoryAdapter({ 'mt:sessions': '{oops' })
    migrations[2]!(b)
    expect(b.get('mt:sessions')).toBe('{oops')
    expect(b.get('mt:session-current')).toBeNull()
  })
})
