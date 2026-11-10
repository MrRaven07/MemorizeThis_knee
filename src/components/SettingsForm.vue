<script setup lang="ts">
import { sanitizeSettings } from '@/games/settings'
import type { GameSettings, SettingField } from '@/games/types'

/** Renders a game's settings from its field list. Emits only sanitized values. */
const props = defineProps<{
  fields: SettingField[]
  modelValue: GameSettings
  defaults: GameSettings
}>()

const emit = defineEmits<{ 'update:modelValue': [value: GameSettings] }>()

function update(key: string, raw: unknown, el?: HTMLInputElement | HTMLSelectElement) {
  const next = sanitizeSettings({ ...props.modelValue, [key]: raw }, props.defaults, props.fields)
  // Show the corrected value even when it equals the previous one (no re-render then).
  if (el) el.value = String(next[key])
  emit('update:modelValue', next)
}
</script>

<template>
  <form class="settings" @submit.prevent>
    <div v-for="field in fields" :key="field.key" class="field">
      <template v-if="field.type === 'boolean'">
        <label class="check">
          <input
            type="checkbox"
            :name="field.key"
            :checked="Boolean(modelValue[field.key])"
            @change="update(field.key, ($event.target as HTMLInputElement).checked)"
          />
          {{ field.label }}
        </label>
      </template>
      <template v-else>
        <label :for="`setting-${field.key}`">
          {{ field.label }}
          <span v-if="field.type === 'number' && field.unit" class="muted">({{ field.unit }})</span>
        </label>
        <input
          v-if="field.type === 'number'"
          :id="`setting-${field.key}`"
          class="mono"
          type="number"
          inputmode="decimal"
          :name="field.key"
          :min="field.min"
          :max="field.max"
          :step="field.step ?? 1"
          :value="modelValue[field.key]"
          @change="
            update(field.key, ($event.target as HTMLInputElement).value, $event.target as HTMLInputElement)
          "
        />
        <select
          v-else
          :id="`setting-${field.key}`"
          :name="field.key"
          :value="modelValue[field.key]"
          @change="
            update(field.key, ($event.target as HTMLSelectElement).value, $event.target as HTMLSelectElement)
          "
        >
          <option v-for="o in field.options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </template>
      <small v-if="field.help" class="muted">{{ field.help }}</small>
    </div>
  </form>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.field label {
  font-size: var(--text-sm);
}
.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
