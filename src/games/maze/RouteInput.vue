<script setup lang="ts">
import { computed, onMounted, useTemplateRef } from 'vue'
import { DIR_ARROW, KEYMAPS, parseRoute, type Dir, type MazeKeys } from './logic'

/**
 * Type a route with WASD or 1234. Other characters are dropped as you type.
 * The pad works by touch and never steals focus from the input.
 */
const props = defineProps<{ modelValue: string; keys: MazeKeys }>()
const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>()

const input = useTemplateRef<HTMLInputElement>('input')
onMounted(() => input.value?.focus())

const keyFor = computed(() => {
  const out = {} as Record<Dir, string>
  for (const [k, d] of Object.entries(KEYMAPS[props.keys])) out[d] = k
  return out
})
const moves = computed(() => parseRoute(props.modelValue, props.keys))

function filter(raw: string): string {
  const map = KEYMAPS[props.keys]
  return Array.from(raw.toLowerCase())
    .filter((ch) => ch in map)
    .join('')
}

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const clean = filter(el.value)
  el.value = clean
  emit('update:modelValue', clean)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('submit')
  }
}

function add(d: Dir) {
  emit('update:modelValue', props.modelValue + keyFor.value[d])
}
function back() {
  emit('update:modelValue', props.modelValue.slice(0, -1))
}

const pad: { dir: Dir; cls: string }[] = [
  { dir: 'up', cls: 'pad-up' },
  { dir: 'left', cls: 'pad-left' },
  { dir: 'down', cls: 'pad-down' },
  { dir: 'right', cls: 'pad-right' },
]
</script>

<template>
  <div class="route-input">
    <label class="field">
      <span class="muted label">Your route</span>
      <input
        ref="input"
        class="route mono"
        type="text"
        :inputmode="keys === '1234' ? 'numeric' : 'text'"
        :value="modelValue"
        autocomplete="off"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        @input="onInput"
        @keydown="onKeydown"
      />
    </label>
    <p class="arrows mono" aria-live="polite">
      <span v-for="(m, i) in moves" :key="i" class="arrow">{{ DIR_ARROW[m] }}</span>
      <span v-if="moves.length === 0" class="muted">no moves yet</span>
    </p>
    <div class="pad">
      <button
        v-for="p in pad"
        :key="p.dir"
        type="button"
        :class="p.cls"
        :aria-label="`${p.dir} (${keyFor[p.dir]})`"
        @pointerdown.prevent
        @click="add(p.dir)"
      >
        {{ DIR_ARROW[p.dir] }} <small class="muted">{{ keyFor[p.dir] }}</small>
      </button>
      <button
        type="button"
        class="pad-back"
        aria-label="Undo last move"
        @pointerdown.prevent
        @click="back"
      >
        ⌫
      </button>
      <button
        type="button"
        class="pad-ok primary"
        aria-label="Check route"
        @pointerdown.prevent
        @click="emit('submit')"
      >
        ✓
      </button>
    </div>
  </div>
</template>

<style scoped>
.route-input {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.field {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.label {
  font-size: var(--text-sm);
}
.route {
  width: 100%;
  font-size: var(--text-xl);
  letter-spacing: 0.15em;
  text-align: center;
  padding: var(--space-3);
}
.arrows {
  min-height: 1.75rem;
  margin: 0;
  font-size: var(--text-lg);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.15em;
  word-break: break-all;
}
.arrow {
  color: var(--accent);
}
.pad {
  display: grid;
  grid-template-columns: repeat(3, 3.5rem);
  grid-template-areas:
    'back up ok'
    'left down right';
  gap: var(--space-2);
}
.pad button {
  height: 3rem;
  font-size: var(--text-lg);
  touch-action: manipulation;
}
.pad small {
  font-size: var(--text-sm);
}
.pad-up {
  grid-area: up;
}
.pad-left {
  grid-area: left;
}
.pad-down {
  grid-area: down;
}
.pad-right {
  grid-area: right;
}
.pad-back {
  grid-area: back;
}
.pad-ok {
  grid-area: ok;
}
</style>
