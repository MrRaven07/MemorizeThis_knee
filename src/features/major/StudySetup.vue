<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDecksStore } from '@/stores/decks'
import { parseSelection, type SelectionProblem } from './selection'
import type { Deck, Direction } from './types'

/** Choose how to study: smart / shuffle / pick (a subset), and the direction. */
const props = defineProps<{ deck: Deck }>()
const decks = useDecksStore()
const router = useRouter()

const mode = ref<'smart' | 'shuffle' | 'pick'>('smart')
const pickOrder = ref<'smart' | 'shuffle'>('smart')
const dir = ref<Direction>('forward')
const picked = ref<string[]>([])
const range = ref('')
const problems = ref<SelectionProblem[]>([])

const canStart = computed(
  () => props.deck.cards.length > 0 && (mode.value !== 'pick' || picked.value.length > 0),
)

function applyRange() {
  const r = parseSelection(range.value, props.deck.cards)
  problems.value = r.problems
  picked.value = r.ids
}

function selectAll(on: boolean) {
  picked.value = on ? props.deck.cards.map((c) => c.id) : []
}

function start() {
  if (!canStart.value) return
  decks.studySelection = mode.value === 'pick' ? [...picked.value] : null
  router.push({
    name: 'study',
    params: { deckId: props.deck.id },
    query: { mode: mode.value === 'pick' ? pickOrder.value : mode.value, dir: dir.value },
  })
}
</script>

<template>
  <div class="setup">
    <fieldset>
      <legend>Order</legend>
      <label
        ><input v-model="mode" type="radio" value="smart" /> Smart — missed cards come back
        sooner</label
      >
      <label><input v-model="mode" type="radio" value="shuffle" /> Shuffle — every card once</label>
      <label><input v-model="mode" type="radio" value="pick" /> Pick cards…</label>
    </fieldset>

    <fieldset>
      <legend>Direction</legend>
      <label><input v-model="dir" type="radio" value="forward" /> Show input → recall output</label>
      <label><input v-model="dir" type="radio" value="reverse" /> Show output → recall input</label>
    </fieldset>

    <div v-if="mode === 'pick'" class="pick">
      <div class="row">
        <input
          v-model="range"
          name="range"
          class="mono"
          placeholder="e.g. 30-49, 00-09, 77"
          autocomplete="off"
          @keydown.enter.prevent="applyRange"
        />
        <button type="button" class="apply-range" @click="applyRange">Select</button>
      </div>
      <p v-if="problems.length > 0" class="range-problems" role="alert">
        <span v-for="p in problems" :key="p.item"
          >“{{ p.item }}” {{ p.reason === 'invalid' ? 'is not a valid range' : 'matches no card' }}.
        </span>
      </p>
      <div class="row small">
        <button type="button" @click="selectAll(true)">Select all</button>
        <button type="button" @click="selectAll(false)">None</button>
        <span class="muted">{{ picked.length }} selected</span>
      </div>
      <ul class="checklist">
        <li v-for="c in deck.cards" :key="c.id">
          <label class="mono">
            <input v-model="picked" class="pick-card" type="checkbox" :value="c.id" />
            {{ c.input }} → {{ c.output }}
          </label>
        </li>
      </ul>
      <fieldset>
        <legend>Then study them in</legend>
        <label><input v-model="pickOrder" type="radio" value="smart" /> smart order</label>
        <label><input v-model="pickOrder" type="radio" value="shuffle" /> shuffled</label>
      </fieldset>
    </div>

    <button type="button" class="primary start-study" :disabled="!canStart" @click="start">
      Study
    </button>
  </div>
</template>

<style scoped>
.setup {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
fieldset {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.pick {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  flex-wrap: wrap;
}
.row input {
  flex: 1;
  min-width: 0;
}
.small {
  font-size: var(--text-sm);
}
.range-problems {
  margin: 0;
  color: var(--warning);
  font-size: var(--text-sm);
}
.checklist {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  max-height: 14rem;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: var(--space-1);
  font-size: var(--text-sm);
}
.start-study {
  align-self: flex-start;
  min-width: 10rem;
  padding: var(--space-3) var(--space-5);
}
</style>
