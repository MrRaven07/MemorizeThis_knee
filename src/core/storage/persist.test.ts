import { describe, expect, it } from 'vitest'
import { createMemoryAdapter } from './adapter'
import { loadJson, runMigrations, saveJson, VERSION_KEY } from './persist'

describe('runMigrations', () => {
  it('fresh storage migrates to the current version', () => {
    const a = createMemoryAdapter()
    expect(runMigrations(a)).toBe('ok')
    expect(a.get(VERSION_KEY)).toBe('1')
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
})
