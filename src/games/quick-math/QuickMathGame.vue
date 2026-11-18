<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import RecallInput from '@/components/RecallInput.vue'
import TimerBar from '@/components/TimerBar.vue'
import { stepThreeZone } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { useCountdown } from '@/core/timing/useCountdown'
import { progressLabel } from '@/games/progress'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import {
  QUICK_MATH_ID,
  enabledOps,
  generateProblem,
  mathOutcome,
  mathStaircase,
  parseAnswer,
  targetCorrect,
  type Problem,
  type QuickMathSettings,
} from './logic'

const props = defineProps<{ settings: QuickMathSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'run' | 'result'
const RESULT_ENTER_GUARD_MS = 300
/** How long the right answer stays visible after a wrong one (counts against the sprint). */
const REVEAL_MS = 400

const rng = props.rng ?? createRng()
const sprint = useCountdown()
const reveal = useCountdown()
const stats = useStatsStore()

const phase = ref<Phase>('ready')
const round = ref<QuickMathSettings>({ ...props.settings })
const level = ref(stats.getStaircase(QUICK_MATH_ID, mathStaircase(props.settings)).level)
const problem = ref<Problem | null>(null)
const input = ref('')
const revealed = ref<number | null>(null)
const correct = ref(0)
const wrong = ref(0)
const outcome = ref<{
  from: number
  to: number
  streak: number
  passed: boolean
  accuracy: number
} | null>(null)
let resultShownAt = 0

const allOff = computed(() => enabledOps(props.settings).allOff)
/** Before a sprint: the current settings; during and after: the round's snapshot. */
const target = computed(() => {
  const s = phase.value === 'ready' ? props.settings : round.value
  return targetCorrect(level.value, s.sprintSeconds, enabledOps(s).ops)
})

onMounted(() => emit('level', level.value))

function nextProblem() {
  problem.value = generateProblem(
    rng,
    level.value,
    enabledOps(round.value).ops,
    problem.value?.text,
  )
  input.value = ''
  revealed.value = null
}

async function start() {
  round.value = { ...props.settings }
  level.value = stats.getStaircase(QUICK_MATH_ID, mathStaircase(round.value)).level
  correct.value = 0
  wrong.value = 0
  outcome.value = null
  problem.value = null
  nextProblem()
  phase.value = 'run'
  if ((await sprint.start(round.value.sprintSeconds * 1000)) === 'cancelled') return
  finish()
}

async function submit() {
  if (phase.value !== 'run' || !problem.value || revealed.value !== null) return
  const value = parseAnswer(input.value)
  if (value === null) return // empty or not a number: ignore
  if (value === problem.value.answer) {
    correct.value++
    nextProblem()
    return
  }
  wrong.value++
  revealed.value = problem.value.answer
  if ((await reveal.start(REVEAL_MS)) === 'done' && phase.value === 'run') nextProblem()
}

function finish() {
  reveal.cancel()
  const cfg = mathStaircase(round.value)
  const before = stats.getStaircase(QUICK_MATH_ID, cfg)
  const zone = mathOutcome(
    correct.value,
    wrong.value,
    before.level,
    round.value.sprintSeconds,
    enabledOps(round.value).ops,
  )
  const after = stepThreeZone(before, cfg, zone)
  stats.saveStaircase(QUICK_MATH_ID, after)
  const answered = correct.value + wrong.value
  const accuracy = answered === 0 ? 0 : correct.value / answered
  outcome.value = {
    from: before.level,
    to: after.level,
    streak: after.streakRight,
    passed: zone === 'pass',
    accuracy,
  }
  phase.value = 'result'
  resultShownAt = performance.now()
  emit('round-complete', {
    success: zone === 'pass',
    level: before.level,
    accuracy,
    durationMs: round.value.sprintSeconds * 1000,
    metrics: {
      correct: correct.value,
      wrong: wrong.value,
      sprintSeconds: round.value.sprintSeconds,
      perMinute: Math.round(((correct.value * 60) / round.value.sprintSeconds) * 10) / 10,
    },
  })
  level.value = after.level
  emit('level', after.level)
}

useGameKeys((e) => {
  if (e.key === 'Enter' && phase.value === 'ready') {
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
  <div class="quick-math">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Level {{ level }}</span>
        <span class="muted">
          · {{ settings.sprintSeconds }}s sprint · pass: {{ target }} correct at 90%+</span
        >
      </p>
      <p v-if="allOff" class="hint warn">All operations were off — using all of them.</p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start · type the answer, Enter to submit</p>
    </template>

    <template v-else-if="phase === 'run' && problem">
      <TimerBar :progress="sprint.progress.value" />
      <p class="score mono muted">✓ {{ correct }} · ✗ {{ wrong }} · target {{ target }}</p>
      <p class="problem mono" aria-live="polite">{{ problem.text }}</p>
      <p class="reveal mono" :class="{ shown: revealed !== null }" aria-live="assertive">
        <template v-if="revealed !== null">= {{ revealed }}</template>
      </p>
      <div class="answer-row">
        <RecallInput
          v-model="input"
          label="Answer"
          inputmode="numeric"
          :readonly="revealed !== null"
          @submit="submit"
        />
        <button
          type="button"
          class="primary ok"
          aria-label="Submit answer"
          @pointerdown.prevent
          @click="submit"
        >
          ✓
        </button>
      </div>
    </template>

    <template v-else-if="outcome">
      <p class="verdict" :class="outcome.passed ? 'ok' : 'bad'">
        {{ correct }} correct · {{ Math.round(outcome.accuracy * 100) }}% accuracy
      </p>
      <p class="mono small muted">
        {{ Math.round(((correct * 60) / round.sprintSeconds) * 10) / 10 }} per minute · needed
        {{ targetCorrect(outcome.from, round.sprintSeconds, enabledOps(round).ops) }} at 90%+
      </p>
      <p class="change mono">
        {{
          progressLabel(
            { ...outcome, upAfter: round.upAfter, max: mathStaircase(round).max },
            outcome.passed,
            {
              reset: outcome.accuracy >= 0.6,
            },
          )
        }}
      </p>
      <button type="button" class="primary next" @click="start">Next sprint</button>
      <p class="hint muted">Enter for the next sprint · under 60% lowers the level</p>
    </template>
  </div>
</template>

<style scoped>
.quick-math {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.quick-math p {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.small,
.hint,
.score {
  font-size: var(--text-sm);
}
.warn {
  color: var(--warning);
}
.problem {
  font-size: var(--text-display);
  white-space: nowrap;
}
.reveal {
  min-height: 1.6em;
  font-size: var(--text-lg);
  color: var(--danger);
}
.answer-row {
  width: min(100%, 22rem);
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
}
.answer-row :deep(.recall) {
  flex: 1;
}
.ok {
  height: 3.4rem;
  min-width: 3.4rem;
  font-size: var(--text-lg);
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
