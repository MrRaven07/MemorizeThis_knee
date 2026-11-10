import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { appStorage } from '@/core/storage/persist'
import { planImport } from '@/features/major/deck'
import { parsePaste } from '@/features/major/parse'
import { DECKS_KEY, useDecksStore } from './decks'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

describe('decks store', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
  })

  it('create, rename, delete persist', () => {
    const s = useDecksStore()
    const d = s.createDeck('Major RO')
    expect(s.getDeck(d.id)!.name).toBe('Major RO')
    s.renameDeck(d.id, 'Major RO v2')
    expect(JSON.parse(appStorage.get(DECKS_KEY)!)[0].name).toBe('Major RO v2')
    setActivePinia(createPinia())
    expect(useDecksStore().decks).toHaveLength(1)
    useDecksStore().deleteDeck(d.id)
    expect(JSON.parse(appStorage.get(DECKS_KEY)!)).toEqual([])
  })

  it('cards: add, update keeps progress, remove', () => {
    const s = useDecksStore()
    const d = s.createDeck('x')
    s.addCard(d.id, '00', 'sos')
    const id = s.getDeck(d.id)!.cards[0]!.id
    s.recordAnswer(d.id, 'forward', id, true)
    s.updateCard(d.id, id, '00', 'soare')
    expect(s.getDeck(d.id)!.cards[0]!.output).toBe('soare')
    expect(s.getDeck(d.id)!.progress.forward[id]!.box).toBe(2)
    s.removeCard(d.id, id)
    expect(s.getDeck(d.id)!.cards).toEqual([])
  })

  it('recordAnswer moves boxes per direction and counts the session', () => {
    const s = useDecksStore()
    const d = s.createDeck('x')
    s.addCard(d.id, '01', 'sat')
    const id = s.getDeck(d.id)!.cards[0]!.id
    s.recordAnswer(d.id, 'forward', id, true)
    s.recordAnswer(d.id, 'forward', id, true)
    s.recordAnswer(d.id, 'forward', id, false)
    s.recordAnswer(d.id, 'reverse', id, true)
    const deck = s.getDeck(d.id)!
    expect(deck.progress.forward[id]).toMatchObject({ box: 1, knew: 2, missed: 1 })
    expect(deck.progress.forward[id]!.lastAnsweredAt).toEqual(expect.any(Number))
    expect(deck.progress.reverse[id]).toMatchObject({ box: 2, knew: 1, missed: 0 })
    expect(s.answeredThisSession).toBe(4)
  })

  it('applyImport refuses plans with errors and writes nothing', () => {
    const s = useDecksStore()
    const d = s.createDeck('x')
    const before = appStorage.get(DECKS_KEY)
    const bad = planImport(s.getDeck(d.id)!, parsePaste('00 - sos\nbroken'))
    expect(() => s.applyImport(d.id, bad, 'replace')).toThrow('errors')
    expect(appStorage.get(DECKS_KEY)).toBe(before)
    const good = planImport(s.getDeck(d.id)!, parsePaste('00 - sos\n01 - sat'))
    s.applyImport(d.id, good, 'replace')
    expect(s.getDeck(d.id)!.cards).toHaveLength(2)
  })

  it('malformed saved decks fall back to empty', () => {
    appStorage.set(DECKS_KEY, '{"a":1}')
    expect(useDecksStore().decks).toEqual([])
  })
})
