import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  clampStaircase,
  initStaircase,
  type StaircaseConfig,
  type StaircaseState,
} from '@/core/difficulty/staircase'
import { appStorage, loadJson, saveJson } from '@/core/storage/persist'
import type { RoundRecord, RoundResult } from '@/games/types'
import { useSessionStore } from './session'

export const ROUNDS_KEY = 'mt:rounds'
export const PROGRESS_KEY = 'mt:progress'

/** Round history and per-game difficulty progress. */
export const useStatsStore = defineStore('stats', () => {
  const rounds = ref<RoundRecord[]>(loadJson<RoundRecord[]>(appStorage, ROUNDS_KEY, []))
  const staircases = ref<Record<string, StaircaseState>>(
    loadJson<Record<string, StaircaseState>>(appStorage, PROGRESS_KEY, {}),
  )

  function recordRound(gameId: string, r: RoundResult): RoundRecord {
    const session = useSessionStore()
    session.noteRound()
    const record: RoundRecord = {
      ...r,
      id: globalThis.crypto.randomUUID(),
      gameId,
      at: Date.now(),
      sessionId: session.current?.id ?? null,
    }
    rounds.value.push(record)
    saveJson(appStorage, ROUNDS_KEY, rounds.value)
    return record
  }

  function roundsFor(gameId: string): RoundRecord[] {
    return rounds.value.filter((r) => r.gameId === gameId)
  }

  function getStaircase(gameId: string, cfg: StaircaseConfig): StaircaseState {
    const saved = staircases.value[gameId]
    return saved ? clampStaircase(saved, cfg) : initStaircase(cfg)
  }

  function saveStaircase(gameId: string, s: StaircaseState) {
    staircases.value[gameId] = { ...s }
    saveJson(appStorage, PROGRESS_KEY, staircases.value)
  }

  return { rounds, staircases, recordRound, roundsFor, getStaircase, saveStaircase }
})
