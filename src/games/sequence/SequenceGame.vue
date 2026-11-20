<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import TimerBar from '@/components/TimerBar.vue'
import { createTonePlayer } from '@/core/audio/tones'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { useCountdown } from '@/core/timing/useCountdown'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import {
  MAX_LENGTH,
  SEQUENCE_ID,
  bestFor,
  checkTap,
  createSequence,
  isSuccess,
  itemMs,
  keyToPad,
  padCount,
  playbackAt,
  playbackMs,
  startFromBest,
  timeoutMs,
  type Sequence,
  type SequenceSettings,
} from './logic'

const props = defineProps<{ settings: SequenceSettings; rng?: Rng }>()
const emit = defineEmits<{ 'round-complete': [result: RoundResult] }>()

/**
 * Phases of a run: intro → play (watch the sequence) → input (repeat it) →
 * play (one item longer) → … → result (first mistake, timeout or "End run").
 */
type Phase = 'intro' | 'play' | 'input' | 'result'

const RESULT_ENTER_GUARD_MS = 300
const TAP_TONE_MS = 250
const BUZZ_MS = 450
/** A shape per pad, so colour is never the only cue. */
const SHAPES = ['●', '■', '▲', '◆', '★', '✚', '⬢', '♥', '✦']
const QWAS = ['Q', 'W', 'A', 'S']

const rng = props.rng ?? createRng()
const playback = useCountdown()
const inputTimer = useCountdown()
const tones = createTonePlayer()
const stats = useStatsStore()
onUnmounted(() => tones.dispose())

const phase = ref<Phase>('intro')
const round = ref<SequenceSettings>({ ...props.settings })
const confirming = ref(false)
/** Current sequence length, step number (1-based) and position being repeated. */
const length = ref(0)
const step = ref(0)
const position = ref(0)
const reached = ref(0)
const startLength = ref(1)
const previousBest = ref<number | null>(null)
const mistake = ref<{ expected: number; pressed: number | null } | null>(null)
/** The last tapped pad; `n` alternates the flash animation so repeats restart it. */
const flash = ref<{ pad: number; n: number } | null>(null)
// The sequence itself is not reactive: `length` drives the view, items never change.
let seq: Sequence = createSequence(rng, 4)
let steps = 0
let runStartedAt = 0
let resultShownAt = 0

const inRun = computed(() => phase.value === 'play' || phase.value === 'input')
/** Outside a run, show the pads the settings ask for; inside, the run's snapshot. */
const pads = computed(() => padCount(inRun.value ? round.value.pads : props.settings.pads))
const columns = computed(() => (pads.value === 4 ? 2 : 3))
const bestNow = computed(() => bestFor(stats.roundsFor(SEQUENCE_ID), pads.value))
const currentItemMs = computed(() => itemMs(round.value.baseMs, step.value))

/** What is showing right now, derived from the one playback clock (no drift). */
const shown = computed(() => {
  if (phase.value !== 'play') return { index: -1, lit: false }
  const total = playbackMs(length.value, currentItemMs.value)
  return playbackAt(total - playback.remainingMs.value, length.value, currentItemMs.value)
})
const playingIndex = computed(() => (shown.value.lit ? shown.value.index : -1))
const litPad = computed(() =>
  playingIndex.value >= 0 && round.value.feedback !== 'tones' ? seq.at(playingIndex.value) : -1,
)
const progressText = computed(() => {
  const done = phase.value === 'play' ? shown.value.index + 1 : position.value
  return `${done} / ${length.value}`
})

watch(playingIndex, (i) => {
  if (i < 0 || round.value.feedback === 'colors') return
  tones.play(seq.at(i), currentItemMs.value, round.value.volume)
})

function startRun(from?: number) {
  tones.unlock()
  round.value = { ...props.settings }
  const p = padCount(round.value.pads)
  previousBest.value = bestFor(stats.roundsFor(SEQUENCE_ID), p)
  startLength.value = Math.min(MAX_LENGTH, from ?? round.value.startLength)
  seq = createSequence(rng, p)
  seq.growTo(startLength.value)
  length.value = seq.length
  step.value = 1
  steps = 0
  reached.value = 0
  mistake.value = null
  flash.value = null
  confirming.value = false
  runStartedAt = performance.now()
  void playStep()
}

async function playStep() {
  inputTimer.cancel()
  phase.value = 'play'
  position.value = 0
  if ((await playback.start(playbackMs(length.value, currentItemMs.value))) === 'cancelled') return
  phase.value = 'input'
  void armTimeout()
}

/** Restarts the "max pause between taps" timer, if that setting is on. */
async function armTimeout() {
  const ms = timeoutMs(round.value.inputTimeout)
  if (ms === 0) return
  if ((await inputTimer.start(ms)) === 'cancelled') return
  if (phase.value === 'input' && !confirming.value) fail(null)
}

function tap(pad: number) {
  if (phase.value !== 'input' || confirming.value || pad >= pads.value) return
  tones.unlock()
  flash.value = { pad, n: (flash.value?.n ?? 0) + 1 }
  const outcome = checkTap(seq, position.value, pad)
  if (outcome === 'wrong') return fail(pad)
  if (round.value.feedback !== 'colors') tones.play(pad, TAP_TONE_MS, round.value.volume)
  if (outcome === 'correct') {
    position.value++
    void armTimeout()
    return
  }
  // The whole sequence was repeated: one item longer, next step.
  inputTimer.cancel()
  reached.value = length.value
  steps++
  if (!seq.grow()) return endRun()
  length.value = seq.length
  step.value++
  void playStep()
}

function fail(pressed: number | null) {
  mistake.value = { expected: seq.at(position.value), pressed }
  if (round.value.feedback !== 'colors') tones.buzz(BUZZ_MS, round.value.volume)
  endRun()
}

/** Ends the run and records it — exactly once. */
function endRun() {
  if (!inRun.value) return
  playback.cancel()
  inputTimer.cancel()
  confirming.value = false
  phase.value = 'result'
  resultShownAt = performance.now()
  emit('round-complete', {
    success: isSuccess(reached.value, previousBest.value),
    level: null,
    accuracy: null,
    durationMs: Math.round(performance.now() - runStartedAt),
    metrics: {
      reached: reached.value,
      startLength: startLength.value,
      pads: padCount(round.value.pads),
      steps,
    },
  })
}

/** "End run?" — pauses the step; keeping going replays the current step. */
function askEnd() {
  if (!inRun.value || confirming.value) return
  confirming.value = true
  playback.cancel()
  inputTimer.cancel()
}

function keepGoing() {
  if (!confirming.value) return
  confirming.value = false
  if (phase.value === 'play') void playStep()
  else void armTimeout()
}

function padClass(i: number) {
  return {
    lit: litPad.value === i,
    'flash-a': inRun.value && flash.value?.pad === i && flash.value.n % 2 === 0,
    'flash-b': inRun.value && flash.value?.pad === i && flash.value.n % 2 === 1,
    expected: phase.value === 'result' && mistake.value?.expected === i,
    pressed: phase.value === 'result' && mistake.value?.pressed === i,
  }
}

function padMark(i: number): string {
  if (phase.value !== 'result' || !mistake.value) return ''
  if (mistake.value.expected === i) return '✓'
  if (mistake.value.pressed === i) return '✗'
  return ''
}

const verdict = computed(() => {
  if (reached.value >= MAX_LENGTH) return `Maximum length ${MAX_LENGTH} reached!`
  return `Reached ${reached.value}`
})
const bestLine = computed(() => {
  const prev = previousBest.value
  if (prev === null) return 'First run with this many pads'
  if (reached.value > prev) return `New best (was ${prev})`
  if (reached.value === prev) return `Tied your best (${prev})`
  return `Best with ${padCount(round.value.pads)} pads: ${prev}`
})

useGameKeys((e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'Escape') {
    if (confirming.value) {
      e.preventDefault()
      endRun()
    } else if (inRun.value) {
      e.preventDefault()
      askEnd()
    }
    return
  }
  if (confirming.value) {
    if (e.key === 'Enter') {
      e.preventDefault()
      keepGoing()
    }
    return
  }
  if (e.key === 'Enter') {
    if (phase.value === 'intro') {
      e.preventDefault()
      startRun()
    } else if (phase.value === 'result') {
      e.preventDefault()
      if (e.repeat || performance.now() - resultShownAt < RESULT_ENTER_GUARD_MS) return
      startRun()
    }
    return
  }
  if (!inRun.value || e.repeat) return
  const pad = keyToPad(e, pads.value)
  if (pad === null) return
  e.preventDefault()
  tap(pad) // ignored during playback
})
</script>

<template>
  <div class="sequence" :data-phase="phase">
    <template v-if="phase === 'intro'">
      <p class="intro">
        <span class="mono">{{ pads }} pads</span>
        <span class="muted"> · start length {{ settings.startLength }}</span>
      </p>
      <p class="muted small explain">
        Watch the pads, then repeat them in order. Each step adds one more. One mistake ends the
        run.
      </p>
    </template>

    <template v-else-if="inRun">
      <p class="step mono muted">Step {{ step }} · length {{ length }}</p>
      <div v-if="confirming" class="confirm" role="alertdialog" aria-label="End run?">
        <p>End run? It counts as reached {{ reached }}.</p>
        <div class="row">
          <button type="button" class="end-run" @click="endRun">End run</button>
          <button type="button" class="primary keep" @click="keepGoing">Keep going</button>
        </div>
        <p class="hint muted">Esc again to end · Enter to keep going</p>
      </div>
      <template v-else>
        <p class="status" aria-live="polite">{{ phase === 'play' ? 'Watch…' : 'Your turn' }}</p>
        <p class="progress mono">{{ progressText }}</p>
        <TimerBar
          v-if="phase === 'input' && round.inputTimeout > 0"
          :progress="inputTimer.progress.value"
        />
      </template>
    </template>

    <template v-else>
      <p class="verdict">{{ verdict }}</p>
      <p class="best mono muted">{{ bestLine }}</p>
      <p v-if="mistake" class="legend muted small">✓ the right pad · ✗ your tap</p>
    </template>

    <div
      class="pads"
      :class="{ playing: phase === 'play' }"
      :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }"
    >
      <button
        v-for="i in pads"
        :key="i"
        type="button"
        class="pad"
        :class="padClass(i - 1)"
        :style="{ '--pad-color': `var(--pad-${i})` }"
        :aria-label="`Pad ${i}`"
        :aria-disabled="phase !== 'input' || confirming"
        @pointerdown.prevent
        @click="tap(i - 1)"
      >
        <span class="num">{{ i }}</span>
        <span class="shape" aria-hidden="true">{{ SHAPES[i - 1] }}</span>
        <span v-if="pads === 4" class="keyhint mono" aria-hidden="true">{{ QWAS[i - 1] }}</span>
        <span v-if="padMark(i - 1)" class="mark" aria-hidden="true">{{ padMark(i - 1) }}</span>
      </button>
    </div>

    <template v-if="phase === 'intro' || phase === 'result'">
      <div class="row">
        <button
          type="button"
          class="primary"
          :class="phase === 'intro' ? 'start' : 'again'"
          @click="startRun()"
        >
          {{ phase === 'intro' ? 'Start' : 'Again' }}
        </button>
        <button
          v-if="bestNow !== null"
          type="button"
          class="from-best"
          @click="startRun(startFromBest(bestNow))"
        >
          Start from {{ startFromBest(bestNow) }}
        </button>
      </div>
      <p class="hint muted">
        Enter to start · keys 1–{{ pads }}<template v-if="pads === 4"> or Q W A S</template>
        <template v-if="bestNow !== null"> · best {{ bestNow }}</template>
      </p>
    </template>
    <button v-else-if="!confirming" type="button" class="end small" @click="askEnd">
      End run (Esc)
    </button>
  </div>
</template>

<style scoped>
.sequence {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.sequence p {
  margin: 0;
}
.intro,
.status {
  font-size: var(--text-lg);
}
.small,
.hint,
.step {
  font-size: var(--text-sm);
}
.explain {
  max-width: 26rem;
}
.progress {
  font-size: var(--text-xl);
}
.pads {
  display: grid;
  gap: var(--space-3);
  width: min(100%, 24rem);
}
.pad {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  border-radius: var(--radius);
  border: 2px solid var(--border);
  background: var(--surface);
  color: var(--text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  touch-action: manipulation;
  transition:
    border-color var(--transition),
    color var(--transition);
}
/* The pad's colour as a tinted layer; fully on when lit. */
.pad::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--pad-color);
  opacity: 0.18;
  transition: opacity var(--transition);
}
.pad > span {
  position: relative;
}
.num {
  font-size: var(--text-xl);
  font-weight: 700;
}
.shape {
  font-size: var(--text-lg);
  color: var(--pad-color);
}
.keyhint {
  position: absolute;
  top: var(--space-1);
  left: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.pad.lit {
  border-color: var(--text);
  color: var(--bg);
}
.pad.lit::before {
  opacity: 1;
}
.pad.lit .shape,
.pad.lit .keyhint {
  color: var(--bg);
}
.pad.flash-a::before {
  animation: flash-a 220ms ease-out;
}
.pad.flash-b::before {
  animation: flash-b 220ms ease-out;
}
@keyframes flash-a {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.18;
  }
}
@keyframes flash-b {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.18;
  }
}
.pad.expected {
  border-color: var(--accent);
}
.pad.pressed {
  border-color: var(--danger);
}
.mark {
  position: absolute !important;
  top: var(--space-1);
  right: var(--space-2);
  font-size: var(--text-lg);
  font-weight: 700;
}
.pad.expected .mark {
  color: var(--accent);
}
.pad.pressed .mark {
  color: var(--danger);
}
.confirm {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
}
.row {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  justify-content: center;
}
.verdict {
  font-size: var(--text-xl);
  color: var(--accent);
}
.start,
.again,
.from-best,
.keep,
.end-run {
  min-width: 8rem;
  padding: var(--space-3) var(--space-5);
}
</style>
