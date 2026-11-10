<script setup lang="ts">
import { computed } from 'vue'
import type { Plate, PlateFormat } from './formats'

/** One license plate drawn in CSS — no car, no photo. Width scales; never wider than its container. */
const props = withDefaults(defineProps<{ plate: Plate; format: PlateFormat; scale?: number }>(), {
  scale: 1,
})

const style = computed(() => ({
  width: `calc(var(--plate-base-width) * ${props.scale})`,
  maxWidth: '100%',
  aspectRatio: String(props.format.style.aspect),
  background: props.format.style.background,
  color: props.format.style.foreground,
  fontFamily: props.format.style.fontFamily,
}))

// 12 stars in a ring, like the EU flag
const stars = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2
  return { x: 10 + Math.cos(a) * 6, y: 10 + Math.sin(a) * 6 }
})
</script>

<template>
  <div class="plate" :style="style" :aria-label="`License plate ${plate.text}`" role="img">
    <div class="band" :style="{ background: format.style.bandColor }">
      <svg v-if="format.style.bandStars" class="stars" viewBox="0 0 20 20" aria-hidden="true">
        <circle v-for="(s, i) in stars" :key="i" :cx="s.x" :cy="s.y" r="1.1" fill="#ffcc00" />
      </svg>
      <span class="label">{{ format.style.bandLabel }}</span>
    </div>
    <div class="chars">
      <span v-for="(seg, i) in plate.segments" :key="i" class="seg">{{ seg }}</span>
    </div>
  </div>
</template>

<style scoped>
.plate {
  --plate-base-width: 15rem;
  container-type: inline-size;
  display: flex;
  align-items: stretch;
  border: 2px solid #111;
  border-radius: 0.4rem;
  overflow: hidden;
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.4) inset;
  user-select: none;
}
.band {
  width: 11cqw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2cqw;
  color: #fff;
}
.stars {
  width: 7cqw;
  height: 7cqw;
}
.label {
  font-size: 7cqw;
  font-weight: 600;
  line-height: 1;
}
.chars {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5cqw;
  font-size: 17cqw;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
}
</style>
