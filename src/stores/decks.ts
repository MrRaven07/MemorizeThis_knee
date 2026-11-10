import { defineStore } from 'pinia'
import { ref } from 'vue'
import { appStorage, loadJson, saveJson } from '@/core/storage/persist'
import * as ops from '@/features/major/deck'
import { nextBox } from '@/features/major/scheduler'
import type { Box, Deck, Direction } from '@/features/major/types'

export const DECKS_KEY = 'mt:decks'

/**
 * The player's flashcard decks. Saved after EVERY change — decks are the
 * player's own work (spec §8). Included in Backup automatically (mt: key).
 */
export const useDecksStore = defineStore('decks', () => {
  const decks = ref<Deck[]>(loadJson<Deck[]>(appStorage, DECKS_KEY, [], Array.isArray))
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
