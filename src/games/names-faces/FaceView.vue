<script setup lang="ts">
import { computed } from 'vue'
import { EYE_COLORS, HAIR_COLORS, SKIN, type FaceSpec } from './faces'

/**
 * Draws one generated face (original SVG). Decorative: the card shows the
 * name, and screen readers get `describeFace()` from the parent.
 */
const props = defineProps<{ face: FaceSpec }>()

const skin = computed(() => SKIN[props.face.skin]!)
const hair = computed(() => HAIR_COLORS[props.face.hairColor]!)
const eye = computed(() => EYE_COLORS[props.face.eyeColor]!)
const brow = computed(() => (props.face.hairStyle === 0 ? '#3a2a20' : hair.value))

/** head geometry per face shape: [rx, ry, corner radius for 'square'] */
const head = computed(() => {
  switch (props.face.shape) {
    case 0:
      return { rx: 25, ry: 26, square: false }
    case 1:
      return { rx: 22, ry: 28, square: false }
    case 2:
      return { rx: 24, ry: 26, square: true }
    default:
      return { rx: 20, ry: 30, square: false }
  }
})
const top = computed(() => 52 - head.value.ry)
const chin = computed(() => 52 + head.value.ry)
const style = computed(() => props.face.hairStyle)
const longHair = computed(() => [6, 7, 11].includes(style.value))

/**
 * Hair shapes are computed from the head size, so every style fits every
 * face shape. L/R = head edges, T = top of the head.
 */
const hairBack = computed(() => {
  const L = 50 - head.value.rx
  const R = 50 + head.value.rx
  const T = top.value
  if (style.value === 7) {
    // long wavy: wavy sides and a wavy hem
    return `M${L - 6} 45 Q50 ${T - 14} ${R + 6} 45 q7 9 0 17 q-7 9 1 18 q7 8 1 13 L${L - 5} 93 q-7 -5 -1 -13 q8 -9 1 -18 q-7 -8 -1 -17 Z`
  }
  const hem = style.value === 11 ? 96 : 90
  return `M${L - 6} 45 Q50 ${T - 14} ${R + 6} 45 L${R + 7} ${hem} L${L - 7} ${hem} Z`
})

const hairFront = computed(() => {
  const L = 50 - head.value.rx
  const R = 50 + head.value.rx
  const T = top.value
  /** a cap that covers the scalp down to `side` on the temples, fringe at `fringe` */
  const cap = (side: number, peak: number, fringe: number, pad = 1) =>
    `M${L - pad} ${side} Q${L - pad} ${peak} 50 ${peak} Q${R + pad} ${peak} ${R + pad} ${side} Q50 ${fringe} ${L - pad} ${side} Z`
  switch (style.value) {
    case 1: // buzz cut: thin, close to the scalp
      return cap(46, T - 3, T + 6, 0)
    case 3: // side part: deep sweep across the forehead from the left
      return `M${L - 2} 50 Q${L - 3} ${T - 6} 52 ${T - 6} Q${R + 2} ${T - 6} ${R + 2} 46 Q${R - 2} ${T + 4} 56 ${T + 3} Q${L + 6} ${T + 8} ${L + 3} 52 Z`
    case 4: // curly short: bumps all along the top, scaled to the head
    case 11: {
      const x0 = L - 4
      const x1 = R + 4
      const n = 5
      const w = (x1 - x0) / n
      let d = `M${x0} 48 L${x0} ${T + 6}`
      for (let i = 0; i < n; i++) d += ` q${w / 2} -18 ${w} 0`
      return `${d} L${x1} 48 Q50 ${T + 10} ${x0} 48 Z`
    }
    case 5: // spiky
      return `M${L} 44 L${L + 3} ${T - 9} L${50 - 9} ${T + 1} L50 ${T - 12} L${50 + 9} ${T + 1} L${R - 3} ${T - 9} L${R} 44 Q50 ${T + 8} ${L} 44 Z`
    case 8: // bob: cap plus side panels over the ears
      return `M${L - 5} 67 L${L - 5} 46 Q${L - 5} ${T - 7} 50 ${T - 7} Q${R + 5} ${T - 7} ${R + 5} 46 L${R + 5} 67 L${R - 1} 67 L${R - 1} 48 Q50 ${T + 9} ${L + 1} 48 L${L + 1} 67 Z`
    default: // short, bun base, ponytail base, long styles' fringe
      return cap(48, T - 7, T + 8)
  }
})

/** stubble: a thin band along the jaw (not a crescent that reads as a grin) */
const stubble = computed(() => {
  const L = 50 - head.value.rx
  const R = 50 + head.value.rx
  return `M${L + 2} 57 Q${L + 3} ${chin.value + 1} 50 ${chin.value + 1} Q${R - 3} ${chin.value + 1} ${R - 2} 57 Q50 ${chin.value - 3} ${L + 2} 57 Z`
})
</script>

<template>
  <svg class="face" viewBox="0 0 100 100" aria-hidden="true">
    <!-- hair behind the head (long styles) -->
    <path v-if="longHair" :d="hairBack" :fill="hair" />
    <path
      v-if="style === 10"
      :d="`M${50 + head.rx - 4} 40 q14 6 10 34 q-6 -10 -12 -30 z`"
      :fill="hair"
    />
    <!-- neck and ears -->
    <rect x="42" :y="chin - 6" width="16" height="16" :fill="skin" />
    <ellipse :cx="50 - head.rx" cy="52" rx="4" ry="6" :fill="skin" />
    <ellipse :cx="50 + head.rx" cy="52" rx="4" ry="6" :fill="skin" />
    <template v-if="face.earrings">
      <circle class="earring" :cx="50 - head.rx" cy="60" r="2" fill="#e3b341" />
      <circle class="earring" :cx="50 + head.rx" cy="60" r="2" fill="#e3b341" />
    </template>
    <!-- head -->
    <rect
      v-if="head.square"
      :x="50 - head.rx"
      :y="top"
      :width="head.rx * 2"
      :height="head.ry * 2"
      rx="10"
      :fill="skin"
    />
    <ellipse v-else cx="50" cy="52" :rx="head.rx" :ry="head.ry" :fill="skin" />
    <!-- stubble / beard / moustache -->
    <path v-if="face.facialHair === 3" class="stubble" :d="stubble" :fill="hair" opacity="0.3" />
    <path
      v-if="face.facialHair === 1"
      class="beard"
      :d="`M${50 - head.rx + 1} 54 Q${50 - head.rx + 2} ${chin + 6} 50 ${chin + 6} Q${50 + head.rx - 2} ${chin + 6} ${50 + head.rx - 1} 54 Q50 70 ${50 - head.rx + 1} 54 Z`"
      :fill="hair"
    />
    <path
      v-if="face.facialHair === 1 || face.facialHair === 2"
      class="moustache"
      d="M41 65 Q50 60 59 65 Q50 63 41 65 Z"
      :fill="hair"
      stroke-width="2"
      :stroke="hair"
    />
    <!-- eyes and brows -->
    <ellipse cx="41" cy="50" rx="4.2" ry="3" fill="#fff" />
    <ellipse cx="59" cy="50" rx="4.2" ry="3" fill="#fff" />
    <circle cx="41" cy="50" r="2" :fill="eye" />
    <circle cx="59" cy="50" r="2" :fill="eye" />
    <path
      d="M36 44 Q41 41 46 44"
      fill="none"
      :stroke="brow"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <path
      d="M54 44 Q59 41 64 44"
      fill="none"
      :stroke="brow"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <!-- nose and mouth -->
    <path
      d="M50 52 L47.5 59 Q50 60.5 52.5 59"
      fill="none"
      stroke="rgb(0 0 0 / 0.25)"
      stroke-width="1.3"
    />
    <path
      v-if="face.facialHair !== 1"
      d="M44 66 Q50 70 56 66"
      fill="none"
      stroke="#8c3b3b"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <!-- freckles -->
    <g v-if="face.freckles" fill="rgb(120 60 30 / 0.45)">
      <circle cx="38" cy="57" r="0.9" />
      <circle cx="41" cy="58.5" r="0.9" />
      <circle cx="36" cy="59" r="0.9" />
      <circle cx="62" cy="57" r="0.9" />
      <circle cx="59" cy="58.5" r="0.9" />
      <circle cx="64" cy="59" r="0.9" />
    </g>
    <!-- glasses -->
    <g v-if="face.glasses" class="glasses" fill="none" stroke="#222" stroke-width="1.6">
      <circle cx="41" cy="50" r="6" />
      <circle cx="59" cy="50" r="6" />
      <path d="M47 50 Q50 48 53 50" />
    </g>
    <!-- hair on top (front) -->
    <template v-if="style !== 0">
      <circle v-if="style === 9" cx="50" :cy="top - 7" r="8" :fill="hair" />
      <path :d="hairFront" :fill="hair" :opacity="style === 1 ? 0.85 : 1" />
    </template>
  </svg>
</template>

<style scoped>
.face {
  width: 100%;
  height: auto;
  display: block;
}
</style>
