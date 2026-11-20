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
</script>

<template>
  <svg class="face" viewBox="0 0 100 100" aria-hidden="true">
    <!-- hair behind the head (long styles) -->
    <path
      v-if="longHair"
      :d="`M${50 - head.rx - 6} 45 Q50 ${top - 14} ${50 + head.rx + 6} 45 L${50 + head.rx + 8} ${style === 7 ? 92 : 88} Q50 ${style === 11 ? 98 : 94} ${50 - head.rx - 8} ${style === 7 ? 92 : 88} Z`"
      :fill="hair"
    />
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
    <path
      v-if="face.facialHair === 3"
      :d="`M${50 - head.rx + 3} 58 Q50 ${chin + 4} ${50 + head.rx - 3} 58 Q50 ${chin - 6} ${50 - head.rx + 3} 58 Z`"
      :fill="hair"
      opacity="0.35"
    />
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
      <path
        v-if="style === 1"
        :d="`M${50 - head.rx + 1} 40 Q50 ${top - 3} ${50 + head.rx - 1} 40 Q50 ${top + 4} ${50 - head.rx + 1} 40 Z`"
        :fill="hair"
        opacity="0.85"
      />
      <path
        v-else-if="style === 5"
        :d="`M${50 - head.rx} 42 L${50 - head.rx + 4} ${top - 8} L${50 - 8} ${top + 2} L50 ${top - 10} L${50 + 8} ${top + 2} L${50 + head.rx - 4} ${top - 8} L${50 + head.rx} 42 Q50 ${top + 8} ${50 - head.rx} 42 Z`"
        :fill="hair"
      />
      <path
        v-else-if="style === 4 || style === 11"
        :d="`M${50 - head.rx - 3} 46 q-2 -12 6 -18 q2 -10 12 -8 q8 -8 16 0 q10 -2 12 8 q8 6 6 18 Q50 ${top + 8} ${50 - head.rx - 3} 46 Z`"
        :fill="hair"
      />
      <path
        v-else-if="style === 3"
        :d="`M${50 - head.rx - 1} 46 Q${50 - head.rx} ${top - 4} 56 ${top - 3} Q${50 + head.rx + 2} ${top} ${50 + head.rx + 1} 46 Q${50 + 4} ${top + 6} 44 ${top + 10} Q${50 - head.rx + 4} ${top + 10} ${50 - head.rx - 1} 46 Z`"
        :fill="hair"
      />
      <path
        v-else-if="style === 8"
        :d="`M${50 - head.rx - 4} 66 L${50 - head.rx - 4} 44 Q50 ${top - 8} ${50 + head.rx + 4} 44 L${50 + head.rx + 4} 66 L${50 + head.rx - 2} 66 L${50 + head.rx - 2} 46 Q50 ${top + 8} ${50 - head.rx + 2} 46 L${50 - head.rx + 2} 66 Z`"
        :fill="hair"
      />
      <template v-else-if="style === 9">
        <circle cx="50" :cy="top - 6" r="8" :fill="hair" />
        <path
          :d="`M${50 - head.rx} 44 Q50 ${top - 6} ${50 + head.rx} 44 Q50 ${top + 5} ${50 - head.rx} 44 Z`"
          :fill="hair"
        />
      </template>
      <path
        v-else
        :d="`M${50 - head.rx - 1} 46 Q${50 - head.rx} ${top - 6} 50 ${top - 5} Q${50 + head.rx} ${top - 6} ${50 + head.rx + 1} 46 Q50 ${top + 7} ${50 - head.rx - 1} 46 Z`"
        :fill="hair"
      />
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
