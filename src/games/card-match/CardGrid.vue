<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CardSymbol from './CardSymbol.vue'
import { SYMBOL_NAMES } from './symbols'

/**
 * The cards as native buttons with a roving tabindex: Tab enters the grid once,
 * arrow keys move between cards, Enter/Space flips via the browser's own click.
 */
const props = defineProps<{
  cards: number[]
  faceUp: boolean[]
  matched: boolean[]
  rows: number
  cols: number
  disabled?: boolean
}>()

const emit = defineEmits<{ flip: [index: number] }>()

/** Focus the current card (the roving tab stop). */
function focus() {
  buttons.value[active.value]?.focus()
}

// On narrow screens a wide grid is shown tall instead (rows and cols swap).
// Decided once per grid: re-flowing mid-round would move every card, which
// ruins a spatial-memory round (e.g. when a phone is rotated).
const narrow = ref(false)
onMounted(() => {
  if (typeof matchMedia === 'function') narrow.value = matchMedia('(max-width: 30rem)').matches
})

const columns = computed(() => (narrow.value && props.cols > props.rows ? props.rows : props.cols))

const active = ref(0)
const buttons = ref<HTMLButtonElement[]>([])

function label(i: number): string {
  const base = `Card ${i + 1}`
  if (!props.faceUp[i]) return `${base}, hidden`
  const name = SYMBOL_NAMES[props.cards[i]! % SYMBOL_NAMES.length]
  return props.matched[i] ? `${base}, ${name}, matched` : `${base}, ${name}`
}

function onKeydown(e: KeyboardEvent, i: number) {
  if (e.altKey || e.ctrlKey || e.metaKey) return // leave browser shortcuts alone
  const n = props.cards.length
  const c = columns.value
  const moves: Record<string, number> = {
    ArrowRight: (i % c) + 1 < c ? i + 1 : i,
    ArrowLeft: i % c > 0 ? i - 1 : i,
    ArrowDown: i + c < n ? i + c : i,
    ArrowUp: i - c >= 0 ? i - c : i,
  }
  const target = moves[e.key]
  if (target === undefined) return
  e.preventDefault()
  active.value = target
  buttons.value[target]?.focus()
}
defineExpose({ focus })
</script>

<template>
  <div
    class="grid"
    role="group"
    :aria-label="`${rows} by ${cols} cards`"
    :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }"
  >
    <button
      v-for="(card, i) in cards"
      :key="i"
      :ref="(el) => (buttons[i] = el as HTMLButtonElement)"
      type="button"
      class="card"
      :class="{ up: faceUp[i], matched: matched[i] }"
      :tabindex="i === active ? 0 : -1"
      :aria-label="label(i)"
      :aria-disabled="matched[i] ? 'true' : undefined"
      :disabled="disabled"
      @click="emit('flip', i)"
      @focus="active = i"
      @keydown="onKeydown($event, i)"
    >
      <CardSymbol v-if="faceUp[i]" :id="card" />
    </button>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  gap: var(--space-2);
  width: min(100%, 32rem);
}
.card {
  aspect-ratio: 1;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  touch-action: manipulation;
}
.card:not(.up) {
  background: repeating-linear-gradient(
    45deg,
    var(--surface),
    var(--surface) 6px,
    var(--surface-raised) 6px,
    var(--surface-raised) 12px
  );
}
.card.up {
  background: var(--bg);
  border-color: var(--text-muted);
}
.card.matched {
  opacity: 0.45;
  border-color: var(--accent-border);
}
</style>
