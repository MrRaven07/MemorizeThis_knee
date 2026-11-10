<script setup lang="ts">
import { RouterLink } from 'vue-router'
import SessionClock from '@/components/SessionClock.vue'
import { games } from '@/games/registry'
import { useStatsStore } from '@/stores/stats'

const stats = useStatsStore()
</script>

<template>
  <section class="home">
    <header class="top">
      <h1 class="brand mono">memorize<span class="accent">_</span>this</h1>
      <SessionClock />
    </header>

    <p v-if="games.length === 0" class="muted">No games yet.</p>
    <nav v-else class="grid" aria-label="Games">
      <RouterLink
        v-for="game in games"
        :key="game.id"
        class="tile"
        :to="{ name: 'play', params: { gameId: game.id } }"
      >
        <span class="name">{{ game.name }}</span>
        <span class="tagline muted">{{ game.tagline }}</span>
        <span class="headline mono">{{ game.summarize(stats.roundsFor(game.id)).headline }}</span>
      </RouterLink>
    </nav>

    <footer class="links">
      <RouterLink :to="{ name: 'settings' }">Settings</RouterLink>
    </footer>
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-block: var(--space-4);
}
.top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}
.brand {
  font-size: var(--text-xl);
  color: var(--text);
}
.accent {
  color: var(--accent);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: var(--space-3);
}
.tile {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  text-decoration: none;
  transition: border-color var(--transition);
}
.tile:hover {
  border-color: var(--accent-border);
}
.name {
  font-weight: 600;
}
.tagline {
  font-size: var(--text-sm);
  flex: 1;
}
.headline {
  color: var(--accent);
  font-size: var(--text-sm);
}
.links {
  display: flex;
  gap: var(--space-4);
  font-size: var(--text-sm);
}
</style>
