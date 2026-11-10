<script setup lang="ts">
import { computed } from 'vue'
import { SYMBOLS } from './symbols'

const props = defineProps<{ id: number }>()

const symbol = computed(() => SYMBOLS[props.id % SYMBOLS.length]!)
const color = computed(() => `var(--sym-${(props.id % 6) + 1})`)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- static, trusted markup from symbols.ts -->
  <svg
    class="symbol"
    :data-symbol="id"
    viewBox="0 0 24 24"
    aria-hidden="true"
    :style="{ color }"
    fill="currentColor"
    v-html="symbol.svg"
  />
</template>

<style scoped>
.symbol {
  width: 62%;
  height: 62%;
}
</style>
