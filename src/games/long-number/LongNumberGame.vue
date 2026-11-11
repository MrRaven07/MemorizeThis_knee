<script setup lang="ts">
import { computed, ref } from 'vue'
import RecallInput from '@/components/RecallInput.vue'
import ResultDiff from '@/components/ResultDiff.vue'
import TimerBar from '@/components/TimerBar.vue'
import { createRng, type Rng } from '@/core/random/rng'
import type { AlignResult } from '@/core/scoring/align'
import { useCountdown } from '@/core/timing/useCountdown'
import { useActiveTime } from '@/core/timing/useActiveTime'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import type { RoundResult } from '@/games/types'
import { formatGroups, generateGroups, scoreLongNumber, type LongNumberSettings } from './logic'

const props = defineProps<{ settings: LongNumberSettings; rng?: Rng }>()
const emit = defineEmits<{ 'round-complete': [result: RoundResult] }>()

type Phase = 'ready' | 'memorize' | 'delay' | 'recall' | 'result'

const rng = props.rng ?? createRng()
const countdown = useCountdown()
/** recall time, excluding a hidden tab */
const recallTime = useActiveTime()

const phase = ref<Phase>('ready')
/** Settings snapshot for the current round — changes apply next round. */
const round = ref<LongNumberSettings>({ ...props.settings })
const groups = ref<string[]>([])
const answer = ref('')
const result = ref<AlignResult | null>(null)

const shown = computed(() => (phase.value === 'ready' ? props.settings : round.value))
const totalDigits = computed(() => shown.value.groups * shown.value.digitsPerGroup)
const displayNumber = computed(() => formatGroups(groups.value, round.value.separateGroups))

async function start() {
  round.value = { ...props.settings }
  groups.value = generateGroups(rng, round.value)
  answer.value = ''
  result.value = null

  phase.value = 'memorize'
  if ((await countdown.start(round.value.memorizeSeconds * 1000)) === 'cancelled') return

  if (round.value.delaySeconds > 0) {
    phase.value = 'delay'
    if ((await countdown.start(round.value.delaySeconds * 1000)) === 'cancelled') return
  }

  phase.value = 'recall'
  recallTime.start()
  if (round.value.recallSeconds > 0) {
    const outcome = await countdown.start(round.value.recallSeconds * 1000)
    if (outcome === 'done') finish()
  }
}

function finish() {
  if (phase.value !== 'recall') return
  countdown.cancel()
  const r = scoreLongNumber(groups.value, answer.value)
  result.value = r
  phase.value = 'result'
  emit('round-complete', {
    success: r.exact,
    level: null,
    accuracy: r.accuracy,
    durationMs: Math.round(recallTime.stop()),
    metrics: { length: r.expectedLength, correct: r.correct },
  })
}

function skip() {
  if (phase.value === 'memorize' || phase.value === 'delay') countdown.finishNow()
}

useGameKeys((e) => {
  if (e.key === 'Escape' && (phase.value === 'memorize' || phase.value === 'delay')) {
    e.preventDefault() // tell GameShell not to quit
    skip()
  } else if (e.key === 'Enter' && (phase.value === 'ready' || phase.value === 'result')) {
    e.preventDefault()
    start()
  }
})
</script>

<template>
  <div class="long-number">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">{{ totalDigits }} digits</span>
        <span class="muted"> · {{ shown.memorizeSeconds }}s to memorize</span>
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start · Esc to skip the timer</p>
    </template>

    <template v-else-if="phase === 'memorize'">
      <TimerBar :progress="countdown.progress.value" />
      <p class="number mono" aria-live="polite">{{ displayNumber }}</p>
      <button type="button" class="skip" @click="skip">Skip timer</button>
    </template>

    <template v-else-if="phase === 'delay'">
      <TimerBar :progress="countdown.progress.value" />
      <p class="status">Get ready…</p>
      <button type="button" class="skip" @click="skip">Skip</button>
    </template>

    <template v-else-if="phase === 'recall'">
      <TimerBar v-if="round.recallSeconds > 0" :progress="countdown.progress.value" />
      <RecallInput
        v-model="answer"
        :label="`Type the ${round.groups * round.digitsPerGroup} digits`"
        @submit="finish"
      />
      <button type="button" class="primary finish" @click="finish">Finish</button>
    </template>

    <template v-else-if="result">
      <ResultDiff :ops="result.ops" />
      <p class="score">
        You got
        <strong class="mono">{{ result.correct }} of {{ result.expectedLength }}</strong> digits
        <span class="muted">({{ Math.round(result.accuracy * 100) }}%)</span>
      </p>
      <button type="button" class="primary again" @click="start">Play again</button>
    </template>
  </div>
</template>

<style scoped>
.long-number {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  text-align: center;
}
.intro {
  font-size: var(--text-lg);
  margin: 0;
}
.hint {
  font-size: var(--text-sm);
  margin: 0;
}
.number {
  font-size: var(--text-display);
  letter-spacing: 0.08em;
  word-break: break-all;
  margin: 0;
  color: var(--text);
}
.status {
  font-size: var(--text-lg);
  margin: 0;
}
.score {
  margin: 0;
}
.start,
.again,
.finish {
  min-width: 10rem;
  padding: var(--space-3) var(--space-5);
}
</style>
