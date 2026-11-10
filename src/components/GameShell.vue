<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useSessionStore } from '@/stores/session'
import SessionClock from './SessionClock.vue'

/**
 * Frame around every game: quit, title, level, session clock, settings.
 * Counts session time while mounted.
 *
 * Esc: a game that uses Esc in a phase (e.g. "skip") calls
 * `event.preventDefault()` in its own keydown handler; the shell then
 * does NOT quit (docs/agents/questions/001).
 */
const props = defineProps<{
  title: string
  gameId: string
  level?: string | number | null
}>()

const emit = defineEmits<{ quit: []; 'open-settings': [] }>()

const session = useSessionStore()

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented) return
  const el = document.activeElement
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return
  }
  emit('quit')
}

onMounted(() => {
  session.beginActivity(props.gameId)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  session.endActivity()
})
</script>

<template>
  <section class="shell">
    <header class="bar">
      <button type="button" class="quit" @click="emit('quit')">← Quit</button>
      <h1 class="title">{{ title }}</h1>
      <span v-if="level !== undefined && level !== null" class="level mono">lvl {{ level }}</span>
      <SessionClock />
      <button type="button" class="settings" aria-label="Game settings" @click="emit('open-settings')">
        ⚙
      </button>
    </header>
    <div class="play">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-5);
}
.bar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.title {
  font-size: var(--text-lg);
  flex: 1;
}
.level {
  color: var(--accent);
  background: var(--accent-dim);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  padding: 0 var(--space-2);
  font-size: var(--text-sm);
}
.quit,
.settings {
  padding: var(--space-1) var(--space-3);
}
.play {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
}
</style>
