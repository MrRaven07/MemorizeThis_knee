import { defineStore } from 'pinia'
import { ref } from 'vue'
import { appStorage, loadJson, saveJson } from '@/core/storage/persist'
import { sanitizeSettings } from '@/games/settings'
import type { GameModule, GameSettings } from '@/games/types'

export const SETTINGS_KEY = 'mt:settings'

export type MazeKeys = 'wasd' | '1234'

interface SavedSettings {
  mazeKeys: MazeKeys
  games: Record<string, GameSettings>
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadJson<Partial<SavedSettings>>(appStorage, SETTINGS_KEY, {})
  const mazeKeys = ref<MazeKeys>(saved.mazeKeys === '1234' ? '1234' : 'wasd')
  const games = ref<Record<string, GameSettings>>(
    typeof saved.games === 'object' && saved.games !== null ? saved.games : {},
  )

  function persist() {
    saveJson(appStorage, SETTINGS_KEY, { mazeKeys: mazeKeys.value, games: games.value })
  }

  /** Always valid: saved values sanitized against the module's fields. */
  function gameSettings<S extends GameSettings>(module: GameModule<S>): S {
    return sanitizeSettings(games.value[module.id], module.defaultSettings, module.settingsFields)
  }

  function setGameSettings(gameId: string, s: GameSettings) {
    games.value[gameId] = { ...s }
    persist()
  }

  function setMazeKeys(keys: MazeKeys) {
    mazeKeys.value = keys
    persist()
  }

  return { mazeKeys, games, gameSettings, setGameSettings, setMazeKeys }
})
