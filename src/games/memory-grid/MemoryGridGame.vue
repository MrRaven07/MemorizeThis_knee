<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import TimerBar from '@/components/TimerBar.vue'
import { stepStaircase } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { useCountdown } from '@/core/timing/useCountdown'
import { progressLabel } from '@/games/progress'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import {
  MEMORY_GRID_ID,
  generatePattern,
  gridLevelInfo,
  gridStaircase,
  gridViewMs,
  scoreGrid,
  type GridScore,
  type MemoryGridSettings,
} from './logic'

const props = defineProps<{ settings: MemoryGridSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'show' | 'recall' | 'result'
const RESULT_ENTER_GUARD_MS = 300

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const stats = useStatsStore()

const phase = ref<Phase>('ready')
const round = ref<MemoryGridSettings>({ ...props.settings })
const level = ref(stats.getStaircase(MEMORY_GRID_ID, gridStaircase(props.settings)).level)
const size = ref(3)
const pattern = ref<number[]>([])
const answer = ref<Set<number>>(new Set())
const score = ref<GridScore | null>(null)
const change = ref<{ from: number; to: number; streak: number } | null>(null)
const active = ref(0)
const buttons = ref<HTMLButtonElement[]>([])
let lastPattern: number[] | undefined
let recallStartedAt = 0
let resultShownAt = 0

const info = computed(() => gridLevelInfo(level.value))
const cells = computed(() => Array.from({ length: size.value * size.value }, (_, i) => i))
const lit = computed(() => new Set(pattern.value))

onMounted(() => emit('level', level.value))

async function start() {
  round.value = { ...props.settings }
  level.value = stats.getStaircase(MEMORY_GRID_ID, gridStaircase(round.value)).level
  const l = gridLevelInfo(level.value)
  size.value = l.size
  pattern.value = generatePattern(rng, l.size, l.lit, lastPattern)
  lastPattern = pattern.value
  answer.value = new Set()
  score.value = null
  change.value = null
  active.value = 0

  phase.value = 'show'
  if ((await countdown.start(gridViewMs(level.value, round.value.timeMultiplier))) === 'cancelled')
    return
  phase.value = 'recall'
  recallStartedAt = performance.now()
  await nextTick()
  buttons.value[0]?.focus()
}

function clearAnswer() {
  answer.value = new Set()
  // the Clear button disables itself: keep keyboard focus on the grid
  void nextTick(() => buttons.value[active.value]?.focus())
}

function toggle(i: number) {
  if (phase.value !== 'recall') return
  const next = new Set(answer.value)
  if (next.has(i)) next.delete(i)
  else next.add(i)
  answer.value = next
}

function check() {
  if (phase.value !== 'recall') return
  const s = scoreGrid(pattern.value, [...answer.value])
  const cfg = gridStaircase(round.value)
  const before = stats.getStaircase(MEMORY_GRID_ID, cfg)
  const after = stepStaircase(before, cfg, s.exact)
  stats.saveStaircase(MEMORY_GRID_ID, after)
  score.value = s
  change.value = { from: before.level, to: after.level, streak: after.streakRight }
  phase.value = 'result'
  resultShownAt = performance.now()
  const l = gridLevelInfo(before.level)
  emit('round-complete', {
    success: s.exact,
    level: before.level,
    accuracy: s.accuracy,
    durationMs: Math.round(performance.now() - recallStartedAt),
    metrics: { hits: s.hits, misses: s.misses, wrong: s.wrong, size: l.size, lit: l.lit },
  })
  level.value = after.level
  emit('level', after.level)
}

/** Result marks — never colour alone: ✓ hit, ○ missed, ✗ wrong. */
function resultMark(i: number): { cls: string; mark: string } {
  const want = lit.value.has(i)
  const got = answer.value.has(i)
  if (want && got) return { cls: 'hit', mark: '✓' }
  if (want) return { cls: 'missed', mark: '○' }
  if (got) return { cls: 'wrong', mark: '✗' }
  return { cls: '', mark: '' }
}

function onKeydown(e: KeyboardEvent, i: number) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const n = size.value
  const moves: Record<string, number> = {
    ArrowRight: (i % n) + 1 < n ? i + 1 : i,
    ArrowLeft: i % n > 0 ? i - 1 : i,
    ArrowDown: i + n < n * n ? i + n : i,
    ArrowUp: i - n >= 0 ? i - n : i,
  }
  const target = moves[e.key]
  if (target === undefined) return
  e.preventDefault()
  active.value = target
  buttons.value[target]?.focus()
}

useGameKeys((e) => {
  if (e.key === 'Escape' && phase.value === 'show') {
    e.preventDefault()
    countdown.finishNow()
  } else if (e.key === 'Enter' && phase.value === 'ready') {
    e.preventDefault()
    start()
  } else if (e.key === 'Enter' && phase.value === 'result') {
    e.preventDefault()
    if (e.repeat || performance.now() - resultShownAt < RESULT_ENTER_GUARD_MS) return
    start()
  }
})
</script>

<template>
  <div class="memory-grid">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Level {{ level }}</span>
        <span class="muted">
          · {{ info.size }}×{{ info.size }} · {{ info.lit }} lit ·
          {{ (gridViewMs(level, settings.timeMultiplier) / 1000).toFixed(1) }}s</span
        >
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start · Esc to skip the viewing time</p>
    </template>

    <template v-else-if="phase === 'show'">
      <TimerBar :progress="countdown.progress.value" />
      <div
        class="grid"
        :class="{ dense: size >= 10 }"
        :style="{ gridTemplateColumns: `repeat(${size}, 1fr)` }"
        role="img"
        aria-label="Pattern to remember"
      >
        <div v-for="i in cells" :key="i" class="cell" :class="{ on: lit.has(i) }" />
      </div>
    </template>

    <template v-else-if="phase === 'recall'">
      <p class="muted small">
        Tap the cells that were lit ({{ answer.size }} / {{ pattern.length }})
      </p>
      <div
        class="grid"
        :class="{ dense: size >= 10 }"
        :style="{ gridTemplateColumns: `repeat(${size}, 1fr)` }"
        role="group"
        aria-label="Rebuild the pattern"
      >
        <button
          v-for="i in cells"
          :key="i"
          :ref="(el) => (buttons[i] = el as HTMLButtonElement)"
          type="button"
          class="cell"
          :class="{ picked: answer.has(i) }"
          :aria-pressed="answer.has(i) ? 'true' : 'false'"
          :aria-label="`Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}`"
          :tabindex="i === active ? 0 : -1"
          @click="toggle(i)"
          @focus="active = i"
          @keydown="onKeydown($event, i)"
        />
      </div>
      <div class="row">
        <button type="button" class="clear" :disabled="answer.size === 0" @click="clearAnswer">
          Clear
        </button>
        <button type="button" class="primary check" @click="check">Check</button>
      </div>
    </template>

    <template v-else-if="score && change">
      <div
        class="grid"
        :class="{ dense: size >= 10 }"
        :style="{ gridTemplateColumns: `repeat(${size}, 1fr)` }"
        role="img"
        :aria-label="`Your answer: ${score.hits} found, ${score.misses} missed, ${score.wrong} wrong`"
      >
        <div v-for="i in cells" :key="i" class="cell" :class="resultMark(i).cls">
          <span aria-hidden="true">{{ resultMark(i).mark }}</span>
        </div>
      </div>
      <p class="verdict" :class="score.exact ? 'ok' : 'bad'">
        {{ score.exact ? 'Perfect copy' : `${score.hits} of ${pattern.length} found` }}
        <span v-if="score.wrong > 0" class="muted"> · {{ score.wrong }} wrong</span>
      </p>
      <p class="change mono">
        {{
          progressLabel(
            { ...change, upAfter: round.upAfter, max: gridStaircase(round).max },
            score.exact,
          )
        }}
      </p>
      <p class="legend muted small">✓ found · ○ missed · ✗ wrong</p>
      <button type="button" class="primary next" @click="start">Next</button>
      <p class="hint muted">Enter for the next pattern</p>
    </template>
  </div>
</template>

<style scoped>
.memory-grid {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.memory-grid p {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.small,
.hint {
  font-size: var(--text-sm);
}
.grid {
  display: grid;
  gap: var(--space-1);
  width: min(100%, 30rem);
  aspect-ratio: 1;
}
/* big grids (10×10 to 13×13): thinner gaps so cells stay as large as possible */
.grid.dense {
  gap: 2px;
}
.grid.dense .cell {
  border-radius: 3px;
  font-size: var(--text-sm);
}
.cell {
  padding: 0;
  min-width: 0;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-lg);
  font-weight: 700;
  touch-action: manipulation;
}
.cell.on,
.cell.picked {
  background: var(--accent);
  border-color: var(--accent);
}
.cell.hit {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}
.cell.missed {
  border: 2px dashed var(--warning);
  color: var(--warning);
}
.cell.wrong {
  background: var(--danger-dim);
  border-color: var(--danger);
  color: var(--danger);
}
.row {
  display: flex;
  gap: var(--space-2);
}
.verdict.ok {
  color: var(--accent);
}
.verdict.bad {
  color: var(--danger);
}
.change {
  color: var(--text-muted);
}
.start,
.next,
.check {
  min-width: 8rem;
  padding: var(--space-3) var(--space-5);
}
</style>
