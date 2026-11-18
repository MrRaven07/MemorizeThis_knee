<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TimerBar from '@/components/TimerBar.vue'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { useCountdown } from '@/core/timing/useCountdown'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import {
  DIGITS,
  POSITIONS,
  STIMULUS_MS,
  generateStream,
  isTarget,
  levelKey,
  modeCode,
  nBackAccuracy,
  nBackStaircase,
  nextNBackState,
  PASS_ACCURACY,
  scoreStream,
  trialsFor,
  type NBackSettings,
  type StreamScore,
} from './logic'

const props = defineProps<{ settings: NBackSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'run' | 'result'
type StreamName = 'position' | 'digit'

const RESULT_ENTER_GUARD_MS = 300

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const stats = useStatsStore()

const phase = ref<Phase>('ready')
const round = ref<NBackSettings>({ ...props.settings })
const n = ref(
  stats.getStaircase(levelKey(props.settings.mode), nBackStaircase(props.settings)).level,
)
const streams = ref<Record<StreamName, number[]>>({ position: [], digit: [] })
const presses = ref<Record<StreamName, boolean[]>>({ position: [], digit: [] })
const feedback = ref<{ stream: StreamName; trial: number; ok: boolean } | null>(null)
const result = ref<{
  accuracy: number
  counts: StreamScore
  from: number
  to: number
  streak: number
} | null>(null)
let resultShownAt = 0

const total = computed(() => trialsFor(n.value))
const roundMs = computed(() => total.value * round.value.trialMs)
/** Trial index and stimulus visibility are derived from one clock: no drift. */
const elapsed = computed(() => roundMs.value - countdown.remainingMs.value)
const trial = computed(() =>
  Math.min(total.value - 1, Math.floor(elapsed.value / round.value.trialMs)),
)
const visible = computed(
  () => phase.value === 'run' && elapsed.value - trial.value * round.value.trialMs < STIMULUS_MS,
)
const active = computed<StreamName[]>(() =>
  round.value.mode === 'dual' ? ['position', 'digit'] : [round.value.mode],
)
const canPress = computed(() => phase.value === 'run' && trial.value >= n.value)
const litCell = computed(() => (visible.value ? streams.value.position[trial.value] : undefined))
const shownDigit = computed(() => (visible.value ? streams.value.digit[trial.value] : undefined))

onMounted(() => emit('level', n.value))

async function start() {
  round.value = { ...props.settings }
  const cfg = nBackStaircase(round.value)
  n.value = stats.getStaircase(levelKey(round.value.mode), cfg).level
  const size = trialsFor(n.value)
  const uses = (s: StreamName) => round.value.mode === s || round.value.mode === 'dual'
  streams.value = {
    position: uses('position') ? generateStream(rng, n.value, size, POSITIONS) : [],
    digit: uses('digit') ? generateStream(rng, n.value, size, DIGITS) : [],
  }
  presses.value = { position: Array(size).fill(false), digit: Array(size).fill(false) }
  feedback.value = null
  result.value = null

  phase.value = 'run'
  if ((await countdown.start(size * round.value.trialMs)) === 'cancelled') return
  finish()
}

function press(stream: StreamName) {
  if (!canPress.value || !active.value.includes(stream)) return
  const t = trial.value
  if (presses.value[stream][t]) return // one press per stream per trial
  presses.value[stream][t] = true
  feedback.value = { stream, trial: t, ok: isTarget(streams.value[stream], n.value, t) }
}

function finish() {
  const scores = active.value.map((s) => scoreStream(streams.value[s], n.value, presses.value[s]))
  const accuracy = nBackAccuracy(scores)
  const counts = scores.reduce(
    (a, s) => ({
      hits: a.hits + s.hits,
      misses: a.misses + s.misses,
      falseAlarms: a.falseAlarms + s.falseAlarms,
      correctRejections: a.correctRejections + s.correctRejections,
    }),
    { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 },
  )
  const key = levelKey(round.value.mode)
  const cfg = nBackStaircase(round.value)
  const before = stats.getStaircase(key, cfg)
  const after = nextNBackState(before, cfg, accuracy)
  stats.saveStaircase(key, after)

  result.value = {
    accuracy,
    counts,
    from: before.level,
    to: after.level,
    streak: after.streakRight,
  }
  phase.value = 'result'
  resultShownAt = performance.now()
  emit('round-complete', {
    success: accuracy >= PASS_ACCURACY,
    level: before.level,
    accuracy,
    durationMs: roundMs.value,
    metrics: { n: before.level, mode: modeCode(round.value.mode), ...counts },
  })
  n.value = after.level
  emit('level', after.level)
}

function feedbackFor(stream: StreamName): string {
  const f = feedback.value
  if (!round.value.feedback || !f || f.stream !== stream || f.trial !== trial.value) return ''
  return f.ok ? ' ✓' : ' ✗'
}

useGameKeys((e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (phase.value === 'run') {
    if (round.value.mode === 'dual') {
      if (k === 'a') press('position')
      else if (k === 'l') press('digit')
      else return
    } else if (k === ' ' || k === 'm') press(active.value[0]!)
    else return
    e.preventDefault()
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
  <div class="n-back">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">N = {{ n }}</span>
        <span class="muted"> · {{ settings.mode }} · {{ trialsFor(n) }} items</span>
      </p>
      <p class="muted small explain">
        Press <strong>match</strong> when the item is the same as the one {{ n }}
        {{ n === 1 ? 'step' : 'steps' }} back.
        <template v-if="settings.mode === 'dual'">A = position match · L = digit match.</template>
        <template v-else>Space or M = match.</template>
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start</p>
    </template>

    <template v-else-if="phase === 'run'">
      <TimerBar :progress="countdown.progress.value" />
      <p class="trial mono muted">{{ trial + 1 }} / {{ total }} · N = {{ n }}</p>
      <div v-if="round.mode !== 'digit'" class="grid" role="img" aria-label="Position grid">
        <div v-for="i in 9" :key="i" class="cell" :class="{ lit: litCell === i - 1 }" />
      </div>
      <p v-if="round.mode !== 'position'" class="digit mono" aria-live="off">
        {{ shownDigit ?? ' ' }}
      </p>
      <div class="buttons">
        <button
          v-if="round.mode === 'dual'"
          type="button"
          class="match match-position primary"
          :disabled="!canPress"
          @pointerdown.prevent
          @click="press('position')"
        >
          Position (A){{ feedbackFor('position') }}
        </button>
        <button
          v-if="round.mode === 'dual'"
          type="button"
          class="match match-digit primary"
          :disabled="!canPress"
          @pointerdown.prevent
          @click="press('digit')"
        >
          Digit (L){{ feedbackFor('digit') }}
        </button>
        <button
          v-else
          type="button"
          class="match primary"
          :disabled="!canPress"
          @pointerdown.prevent
          @click="press(active[0]!)"
        >
          Match{{ feedbackFor(active[0]!) }}
        </button>
      </div>
    </template>

    <template v-else-if="result">
      <p class="verdict" :class="result.accuracy >= PASS_ACCURACY ? 'ok' : 'bad'">
        {{ Math.round(result.accuracy * 100) }}% accuracy
      </p>
      <p class="mono small">
        hits {{ result.counts.hits }} · missed {{ result.counts.misses }} · false alarms
        {{ result.counts.falseAlarms }}
      </p>
      <p class="change mono">
        <template v-if="result.to !== result.from">N {{ result.from }} → {{ result.to }}</template>
        <template v-else-if="result.accuracy >= PASS_ACCURACY">
          N {{ result.from }} (streak {{ result.streak }}/{{ round.upAfter }})
        </template>
        <template v-else>N {{ result.from }}</template>
      </p>
      <button type="button" class="primary next" @click="start">Next</button>
      <p class="hint muted">Enter for the next round · 80% passes, under 50% lowers N</p>
    </template>
  </div>
</template>

<style scoped>
.n-back {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.n-back p {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.small,
.hint,
.trial {
  font-size: var(--text-sm);
}
.explain {
  max-width: 26rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  width: min(70vw, 16rem);
  aspect-ratio: 1;
}
.cell {
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}
.cell.lit {
  background: var(--accent);
  border-color: var(--accent);
}
.digit {
  font-size: var(--text-display);
  min-height: 1.2em;
}
.buttons {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  justify-content: center;
}
.match {
  min-width: 9rem;
  padding: var(--space-4) var(--space-5);
  font-size: var(--text-lg);
  touch-action: manipulation;
}
.match:disabled {
  opacity: 0.4;
}
.verdict {
  font-size: var(--text-xl);
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
.next {
  min-width: 10rem;
  padding: var(--space-3) var(--space-5);
}
</style>
