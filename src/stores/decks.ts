import { defineStore } from 'pinia'
import { ref } from 'vue'
import { appStorage, isPlainObject, loadJson, saveJson } from '@/core/storage/persist'
import * as ops from '@/features/major/deck'
import { nextBox } from '@/features/major/scheduler'
import type { Box, Deck, Direction } from '@/features/major/types'

export const DECKS_KEY = 'mt:decks'

const isText = (v: unknown): v is string => typeof v === 'string'

/** Keeps valid decks (repairing a missing progress); null for anything damaged. */
function sanitizeDeck(v: unknown): Deck | null {
  if (!isPlainObject(v) || !isText(v.id) || !isText(v.name) || !Array.isArray(v.cards)) return null
  const cardsOk = v.cards.every(
    (c: unknown) => isPlainObject(c) && isText(c.id) && isText(c.input) && isText(c.output),
  )
  if (!cardsOk) return null
  const p = isPlainObject(v.progress) ? v.progress : {}
  return {
    id: v.id,
    name: v.name,
    createdAt: typeof v.createdAt === 'number' ? v.createdAt : 0,
    cards: v.cards as Deck['cards'],
    progress: {
      forward: (isPlainObject(p.forward) ? p.forward : {}) as Deck['progress']['forward'],
      reverse: (isPlainObject(p.reverse) ? p.reverse : {}) as Deck['progress']['reverse'],
    },
  }
}

/** Loads decks; if any deck is damaged, keeps the raw text under `.corrupt` and drops only that deck. */
function loadDecks(): Deck[] {
  const raw = loadJson<unknown[]>(appStorage, DECKS_KEY, [], Array.isArray)
  const decks = raw.map(sanitizeDeck)
  const valid = decks.filter((d): d is Deck => d !== null)
  const damaged =
    decks.length !== valid.length ||
    raw.some((d, i) => isPlainObject(d) && !isPlainObject(d.progress) && decks[i])
  if (damaged) {
    const corruptKey = `${DECKS_KEY}.corrupt`
    const text = appStorage.get(DECKS_KEY)
    if (text !== null && appStorage.get(corruptKey) === null) appStorage.set(corruptKey, text)
  }
  return valid
}

/**
 * The player's flashcard decks. Saved after EVERY change — decks are the
 * player's own work (spec §8). Included in Backup automatically (mt: key).
 */
export const useDecksStore = defineStore('decks', () => {
  const decks = ref<Deck[]>(loadDecks())
  /** cards picked for the next study session (pick mode); not persisted */
  const studySelection = ref<string[] | null>(null)
  /** answers given this app session (used by the session summary) */
  const answeredThisSession = ref(0)

  function persist() {
    saveJson(appStorage, DECKS_KEY, decks.value)
  }

  function getDeck(id: string): Deck | undefined {
    return decks.value.find((d) => d.id === id)
  }

  /** Replaces one deck with the result of a pure operation, then saves. */
  function update(id: string, op: (d: Deck) => Deck) {
    const i = decks.value.findIndex((d) => d.id === id)
    if (i < 0) return
    decks.value[i] = op(decks.value[i]!)
    persist()
  }

  function createDeck(name: string): Deck {
    const d = ops.createDeckData(name, Date.now())
    decks.value.push(d)
    persist()
    return d
  }

  function renameDeck(id: string, name: string) {
    const clean = name.normalize('NFC').trim()
    if (clean) update(id, (d) => ({ ...d, name: clean }))
  }

  function deleteDeck(id: string) {
    decks.value = decks.value.filter((d) => d.id !== id)
    persist()
  }

  function addCard(deckId: string, input: string, output: string) {
    update(deckId, (d) => ops.addCard(d, input, output))
  }

  function updateCard(deckId: string, cardId: string, input: string, output: string) {
    update(deckId, (d) => ops.updateCard(d, cardId, input, output))
  }

  function removeCard(deckId: string, cardId: string) {
    update(deckId, (d) => ops.removeCard(d, cardId))
  }

  /** Throws (and writes nothing) if the plan has errors. */
  function applyImport(deckId: string, plan: ops.ImportPlan, mode: 'replace' | 'keep') {
    const deck = getDeck(deckId)
    if (!deck) return
    const next = ops.applyImport(deck, plan, mode)
    update(deckId, () => next)
  }

  function recordAnswer(deckId: string, dir: Direction, cardId: string, knew: boolean) {
    update(deckId, (d) => {
      const p = ops.progressOf(d, dir, cardId)
      const next = {
        box: nextBox(p.box, knew) as Box,
        knew: p.knew + (knew ? 1 : 0),
        missed: p.missed + (knew ? 0 : 1),
        lastAnsweredAt: Date.now(),
      }
      return { ...d, progress: { ...d.progress, [dir]: { ...d.progress[dir], [cardId]: next } } }
    })
    answeredThisSession.value++
  }

  return {
    decks,
    studySelection,
    answeredThisSession,
    getDeck,
    createDeck,
    renameDeck,
    deleteDeck,
    addCard,
    updateCard,
    removeCard,
    applyImport,
    recordAnswer,
  }
})
