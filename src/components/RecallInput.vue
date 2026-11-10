<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'

/** Big monospace answer field. Enter submits. Opens the number keyboard on phones by default. */
const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    inputmode?: 'numeric' | 'text'
    placeholder?: string
    /** focus on mount (turn off for all but the first of several inputs) */
    autofocus?: boolean
  }>(),
  { inputmode: 'numeric', placeholder: '', autofocus: true },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()

const input = useTemplateRef<HTMLInputElement>('input')
onMounted(() => {
  if (props.autofocus) input.value?.focus()
})

defineExpose({ focus: () => input.value?.focus() })

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    emit('submit')
  }
}
</script>

<template>
  <label class="recall">
    <span class="label muted">{{ label }}</span>
    <input
      ref="input"
      class="mono"
      type="text"
      :inputmode="inputmode"
      :placeholder="placeholder"
      :value="modelValue"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown="onKeydown"
    />
  </label>
</template>

<style scoped>
.recall {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}
.label {
  font-size: var(--text-sm);
}
input {
  width: 100%;
  font-size: var(--text-xl);
  letter-spacing: 0.15em;
  text-align: center;
  padding: var(--space-3);
}
</style>
