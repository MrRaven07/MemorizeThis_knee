<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import TrendSparkline from '@/components/TrendSparkline.vue'
import { formatDuration } from '@/core/format'
import { dailyTrend, dayStreak, timePerGame, totals } from '@/features/stats/aggregate'
import { games, getGame } from '@/games/registry'
import { useSessionStore } from '@/stores/session'
import { useStatsStore } from '@/stores/stats'

/** Progress over weeks (spec §1, §7; question 011). */
const session = useSessionStore()
const stats = useStatsStore()

/** Finished sessions plus the open one (with its live time). */
const allSessions = computed(() => {
  const list = [...session.sessions]
  if (session.current) list.push({ ...session.current, activeMs: session.liveActiveMs })
  return list
})
const total = computed(() => totals(allSessions.value, stats.rounds))
const streak = computed(() =>
  dayStreak(
    allSessions.value.map((s) => s.startedAt),
    Date.now(),
  ),
)
const perGame = computed(() => timePerGame(allSessions.value))
const maxMs = computed(() => Math.max(1, ...perGame.value.map((g) => g.ms)))
const recent = computed(() => [...session.sessions].reverse().slice(0, 10))
const hasData = computed(() => allSessions.value.length > 0 || stats.rounds.length > 0)

const nameOf = (id: string) => (id === 'major' ? 'Major System' : (getGame(id)?.name ?? id))

const sections = computed(() =>
  games.map((g) => {
    const rounds = stats.roundsFor(g.id)
    const trend = dailyTrend(rounds)
    return { game: g, rounds, summary: g.summarize(rounds), trend }
  }),
)
</script>

<template>
  <section class="stats-page">
    <header class="top">
      <RouterLink :to="{ name: 'home' }">← Home</RouterLink>
      <h1>Stats</h1>
    </header>

    <p v-if="!hasData" class="card muted">
      No sessions yet. Play a game and your progress shows up here.
    </p>

    <template v-else>
      <div class="tiles">
        <div class="tile">
          <span class="value mono">{{ formatDuration(total.activeMs) }}</span
          ><span class="muted">total time</span>
        </div>
        <div class="tile">
          <span class="value mono">{{ total.sessions }}</span
          ><span class="muted">sessions</span>
        </div>
        <div class="tile">
          <span class="value mono">{{ total.rounds }}</span
          ><span class="muted">rounds</span>
        </div>
        <div class="tile">
          <span class="value mono">{{ total.cards }}</span
          ><span class="muted">flashcards</span>
        </div>
        <div class="tile">
          <span class="value mono">{{ streak }}</span
          ><span class="muted">{{ streak === 1 ? 'day streak' : 'days streak' }}</span>
        </div>
      </div>

      <div v-if="perGame.length > 0" class="card">
        <h2>Time per game</h2>
        <ul class="bars">
          <li v-for="g in perGame" :key="g.id">
            <span class="bar-label">{{ nameOf(g.id) }}</span>
            <span class="bar"
              ><span class="fill" :style="{ width: `${(g.ms / maxMs) * 100}%` }"
            /></span>
            <span class="mono muted">{{ formatDuration(g.ms) }}</span>
          </li>
        </ul>
      </div>
    </template>

    <div v-for="s in sections" :key="s.game.id" class="card">
      <h2>
        {{ s.game.name }} <span class="muted mono small">{{ s.summary.headline }}</span>
      </h2>
      <dl v-if="s.summary.stats.length > 0" class="stat-list">
        <template v-for="row in s.summary.stats" :key="row.label">
          <dt class="muted">{{ row.label }}</dt>
          <dd class="mono">{{ row.value }}</dd>
        </template>
      </dl>
      <template v-if="s.rounds.length > 0">
        <TrendSparkline
          v-if="s.trend.points.length >= 2"
          :points="s.trend.points.map((p) => p.value)"
          :label="s.trend.kind === 'level' ? 'Highest level per day' : 'Average accuracy per day'"
        />
        <p v-else class="muted small">The trend appears after two days of play.</p>
        <p v-if="s.trend.points.length >= 2" class="muted small">
          {{ s.trend.kind === 'level' ? 'Highest level per day' : 'Average accuracy per day (%)' }}
          · last {{ s.trend.points.length }} days played
        </p>
      </template>
    </div>

    <div class="card">
      <h2>Major System</h2>
      <p class="mono">{{ total.cards }} flashcards answered</p>
      <RouterLink :to="{ name: 'major' }">Open your decks →</RouterLink>
    </div>

    <div v-if="recent.length > 0" class="card">
      <h2>Recent sessions</h2>
      <ul class="sessions">
        <li v-for="s in recent" :key="s.id">
          <RouterLink :to="{ name: 'session', params: { id: s.id } }">
            {{ new Date(s.startedAt).toLocaleDateString() }}
          </RouterLink>
          <span class="mono muted">{{ formatDuration(s.activeMs) }} · {{ s.rounds }} rounds</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-4);
}
.top {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}
.top h1 {
  font-size: var(--text-xl);
}
.card {
  margin: 0;
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.card h2 {
  font-size: var(--text-lg);
}
.card p {
  margin: 0;
}
.small {
  font-size: var(--text-sm);
  font-weight: 400;
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
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
  text-align: center;
  font-size: var(--text-sm);
}
.value {
  font-size: var(--text-lg);
  color: var(--accent);
}
.bars,
.sessions {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.bars li {
  display: grid;
  grid-template-columns: minmax(6rem, 9rem) 1fr auto;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-sm);
}
.bar {
  height: 0.5rem;
  background: var(--border);
  border-radius: 999px;
  overflow: hidden;
}
.fill {
  display: block;
  height: 100%;
  background: var(--accent);
}
.stat-list {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-1) var(--space-3);
  margin: 0;
  font-size: var(--text-sm);
}
.stat-list dd {
  margin: 0;
  text-align: right;
}
.sessions li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
