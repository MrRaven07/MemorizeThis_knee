<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { formatDuration } from '@/core/format'
import { sessionSummary } from '@/features/stats/aggregate'
import { getGame } from '@/games/registry'
import { useSessionStore } from '@/stores/session'
import { useStatsStore } from '@/stores/stats'

/** Summary of one finished session (question 011). */
const props = defineProps<{ id: string }>()
const session = useSessionStore()
const stats = useStatsStore()

const index = computed(() => session.sessions.findIndex((s) => s.id === props.id))
const record = computed(() => session.sessions[index.value])
const previous = computed(() => (index.value > 0 ? session.sessions[index.value - 1]! : null))
const summary = computed(() =>
  record.value ? sessionSummary(record.value, stats.rounds, previous.value) : null,
)

function nameOf(id: string): string {
  return id === 'major' ? 'Major System' : (getGame(id)?.name ?? id)
}

function headlineOf(id: string, rounds: Parameters<typeof sessionSummary>[1]): string | null {
  const g = getGame(id)
  return g && rounds.length > 0 ? g.summarize(rounds).headline : null
}

const minus = '−'
const signed = (n: number) => (n >= 0 ? `+${n}` : `${minus}${Math.abs(n)}`)
</script>

<template>
  <section v-if="record && summary" class="summary-page">
    <header class="top">
      <RouterLink :to="{ name: 'home' }">← Home</RouterLink>
      <RouterLink :to="{ name: 'stats' }">Stats</RouterLink>
    </header>
    <h1>Session summary</h1>
    <p class="muted">{{ new Date(record.startedAt).toLocaleString() }}</p>

    <div class="tiles">
      <div class="tile">
        <span class="value mono">{{ formatDuration(summary.activeMs) }}</span
        ><span class="muted">played</span>
      </div>
      <div class="tile summary-rounds">
        <span class="value mono">{{ summary.rounds }}</span
        ><span class="muted">rounds</span>
      </div>
      <div class="tile">
        <span class="value mono">{{ summary.cards }}</span
        ><span class="muted">flashcards</span>
      </div>
    </div>

    <p v-if="summary.vsPrevious" class="compare mono">
      {{ signed(Math.round(summary.vsPrevious.ms / 60_000)) }} min ·
      {{ signed(summary.vsPrevious.rounds) }} rounds vs last time
    </p>

    <ul v-if="summary.perGame.length > 0" class="games">
      <li v-for="g in summary.perGame" :key="g.id" class="game">
        <span class="name">{{ nameOf(g.id) }}</span>
        <span class="muted mono">
          {{ g.rounds.length }} rounds · {{ formatDuration(g.ms) }}
          <template v-if="headlineOf(g.id, g.rounds)"> · {{ headlineOf(g.id, g.rounds) }}</template>
          <template v-if="stats.staircases[g.id]">
            · level now {{ stats.staircases[g.id]!.level }}</template
          >
        </span>
      </li>
    </ul>
    <p v-else class="muted">No games played in this session.</p>
  </section>
</template>

<style scoped>
.summary-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-4);
}
.top {
  display: flex;
  justify-content: space-between;
}
h1 {
  font-size: var(--text-xl);
}
.summary-page p {
  margin: 0;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.value {
  font-size: var(--text-xl);
  color: var(--accent);
}
.compare {
  color: var(--text-muted);
}
.games {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.game {
  display: flex;
  flex-direction: column;
  padding: var(--space-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.name {
  font-weight: 600;
}
</style>
