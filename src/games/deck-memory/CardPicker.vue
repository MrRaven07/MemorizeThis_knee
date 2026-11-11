<script setup lang="ts">
import { ref } from 'vue'
import { CARD_COUNT, cardName, cardRank, cardSuit, isRed } from './cards'

/**
 * All 52 cards as buttons (4 suit rows × 13 ranks) with a roving tabindex.
 * Used cards are aria-disabled (not `disabled`, which would drop keyboard
 * focus) and ignore clicks, so a card can never be picked twice.
 */
const props = defineProps<{ used: number[] }>()
const emit = defineEmits<{ pick: [id: number] }>()

const COLUMNS = 13
const ids = Array.from({ length: CARD_COUNT }, (_, i) => i)
const active = ref(0)
const buttons = ref<HTMLButtonElement[]>([])

function onKeydown(e: KeyboardEvent, i: number) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const moves: Record<string, number> = {
    ArrowRight: (i % COLUMNS) + 1 < COLUMNS ? i + 1 : i,
    ArrowLeft: i % COLUMNS > 0 ? i - 1 : i,
    ArrowDown: i + COLUMNS < CARD_COUNT ? i + COLUMNS : i,
    ArrowUp: i - COLUMNS >= 0 ? i - COLUMNS : i,
  }
  const target = moves[e.key]
  if (target === undefined) return
  e.preventDefault()
  active.value = target
  buttons.value[target]?.focus()
}
</script>

<template>
  <div class="picker" role="group" aria-label="Pick the next card">
    <button
      v-for="id in ids"
      :key="id"
      :ref="(el) => (buttons[id] = el as HTMLButtonElement)"
      type="button"
      class="pick"
      :class="[isRed(id) ? 'red' : 'black', { used: props.used.includes(id) }]"
      :aria-disabled="props.used.includes(id) ? 'true' : undefined"
      :tabindex="id === active ? 0 : -1"
      :aria-label="cardName(id)"
      @click="!props.used.includes(id) && emit('pick', id)"
      @focus="active = id"
      @keydown="onKeydown($event, id)"
    >
      {{ cardRank(id).label }}<span class="suit">{{ cardSuit(id).symbol }}</span>
    </button>
  </div>
</template>

<style scoped>
.picker {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 2px;
}
.pick {
  padding: 0.35rem 0;
  min-width: 0;
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  font-size: clamp(0.55rem, 2.6vw, 0.9rem);
  line-height: 1.1;
  background: var(--card-face);
  border: 1px solid var(--border);
  border-radius: 3px;
  display: flex;
  flex-direction: column;
  align-items: center;
  touch-action: manipulation;
}
.pick.red {
  color: var(--suit-red);
}
.pick.black {
  color: var(--suit-black);
}
.pick.used {
  /* still focusable (aria-disabled), so the roving keyboard focus never gets lost */
  opacity: 0.2;
  cursor: default;
}
.suit {
  font-size: 1.05em;
}
</style>
