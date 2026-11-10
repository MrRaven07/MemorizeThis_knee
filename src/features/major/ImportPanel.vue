<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDecksStore } from '@/stores/decks'
import { planImport } from './deck'
import { parseAuto } from './parse'
import type { Deck } from './types'

/** Paste or load a file → preview (new / changed / errors) → apply. Nothing is written before Apply. */
const props = defineProps<{ deck: Deck }>()
const decks = useDecksStore()

const text = ref('')
const filename = ref<string | undefined>(undefined)
const mode = ref<'replace' | 'keep'>('replace')
const message = ref('')

const plan = computed(() =>
  text.value.trim() === '' ? null : planImport(props.deck, parseAuto(text.value, filename.value)),
)
const canApply = computed(
  () =>
    plan.value !== null &&
    plan.value.errors.length === 0 &&
    plan.value.added.length + plan.value.changed.length > 0,
)

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  filename.value = file.name
  text.value = await file.text()
}

function onPaste(v: string) {
  filename.value = undefined
  text.value = v
}

function apply() {
  if (!plan.value || !canApply.value) return
  const p = plan.value
  decks.applyImport(props.deck.id, p, mode.value)
  const changed = mode.value === 'replace' ? p.changed.length : 0
  message.value = `Imported: ${p.added.length} new, ${changed} changed.`
  text.value = ''
  filename.value = undefined
}

function cancel() {
  text.value = ''
  filename.value = undefined
  message.value = ''
}
</script>

<template>
  <div class="import">
    <label class="file-button">
      Load a file (.csv, .json, .txt)…
      <input
        type="file"
        accept=".csv,.json,.txt,text/csv,application/json,text/plain"
        class="visually-hidden"
        @change="onFile"
      />
    </label>
    <label for="paste" class="muted small">…or paste pairs, one per line (00 - sos)</label>
    <textarea
      id="paste"
      name="paste"
      class="mono"
      rows="5"
      spellcheck="false"
      :value="filename ? '' : text"
      :placeholder="filename ? `Loaded ${filename}` : '00 - sos\n01 - sat'"
      @input="onPaste(($event.target as HTMLTextAreaElement).value)"
    />

    <div v-if="plan" class="import-preview">
      <p class="mono">
        {{ plan.added.length }} new · {{ plan.changed.length }} changed · {{ plan.unchanged }}
        unchanged
      </p>
      <ul v-if="plan.errors.length > 0" class="import-errors" role="alert">
        <li v-for="(e, i) in plan.errors" :key="i">line {{ e.line }}: {{ e.message }}</li>
      </ul>
      <fieldset v-if="plan.changed.length > 0" class="conflicts">
        <legend>Some inputs already exist with a different answer:</legend>
        <ul class="changes mono">
          <li v-for="c in plan.changed.slice(0, 5)" :key="c.id">
            {{ c.input }}: {{ c.from }} → {{ c.to }}
          </li>
          <li v-if="plan.changed.length > 5" class="muted">
            …and {{ plan.changed.length - 5 }} more
          </li>
        </ul>
        <label><input v-model="mode" type="radio" value="replace" /> Replace existing</label>
        <label><input v-model="mode" type="radio" value="keep" /> Keep existing</label>
      </fieldset>
      <div class="row">
        <button type="button" class="primary apply-import" :disabled="!canApply" @click="apply">
          Apply import
        </button>
        <button type="button" @click="cancel">Cancel</button>
      </div>
    </div>
    <p v-if="message" class="muted small" role="status">{{ message }}</p>
  </div>
</template>

<style scoped>
.import {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.small {
  font-size: var(--text-sm);
}
textarea {
  width: 100%;
  font: inherit;
  font-family: var(--font-mono);
  color: var(--text);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  resize: vertical;
}
.file-button {
  align-self: flex-start;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.file-button:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.import-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.import-preview p {
  margin: 0;
}
.import-errors {
  margin: 0;
  padding-left: var(--space-5);
  color: var(--danger);
}
.conflicts {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.changes {
  margin: 0;
  padding-left: var(--space-5);
  font-size: var(--text-sm);
}
.row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
</style>
