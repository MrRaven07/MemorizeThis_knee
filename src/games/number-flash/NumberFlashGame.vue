<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import RecallInput from '@/components/RecallInput.vue'
import ResultDiff from '@/components/ResultDiff.vue'
import TimerBar from '@/components/TimerBar.vue'
import { stepStaircase } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, randomDigits, type Rng } from '@/core/random/rng'
import type { AlignResult } from '@/core/scoring/align'
import { useCountdown } from '@/core/timing/useCountdown'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import {
  NUMBER_FLASH_ID,
  numberFlashStaircase,
  revealSchedule,
  scoreFlash,
  visibleDigits,
  type NumberFlashSettings,
  type RevealSchedule,
} from './logic'

const props = defineProps<{ settings: NumberFlashSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'show' | 'recall' | 'result'

/** Enter on the result screen is ignored this long, so the submit Enter can't skip it (question 006). */
const RESULT_ENTER_GUARD_MS = 300

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const stats = useStatsStore()

const phase = ref<Phase>('ready')
/** Settings snapshot for the current round — changes apply next round. */
const round = ref<NumberFlashSettings>({ ...props.settings })
const level = ref(stats.getStaircase(NUMBER_FLASH_ID, numberFlashStaircase(props.settings)).level)
const target = ref('')
const schedule = ref<RevealSchedule | null>(null)
const answer = ref('')
const result = ref<AlignResult | null>(null)
const change = ref<{ from: number; to: number; streak: number; upAfter: number } | null>(null)
let recallStartedAt = 0
let resultShownAt = 0

const elapsedMs = computed(() =>
  schedule.value ? schedule.value.hideAtMs - countdown.remainingMs.value : 0,
)
const shownCount = computed(() =>
  schedule.value ? visibleDigits(schedule.value, elapsedMs.value) : 0,
)

onMounted(() => emit('level', level.value))

async function start() {
  round.value = { ...props.settings }
  level.value = stats.getStaircase(NUMBER_FLASH_ID, numberFlashStaircase(round.value)).level
  target.value = randomDigits(rng, level.value)
  schedule.value = revealSchedule(level.value, round.value)
  answer.value = ''
  result.value = null
  change.value = null

  phase.value = 'show'
  if ((await countdown.start(schedule.value.hideAtMs)) === 'cancelled') return
  phase.value = 'recall'
  recallStartedAt = performance.now()
}

function submit() {
  if (phase.value !== 'recall') return
  const r = scoreFlash(target.value, answer.value)
  const cfg = numberFlashStaircase(round.value)
  const before = stats.getStaircase(NUMBER_FLASH_ID, cfg)
  const after = stepStaircase(before, cfg, r.exact)
  stats.saveStaircase(NUMBER_FLASH_ID, after)

  result.value = r
  change.value = {
    from: before.level,
    to: after.level,
    streak: after.streakRight,
    upAfter: cfg.upAfter,
  }
  phase.value = 'result'
  resultShownAt = performance.now()

  emit('round-complete', {
    success: r.exact,
    level: before.level,
    accuracy: r.accuracy,
    durationMs: Math.round(performance.now() - recallStartedAt),
    metrics: { length: before.level, correct: r.correct },
  })
  level.value = after.level
  emit('level', after.level)
}

useGameKeys((e) => {
  if (e.key === 'Escape' && phase.value === 'show') {
    e.preventDefault() // tell GameShell not to quit
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
  <div class="number-flash">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Length {{ level }}</span>
        <span class="muted"> · digits flash, then type them back</span>
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start · Esc to skip the reveal</p>
    </template>

    <template v-else-if="phase === 'show'">
      <TimerBar :progress="countdown.progress.value" />
      <p class="digits mono" aria-live="polite">
        <span v-for="(d, i) in target" :key="i" class="digit" :class="{ shown: i < shownCount }">{{
          i < shownCount ? d : '·'
        }}</span>
      </p>
      <button type="button" class="skip" @click="countdown.finishNow()">Skip</button>
    </template>

    <template v-else-if="phase === 'recall'">
      <RecallInput v-model="answer" :label="`Type the ${target.length} digits`" @submit="submit" />
      <button type="button" class="primary finish" @click="submit">Check</button>
    </template>

    <template v-else-if="result && change">
      <ResultDiff :ops="result.ops" />
      <p class="verdict" :class="result.exact ? 'ok' : 'bad'">
        {{ result.exact ? 'Correct' : 'Not quite' }}
      </p>
      <p class="change mono">
        <template v-if="change.to !== change.from"
          >Length {{ change.from }} → {{ change.to }}</template
        >
        <template v-else-if="result.exact">
          Length {{ change.from }} (streak {{ change.streak }}/{{ change.upAfter }})
        </template>
        <template v-else>Length {{ change.from }}</template>
      </p>
      <button type="button" class="primary next" @click="start">Next</button>
      <p class="hint muted">Enter for the next number</p>
    </template>
  </div>
</template>

<style scoped>
.number-flash {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  text-align: center;
}
.intro,
.hint,
.verdict,
.change {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.hint {
  font-size: var(--text-sm);
}
.digits {
  font-size: var(--text-display);
  letter-spacing: 0.08em;
  margin: 0;
  word-break: break-all;
}
.digit {
  color: var(--border);
}
.digit.shown {
  color: var(--text);
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
.finish {
  min-width: 10rem;
  padding: var(--space-3) var(--space-5);
}
</style>
