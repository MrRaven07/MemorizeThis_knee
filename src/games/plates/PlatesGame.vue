<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import RecallInput from '@/components/RecallInput.vue'
import ResultDiff from '@/components/ResultDiff.vue'
import TimerBar from '@/components/TimerBar.vue'
import { stepStaircase } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { useCountdown } from '@/core/timing/useCountdown'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import PlateView from './PlateView.vue'
import { getPlateFormat } from './formats'
import {
  generateRound,
  levelInfo,
  PLATES_ID,
  PLATES_STAIRCASE,
  platesStaircase,
  scorePlates,
  viewMs,
  type PlateRound,
  type PlatesScore,
  type PlatesSettings,
} from './logic'

const props = defineProps<{ settings: PlatesSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'show' | 'recall' | 'result'

/** Same guard as Number Flash (question 006). */
const RESULT_ENTER_GUARD_MS = 300

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const stats = useStatsStore()

const phase = ref<Phase>('ready')
const round = ref<PlatesSettings>({ ...props.settings })
const level = ref(stats.getStaircase(PLATES_ID, PLATES_STAIRCASE).level)
const current = ref<PlateRound | null>(null)
const answers = ref<string[]>([])
const score = ref<PlatesScore | null>(null)
const change = ref<{ from: number; to: number; streak: number } | null>(null)
const inputs = ref<({ focus(): void } | null)[]>([])
let recallStartedAt = 0
let resultShownAt = 0

const format = computed(() => getPlateFormat(round.value.country))
const info = computed(() => levelInfo(level.value))

onMounted(() => emit('level', level.value))

async function start() {
  round.value = { ...props.settings }
  level.value = stats.getStaircase(PLATES_ID, platesStaircase(round.value)).level
  current.value = generateRound(rng, level.value, format.value)
  answers.value = current.value.plates.map(() => '')
  inputs.value = []
  score.value = null
  change.value = null

  phase.value = 'show'
  if ((await countdown.start(viewMs(level.value, round.value.timeMultiplier))) === 'cancelled')
    return
  phase.value = 'recall'
  recallStartedAt = performance.now()
}

function onInputSubmit(i: number) {
  if (!current.value) return
  if (i < current.value.plates.length - 1) {
    inputs.value[i + 1]?.focus() // synchronously, so phone keyboards stay open
  } else {
    submit()
  }
}

function submit() {
  if (phase.value !== 'recall' || !current.value) return
  const s = scorePlates(current.value.plates, answers.value)
  const before = stats.getStaircase(PLATES_ID, platesStaircase(round.value))
  const after = stepStaircase(before, platesStaircase(round.value), s.success)
  stats.saveStaircase(PLATES_ID, after)

  score.value = s
  change.value = { from: before.level, to: after.level, streak: after.streakRight }
  phase.value = 'result'
  resultShownAt = performance.now()

  emit('round-complete', {
    success: s.success,
    level: before.level,
    accuracy: s.accuracy,
    durationMs: Math.round(performance.now() - recallStartedAt),
    metrics: {
      plates: current.value.plates.length,
      correct: s.perPlate.filter((r) => r.exact).length,
    },
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
  <div class="plates-game">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Level {{ level }}</span>
        <span class="muted">
          · {{ info.plates }} {{ info.plates === 1 ? 'plate' : 'plates' }} ·
          {{ (viewMs(level, settings.timeMultiplier) / 1000).toFixed(1) }}s</span
        >
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start · Esc to skip the timer</p>
    </template>

    <template v-else-if="phase === 'show' && current">
      <TimerBar :progress="countdown.progress.value" />
      <div class="plates">
        <PlateView
          v-for="(p, i) in current.plates"
          :key="p.text"
          :plate="p"
          :format="format"
          :scale="current.scales[i]"
        />
      </div>
      <button type="button" class="skip" @click="countdown.finishNow()">Skip</button>
    </template>

    <template v-else-if="phase === 'recall' && current">
      <div class="answers">
        <RecallInput
          v-for="(p, i) in current.plates"
          :key="i"
          :ref="(el) => (inputs[i] = el as { focus(): void } | null)"
          v-model="answers[i]!"
          class="plate-input"
          inputmode="text"
          :label="`Plate ${i + 1}`"
          :autofocus="i === 0"
          autocapitalize="characters"
          :enterkeyhint="i < current.plates.length - 1 ? 'next' : 'done'"
          @submit="onInputSubmit(i)"
        />
      </div>
      <button type="button" class="primary finish" @click="submit">Check</button>
    </template>

    <template v-else-if="current && score && change">
      <ul class="results">
        <li v-for="(p, i) in current.plates" :key="p.text">
          <PlateView :plate="p" :format="format" :scale="0.7" />
          <ResultDiff :ops="score.perPlate[i]!.ops" />
        </li>
      </ul>
      <p class="verdict" :class="score.success ? 'ok' : 'bad'">
        {{ score.success ? 'All correct' : 'Not quite' }}
      </p>
      <p class="change mono">
        <template v-if="change.to !== change.from"
          >Level {{ change.from }} → {{ change.to }}</template
        >
        <template v-else-if="score.success">
          Level {{ change.from }} (streak {{ change.streak }}/{{ round.upAfter }})
        </template>
        <template v-else>Level {{ change.from }}</template>
      </p>
      <button type="button" class="primary next" @click="start">Next</button>
      <p class="hint muted">Enter for the next round</p>
    </template>
  </div>
</template>

<style scoped>
.plates-game {
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
.plates {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-4);
}
.answers {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.plate-input :deep(input) {
  text-transform: uppercase;
  font-size: var(--text-lg);
}
.results {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}
.results li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}
.results :deep(.diff) {
  font-size: var(--text-lg);
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
