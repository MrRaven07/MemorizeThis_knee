<script setup lang="ts">
import { computed } from 'vue'

/** A tiny trend line (inline SVG, no library). Renders nothing with fewer than 2 points. */
const props = defineProps<{ points: number[]; label: string }>()

const polyline = computed(() => {
  const p = props.points
  const min = Math.min(...p)
  const max = Math.max(...p)
  return p
    .map((v, i) => {
      const x = p.length === 1 ? 0 : (i / (p.length - 1)) * 100
      const y = max === min ? 15 : 30 - ((v - min) / (max - min)) * 30
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`
    })
    .join(' ')
})

const aria = computed(
  () =>
    `${props.label}: from ${props.points[0]} to ${props.points.at(-1)} over ${props.points.length} days`,
)
</script>

<template>
  <svg
    v-if="points.length >= 2"
    class="sparkline"
    viewBox="-2 -2 104 34"
    preserveAspectRatio="none"
    role="img"
    :aria-label="aria"
  >
    <polyline
      :points="polyline"
      fill="none"
      stroke="var(--accent)"
      stroke-width="2"
      vector-effect="non-scaling-stroke"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>

<style scoped>
.sparkline {
  width: 100%;
  height: 2.5rem;
  display: block;
}
</style>
