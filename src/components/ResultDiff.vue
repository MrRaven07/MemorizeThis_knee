<script setup lang="ts">
import type { DiffOp } from '@/core/scoring/align'

/** Character-by-character comparison of the answer against the target. */
defineProps<{ ops: DiffOp[] }>()

function text(op: DiffOp): string {
  switch (op.kind) {
    case 'match':
      return op.char
    case 'substitute':
      return op.actual
    case 'missing':
      return op.expected
    case 'extra':
      return op.actual
  }
}

function title(op: DiffOp): string {
  switch (op.kind) {
    case 'match':
      return 'correct'
    case 'substitute':
      return `you typed ${op.actual}, it was ${op.expected}`
    case 'missing':
      return `missing ${op.expected}`
    case 'extra':
      return `extra ${op.actual}`
  }
}
</script>

<template>
  <div class="diff mono" aria-label="Your answer compared with the target">
    <span v-for="(op, i) in ops" :key="i" :class="`diff-${op.kind}`" :title="title(op)">{{
      text(op)
    }}</span>
  </div>
</template>

<style scoped>
.diff {
  font-size: var(--text-xl);
  letter-spacing: 0.1em;
  word-break: break-all;
  text-align: center;
}
.diff-match {
  color: var(--accent);
}
.diff-substitute {
  color: var(--danger);
  background: var(--danger-dim);
  border-radius: 2px;
}
.diff-missing {
  color: var(--text-muted);
  text-decoration: line-through;
  opacity: 0.6;
}
.diff-extra {
  color: var(--warning);
  text-decoration: underline wavy;
}
</style>
