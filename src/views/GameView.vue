<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import GameShell from '@/components/GameShell.vue'
import SettingsForm from '@/components/SettingsForm.vue'
import { getGame } from '@/games/registry'
import type { GameSettings, RoundResult } from '@/games/types'
import { useSettingsStore } from '@/stores/settings'
import { useStatsStore } from '@/stores/stats'

/**
 * Hosts any game module inside the shared GameShell.
 * Settings changes apply from the game's next round — games snapshot
 * `settings` when a round starts (docs/agents/questions/004).
 */
const props = defineProps<{ gameId: string }>()

const router = useRouter()
const settingsStore = useSettingsStore()
const stats = useStatsStore()

// The router guard guarantees the id exists.
const module = getGame(props.gameId)!
const GameComponent = defineAsyncComponent(module.component)

const settings = computed(() => settingsStore.gameSettings(module))
const showSettings = ref(false)
const level = ref<number | null>(null)

function onRoundComplete(result: RoundResult) {
  stats.recordRound(module.id, result)
}

function onSettings(s: GameSettings) {
  settingsStore.setGameSettings(module.id, s)
}

function resetSettings() {
  settingsStore.setGameSettings(module.id, { ...module.defaultSettings })
}

function quit() {
  router.push({ name: 'home' })
}
</script>

<template>
  <GameShell
    :title="module.name"
    :game-id="module.id"
    :level="level"
    @quit="quit"
    @open-settings="showSettings = !showSettings"
  >
    <aside v-if="showSettings" class="drawer" aria-label="Settings">
      <SettingsForm
        :fields="module.settingsFields"
        :model-value="settings"
        :defaults="module.defaultSettings"
        @update:model-value="onSettings"
      />
      <p class="muted note">Changes apply from the next round.</p>
      <div class="drawer-actions">
        <button type="button" @click="resetSettings">Reset to defaults</button>
        <button type="button" class="primary" @click="showSettings = false">Done</button>
      </div>
    </aside>
    <GameComponent
      :settings="settings"
      @round-complete="onRoundComplete"
      @level="(l: number | null) => (level = l)"
    />
  </GameShell>
</template>

<style scoped>
.drawer {
  width: 100%;
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.note {
  font-size: var(--text-sm);
  margin: var(--space-3) 0;
}
.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
