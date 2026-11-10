<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { exportAll, importAll, validateBackup } from '@/core/storage/backup'
import { appStorage } from '@/core/storage/persist'
import { useSettingsStore, type MazeKeys } from '@/stores/settings'

const settings = useSettingsStore()

const pending = ref<{ json: string; exportedAt: number | null } | null>(null)
const restoreError = ref<string | null>(null)

function downloadBackup() {
  const blob = new Blob([exportAll(appStorage)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `memorize-this-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function onFileChosen(e: Event) {
  restoreError.value = null
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const json = await file.text()
  const check = validateBackup(json)
  if (!check.ok) {
    restoreError.value = check.error
    return
  }
  pending.value = { json, exportedAt: check.exportedAt }
}

function confirmRestore() {
  if (!pending.value) return
  const result = importAll(appStorage, pending.value.json)
  if (!result.ok) {
    restoreError.value = result.error
    pending.value = null
    return
  }
  // Simplest way to make every store re-read storage.
  location.reload()
}
</script>

<template>
  <section class="settings-page">
    <header class="top">
      <RouterLink :to="{ name: 'home' }">← Back</RouterLink>
      <h1>Settings</h1>
    </header>

    <div class="card">
      <h2>Maze controls</h2>
      <label for="maze-keys" class="muted">Keys used to type a maze route</label>
      <select
        id="maze-keys"
        :value="settings.mazeKeys"
        @change="settings.setMazeKeys(($event.target as HTMLSelectElement).value as MazeKeys)"
      >
        <option value="wasd">WASD — w up, a left, s down, d right</option>
        <option value="1234">1234 — 1 up, 2 left, 3 down, 4 right</option>
      </select>
    </div>

    <div class="card">
      <h2>Backup &amp; restore</h2>
      <p class="muted">
        Everything is stored only in this browser. Download a backup now and then — it holds your
        stats, settings and flashcard decks.
      </p>
      <div class="row">
        <button type="button" class="primary" @click="downloadBackup">Download backup</button>
        <label class="file-button">
          Restore from file…
          <input
            type="file"
            accept="application/json,.json"
            class="visually-hidden"
            @change="onFileChosen"
          />
        </label>
      </div>

      <p v-if="restoreError" class="error" role="alert">{{ restoreError }}</p>

      <div v-if="pending" class="confirm" role="alertdialog" aria-labelledby="confirm-title">
        <p id="confirm-title">
          <strong>Replace all your current data?</strong>
          This backup
          <template v-if="pending.exportedAt"
            >is from {{ new Date(pending.exportedAt).toLocaleString() }}</template
          >
          will replace your stats, settings and decks on this device. This can't be undone.
        </p>
        <div class="row">
          <button type="button" @click="downloadBackup">Download current data first</button>
          <button type="button" class="danger" @click="confirmRestore">Replace my data</button>
          <button type="button" @click="pending = null">Cancel</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-block: var(--space-4);
}
.top {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}
.top h1 {
  font-size: var(--text-xl);
}
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.card h2 {
  font-size: var(--text-lg);
}
.card p {
  margin: 0;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.file-button {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  cursor: pointer;
}
.file-button:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.error {
  color: var(--danger);
}
.confirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  background: var(--danger-dim);
}
button.danger {
  border-color: var(--danger);
  color: var(--danger);
}
</style>
