<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { deckStats } from '@/features/major/stats'
import { useDecksStore } from '@/stores/decks'

const decks = useDecksStore()
const router = useRouter()
const name = ref('')

function create() {
  const d = decks.createDeck(name.value)
  name.value = ''
  router.push({ name: 'deck', params: { deckId: d.id } })
}

function knownPct(id: string): string {
  const d = decks.getDeck(id)
  if (!d || d.cards.length === 0) return '—'
  const s = deckStats(d, 'forward')
  return `${Math.round((s.knownWell / s.total) * 100)}% known`
}
</script>

<template>
  <section class="major">
    <header class="top">
      <RouterLink :to="{ name: 'home' }">← Home</RouterLink>
      <h1>Major System</h1>
    </header>
    <p class="muted intro">
      Your own number → word flashcards (or any input → output pairs, in any language). Look at the
      card, recall the answer in your head, flip, and be honest.
    </p>

    <div v-if="decks.decks.length === 0" class="card empty">
      <h2>No decks yet</h2>
      <p>Create a deck, then paste your list — one pair per line:</p>
      <pre class="mono example">
00 - sos
01 - sat
02 - sanie
03 - zeamă
04 - sare
05 - solz</pre>
      <p class="muted">CSV (<code>input,output</code>) and JSON files work too.</p>
    </div>

    <ul v-else class="deck-list">
      <li v-for="d in decks.decks" :key="d.id">
        <RouterLink class="deck-link" :to="{ name: 'deck', params: { deckId: d.id } }">
          <span class="name">{{ d.name }}</span>
          <span class="muted mono">{{ d.cards.length }} cards · {{ knownPct(d.id) }}</span>
        </RouterLink>
      </li>
    </ul>

    <form class="new-deck card" @submit.prevent="create">
      <label for="deck-name">New deck</label>
      <div class="row">
        <input
          id="deck-name"
          v-model="name"
          name="deck-name"
          placeholder="e.g. Major 00–99 RO"
          autocomplete="off"
        />
        <button type="submit" class="primary">Create</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.major {
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
.intro {
  margin: 0;
}
.card {
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.card p,
.card h2 {
  margin: 0;
}
.card h2 {
  font-size: var(--text-lg);
}
.example {
  margin: 0;
  padding: var(--space-3);
  background: var(--bg);
  border-radius: var(--radius-sm);
}
.deck-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.deck-link {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  text-decoration: none;
}
.deck-link:hover {
  border-color: var(--accent-border);
}
.name {
  font-weight: 600;
}
.row {
  display: flex;
  gap: var(--space-2);
}
.row input {
  flex: 1;
  min-width: 0;
}
</style>
