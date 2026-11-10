<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import ImportPanel from '@/features/major/ImportPanel.vue'
import StudySetup from '@/features/major/StudySetup.vue'
import { toCsv, toJson } from '@/features/major/export'
import { deckStats } from '@/features/major/stats'
import type { Direction } from '@/features/major/types'
import { useDecksStore } from '@/stores/decks'

const props = defineProps<{ deckId: string }>()
const decks = useDecksStore()
const router = useRouter()

const deck = computed(() => decks.getDeck(props.deckId))
const statsDir = ref<Direction>('forward')
const stats = computed(() => (deck.value ? deckStats(deck.value, statsDir.value) : null))

const newInput = ref('')
const newOutput = ref('')
const editing = ref<string | null>(null)
const editInput = ref('')
const editOutput = ref('')
const confirmDelete = ref(false)

function addCard() {
  if (!deck.value || !newInput.value.trim() || !newOutput.value.trim()) return
  if (deck.value.cards.some((c) => c.input === newInput.value.normalize('NFC').trim())) return
  decks.addCard(deck.value.id, newInput.value, newOutput.value)
  newInput.value = ''
  newOutput.value = ''
}

function startEdit(id: string, input: string, output: string) {
  editing.value = id
  editInput.value = input
  editOutput.value = output
}

function saveEdit() {
  if (!deck.value || !editing.value || !editInput.value.trim() || !editOutput.value.trim()) return
  decks.updateCard(deck.value.id, editing.value, editInput.value, editOutput.value)
  editing.value = null
}

function rename(e: Event) {
  if (deck.value) decks.renameDeck(deck.value.id, (e.target as HTMLInputElement).value)
}

function download(content: string, ext: 'csv' | 'json', type: string) {
  if (!deck.value) return
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${deck.value.name.replace(/[^\p{L}\p{N}_-]+/gu, '-')}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

function remove() {
  if (!deck.value) return
  decks.deleteDeck(deck.value.id)
  router.push({ name: 'major' })
}

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`)
</script>

<template>
  <section v-if="deck" class="deck">
    <header class="top">
      <RouterLink :to="{ name: 'major' }">← Decks</RouterLink>
      <input
        class="title"
        :value="deck.name"
        aria-label="Deck name"
        @change="rename"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </header>

    <div class="card">
      <h2>Study</h2>
      <p v-if="deck.cards.length === 0" class="muted">Add or import cards first.</p>
      <StudySetup v-else :deck="deck" />
    </div>

    <div class="card">
      <h2>
        Cards <span class="muted mono">({{ deck.cards.length }})</span>
      </h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Input</th>
              <th>Output</th>
              <th><span class="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in deck.cards" :key="c.id" class="card-row">
              <template v-if="editing === c.id">
                <td><input v-model="editInput" class="mono" aria-label="Input" /></td>
                <td>
                  <input
                    v-model="editOutput"
                    aria-label="Output"
                    @keydown.enter.prevent="saveEdit"
                  />
                </td>
                <td class="actions">
                  <button type="button" @click="saveEdit">Save</button>
                  <button type="button" @click="editing = null">Cancel</button>
                </td>
              </template>
              <template v-else>
                <td class="mono">{{ c.input }}</td>
                <td>{{ c.output }}</td>
                <td class="actions">
                  <button type="button" @click="startEdit(c.id, c.input, c.output)">Edit</button>
                  <button
                    type="button"
                    :aria-label="`Delete ${c.input}`"
                    @click="decks.removeCard(deck.id, c.id)"
                  >
                    ✕
                  </button>
                </td>
              </template>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td>
                <input v-model="newInput" class="mono" placeholder="06" aria-label="New input" />
              </td>
              <td>
                <input
                  v-model="newOutput"
                  placeholder="șase"
                  aria-label="New output"
                  @keydown.enter.prevent="addCard"
                />
              </td>
              <td class="actions">
                <button type="button" @click="addCard">Add</button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Import</h2>
      <ImportPanel :deck="deck" />
    </div>

    <div class="card">
      <h2>Export</h2>
      <div class="row">
        <button
          type="button"
          :disabled="deck.cards.length === 0"
          @click="download(toCsv(deck.cards), 'csv', 'text/csv;charset=utf-8')"
        >
          Download CSV
        </button>
        <button
          type="button"
          :disabled="deck.cards.length === 0"
          @click="download(toJson(deck.cards), 'json', 'application/json')"
        >
          Download JSON
        </button>
      </div>
    </div>

    <div v-if="stats" class="card">
      <h2>Stats</h2>
      <div class="row small">
        <label><input v-model="statsDir" type="radio" value="forward" /> input → output</label>
        <label><input v-model="statsDir" type="radio" value="reverse" /> output → input</label>
      </div>
      <p class="mono">
        Known well: {{ stats.knownWell }} / {{ stats.total }} · Success:
        {{ pct(stats.successRate) }}
      </p>
      <template v-if="stats.weakest.length > 0">
        <h3>Weakest cards</h3>
        <ol class="weakest mono">
          <li v-for="w in stats.weakest" :key="w.card.id">
            {{ w.card.input }} → {{ w.card.output }}
            <span class="muted">{{ pct(w.rate) }} of {{ w.answers }}</span>
          </li>
        </ol>
      </template>
      <p v-else class="muted small">Weakest cards show up after 3 answers per card.</p>
    </div>

    <div class="card danger-zone">
      <button v-if="!confirmDelete" type="button" @click="confirmDelete = true">
        Delete deck…
      </button>
      <div v-else class="row" role="alertdialog" aria-label="Confirm delete">
        <span>Delete “{{ deck.name }}” and all its progress?</span>
        <button type="button" class="danger" @click="remove">Delete</button>
        <button type="button" @click="confirmDelete = false">Cancel</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.deck {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-block: var(--space-4);
}
.top {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.title {
  flex: 1;
  min-width: 0;
  font-size: var(--text-xl);
  font-weight: 700;
  background: transparent;
  border-color: transparent;
}
.title:hover,
.title:focus {
  border-color: var(--border);
}
.card {
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.card h2 {
  font-size: var(--text-lg);
}
.card h3 {
  font-size: var(--text-md);
}
.card p {
  margin: 0;
}
.table-wrap {
  overflow-x: auto;
  max-height: 24rem;
  overflow-y: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th {
  text-align: left;
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: 500;
}
td,
th {
  padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--border);
}
td input {
  width: 100%;
  min-width: 4rem;
}
.actions {
  white-space: nowrap;
  text-align: right;
}
.actions button {
  padding: var(--space-1) var(--space-2);
}
.row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
}
.small {
  font-size: var(--text-sm);
}
.weakest {
  margin: 0;
  padding-left: var(--space-5);
  font-size: var(--text-sm);
}
button.danger {
  border-color: var(--danger);
  color: var(--danger);
}
</style>
