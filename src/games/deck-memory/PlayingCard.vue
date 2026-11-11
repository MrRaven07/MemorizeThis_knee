<script setup lang="ts">
import { computed } from 'vue'
import { cardName, cardRank, cardSuit, isRed } from './cards'

/** One playing card, drawn in CSS (original design). Rank and suit are always shown. */
const props = withDefaults(defineProps<{ id: number; size?: 'sm' | 'md' | 'lg' }>(), {
  size: 'md',
})

const rank = computed(() => cardRank(props.id).label)
const suit = computed(() => cardSuit(props.id).symbol)
</script>

<template>
  <div
    class="playing-card"
    :class="[isRed(id) ? 'red' : 'black', size]"
    role="img"
    :aria-label="cardName(id)"
  >
    <span class="corner top" aria-hidden="true">{{ rank }}<br />{{ suit }}</span>
    <span class="center" aria-hidden="true">{{ size === 'sm' ? `${rank}${suit}` : suit }}</span>
    <span class="corner bottom" aria-hidden="true">{{ rank }}<br />{{ suit }}</span>
  </div>
</template>

<style scoped>
.playing-card {
  position: relative;
  aspect-ratio: 5 / 7;
  background: var(--card-face);
  border-radius: 0.45em;
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.35),
    0 2px 6px rgb(0 0 0 / 0.35);
  font-family: Georgia, 'Times New Roman', serif;
  font-weight: 700;
  user-select: none;
  flex-shrink: 0;
}
.playing-card.red {
  color: var(--suit-red);
}
.playing-card.black {
  color: var(--suit-black);
}
.sm {
  width: 2.4rem;
  font-size: 0.6rem;
}
.md {
  width: 4.5rem;
  font-size: 0.95rem;
}
.lg {
  width: min(11rem, 55vw);
  font-size: 1.6rem;
}
.corner {
  position: absolute;
  line-height: 1;
  text-align: center;
}
.top {
  top: 0.35em;
  left: 0.35em;
}
.bottom {
  bottom: 0.35em;
  right: 0.35em;
  transform: rotate(180deg);
}
.center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.6em;
}
.sm .center {
  font-size: 1.15em;
}
.sm .corner {
  display: none;
}
</style>
