<script setup lang="ts">
import { computed } from 'vue'
import type { Maze, Pos } from './logic'

/** Draws a maze. Optional overlays: the walked path, the failing cell, a hint route. */
const props = withDefaults(
  defineProps<{ maze: Maze; path?: Pos[]; failAt?: Pos | null; highlight?: Pos[] }>(),
  { path: () => [], failAt: null, highlight: () => [] },
)

const key = (p: Pos) => `${p.x},${p.y}`
const onPath = computed(() => new Set(props.path.map(key)))
const hinted = computed(() => new Set(props.highlight.map(key)))

const cells = computed(() =>
  props.maze.cells.flatMap((row, y) =>
    row.map((cell, x) => {
      const k = `${x},${y}`
      const isStart = x === props.maze.start.x && y === props.maze.start.y
      const isEnd = x === props.maze.end.x && y === props.maze.end.y
      return {
        k,
        glyph: isStart ? 'S' : isEnd ? 'E' : cell === 'spike' ? '▲' : '',
        classes: [
          cell,
          isStart && 'start',
          isEnd && 'end',
          onPath.value.has(k) && 'on-path',
          hinted.value.has(k) && 'hint',
          props.failAt && props.failAt.x === x && props.failAt.y === y && 'fail',
        ],
      }
    }),
  ),
)
</script>

<template>
  <div
    class="maze"
    role="img"
    :aria-label="`Maze ${maze.size} by ${maze.size}`"
    :style="{ gridTemplateColumns: `repeat(${maze.size}, 1fr)` }"
  >
    <div v-for="c in cells" :key="c.k" class="cell" :class="c.classes">
      <span v-if="c.glyph" aria-hidden="true">{{ c.glyph }}</span>
    </div>
  </div>
</template>

<style scoped>
.maze {
  display: grid;
  width: min(100%, 26rem);
  aspect-ratio: 1;
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.cell {
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: clamp(0.5rem, 2.5vw, 0.9rem);
  font-weight: 700;
  background: var(--surface);
  color: var(--text-muted);
}
.cell.wall {
  background: var(--text-muted);
}
.cell.spike {
  color: var(--danger);
}
.cell.start,
.cell.end {
  color: var(--accent);
}
.cell.hint {
  background: var(--surface-raised);
  box-shadow: inset 0 0 0 2px var(--warning);
}
.cell.on-path {
  background: var(--accent-dim);
  box-shadow: inset 0 0 0 2px var(--accent);
}
.cell.fail {
  background: var(--danger-dim);
  box-shadow: inset 0 0 0 2px var(--danger);
  animation: flash 0.4s ease-out 2;
}
@keyframes flash {
  50% {
    background: var(--danger);
  }
}
</style>
