<script setup lang="ts">
import { computed } from 'vue'

/** A bar that shrinks as time runs out. `progress` is 0..1 elapsed (from useCountdown). */
const props = defineProps<{ progress: number }>()

const remainingPct = computed(() =>
  Math.round((1 - Math.min(1, Math.max(0, props.progress))) * 100),
)
</script>

<template>
  <div
    class="timer-bar"
    role="progressbar"
    aria-label="Time left"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="remainingPct"
  >
    <div class="fill" :style="{ transform: `scaleX(${remainingPct / 100})` }" />
  </div>
</template>

<style scoped>
.timer-bar {
  width: 100%;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--accent);
  transform-origin: left center;
}
</style>
