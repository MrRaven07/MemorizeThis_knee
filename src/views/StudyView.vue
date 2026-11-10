<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { progressOf } from '@/features/major/deck'
import {
  createSmartSession,
  nextSmart,
  recordSmart,
  shuffleOrder,
} from '@/features/major/scheduler'
import type { Card, Direction } from '@/features/major/types'
import { useDecksStore } from '@/stores/decks'
import { useSessionStore } from '@/stores/session'

/**
 * Flashcard study: see the prompt, recall the answer in your head, flip, and
 * mark yourself honestly. Nothing is typed (spec §6.6).
 */
const props = defineProps<{
  deckId: string
  mode: 'smart' | 'shuffle'
  dir: Direction
  rng?: Rng
}>()

const decks = useDecksStore()
const session = useSessionStore()
const rng = props.rng ?? createRng()

const deck = computed(() => decks.getDeck(props.deckId))
// The pick selection is read once, when the study session starts.
const selection = decks.studySelection
const ids: string[] = (deck.value?.cards ?? [])
  .filter((c) => !selection || selection.includes(c.id))
  .map((c) => c.id)

const flipped = ref(false)
const shown = ref(0)
const knew = ref(0)
const missed = ref(0)
const roundKnew = ref(0)
const roundMissed = ref(0)

let smart = createSmartSession()
const order = ref<string[]>(props.mode === 'shuffle' ? shuffleOrder(rng, ids) : [])
const pos = ref(0)
const currentId = ref<string | null>(null)

const done = computed(() => props.mode === 'shuffle' && pos.value >= order.value.length)
const card = computed<Card | undefined>(() =>
  deck.value?.cards.find((c) => c.id === currentId.value),
)
const promptText = computed(() =>
  card.value ? (props.dir === 'forward' ? card.value.input : card.value.output) : '',
)
const answerText = computed(() =>
  card.value ? (props.dir === 'forward' ? card.value.output : card.value.input) : '',
)

function draw() {
  flipped.value = false
  if (ids.length === 0 || !deck.value) {
    currentId.value = null
    return
  }
  if (props.mode === 'smart') {
    const d = deck.value
    currentId.value = nextSmart(smart, ids, (id) => progressOf(d, props.dir, id).box)
  } else {
    currentId.value = order.value[pos.value] ?? null
  }
}

function flip() {
  if (currentId.value) flipped.value = true
}

function answer(didKnow: boolean) {
  const id = currentId.value
  if (!id || !flipped.value) return
  decks.recordAnswer(props.deckId, props.dir, id, didKnow)
  shown.value++
  if (didKnow) {
    knew.value++
    roundKnew.value++
  } else {
    missed.value++
    roundMissed.value++
  }
  if (props.mode === 'smart') {
    smart = recordSmart(smart, id, didKnow, ids.length)
  } else {
    pos.value++
  }
  draw()
}

function again() {
  order.value = shuffleOrder(rng, ids)
  pos.value = 0
  roundKnew.value = 0
  roundMissed.value = 0
  draw()
}

draw()

useGameKeys((e) => {
  if (done.value || !currentId.value) return
  if (!flipped.value && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    flip()
  } else if (flipped.value && (e.key === 'ArrowRight' || e.key.toLowerCase() === 'k')) {
    e.preventDefault()
    answer(true)
  } else if (flipped.value && (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'd')) {
    e.preventDefault()
    answer(false)
  }
})

onMounted(() => session.beginActivity('major'))
onUnmounted(() => session.endActivity())
</script>

<template>
  <section class="study">
    <header class="top">
      <RouterLink :to="{ name: 'deck', params: { deckId } }">← Done</RouterLink>
      <span class="counter mono muted">
        this session: {{ shown }} · knew {{ knew }} · missed {{ missed }}
      </span>
    </header>

    <div v-if="ids.length === 0" class="empty">
      <p>No cards selected.</p>
      <RouterLink :to="{ name: 'deck', params: { deckId } }">Back to the deck</RouterLink>
    </div>

    <div v-else-if="done" class="summary">
      <p class="mono">You knew {{ roundKnew }} of {{ roundKnew + roundMissed }}.</p>
      <button type="button" class="primary again" @click="again">Again</button>
    </div>

    <div v-else-if="card" class="flashcard">
      <p class="label muted">
        {{ dir === 'forward' ? 'Recall the answer for' : 'Recall the input for' }}
      </p>
      <p class="prompt mono">{{ promptText }}</p>
      <template v-if="!flipped">
        <button type="button" class="primary flip" @click="flip">Flip</button>
        <p class="hint muted">Space to flip</p>
      </template>
      <template v-else>
        <p class="answer">{{ answerText }}</p>
        <div class="row">
          <button type="button" class="missed" @click="answer(false)">✗ Didn't</button>
          <button type="button" class="primary knew" @click="answer(true)">✓ Knew it</button>
        </div>
        <p class="hint muted">← or d · → or k</p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.study {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-block: var(--space-4);
  flex: 1;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.counter {
  font-size: var(--text-sm);
}
.flashcard,
.summary,
.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  text-align: center;
}
.flashcard p,
.summary p,
.empty p {
  margin: 0;
}
.label,
.hint {
  font-size: var(--text-sm);
}
.prompt {
  font-size: var(--text-display);
  word-break: break-word;
}
.answer {
  font-size: var(--text-xl);
  color: var(--accent);
  word-break: break-word;
}
.row {
  display: flex;
  gap: var(--space-3);
}
.row button,
.flip,
.again {
  min-width: 8rem;
  padding: var(--space-3) var(--space-5);
}
.missed {
  border-color: var(--danger);
  color: var(--danger);
}
</style>
