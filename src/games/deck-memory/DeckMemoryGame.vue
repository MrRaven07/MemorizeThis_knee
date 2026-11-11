<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TimerBar from '@/components/TimerBar.vue'
import { formatDuration } from '@/core/format'
import { stepStaircase } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import type { SeqResult } from '@/core/scoring/align'
import { useActiveTime } from '@/core/timing/useActiveTime'
import { useCountdown } from '@/core/timing/useCountdown'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import CardPicker from './CardPicker.vue'
import PlayingCard from './PlayingCard.vue'
import { parseCodes, type CodeProblem } from './cards'
import {
  DECK_MEMORY_ID,
  DECK_STAIRCASE,
  dealSequence,
  deckLevelCards,
  scoreDeck,
  type DeckMemorySettings,
} from './logic'

const props = defineProps<{ settings: DeckMemorySettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'memorize' | 'recall' | 'result'

const RESULT_ENTER_GUARD_MS = 300

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const memoTimer = useActiveTime()
const stats = useStatsStore()

const phase = ref<Phase>('ready')
const round = ref<DeckMemorySettings>({ ...props.settings })
const level = ref(stats.getStaircase(DECK_MEMORY_ID, DECK_STAIRCASE).level)
const sequence = ref<number[]>([])
const pos = ref(0)
/** The player's answer — the single source of truth during recall. */
const answer = ref<number[]>([])
const codesText = ref('')
const problems = ref<CodeProblem[]>([])
const memoMs = ref(0)
const score = ref<SeqResult<number> | null>(null)
const change = ref<{ from: number; to: number; streak: number } | null>(null)
let recallStartedAt = 0
let resultShownAt = 0

const readyCards = computed(() => deckLevelCards(level.value))

onMounted(() => emit('level', level.value))

async function start() {
  round.value = { ...props.settings }
  level.value = stats.getStaircase(DECK_MEMORY_ID, DECK_STAIRCASE).level
  sequence.value = dealSequence(rng, deckLevelCards(level.value))
  pos.value = 0
  answer.value = []
  codesText.value = ''
  problems.value = []
  score.value = null
  change.value = null

  phase.value = 'memorize'
  memoTimer.start()
  const ms = sequence.value.length * round.value.secondsPerCard * 1000
  if ((await countdown.start(ms)) === 'cancelled') return
  memoMs.value = Math.round(memoTimer.stop())
  phase.value = 'recall'
  recallStartedAt = performance.now()
}

function move(delta: number) {
  pos.value = Math.min(sequence.value.length - 1, Math.max(0, pos.value + delta))
}

function pick(id: number) {
  if (!answer.value.includes(id)) answer.value.push(id)
}

function undo() {
  answer.value.pop()
}

function onCodesEnter() {
  if (codesText.value.trim() === '') {
    check()
    return
  }
  const r = parseCodes(codesText.value, new Set(answer.value))
  answer.value.push(...r.ids)
  problems.value = r.problems
  codesText.value = r.problems.map((p) => p.token).join(' ')
}

function check() {
  if (phase.value !== 'recall') return
  const s = scoreDeck(sequence.value, answer.value)
  const before = stats.getStaircase(DECK_MEMORY_ID, DECK_STAIRCASE)
  const after = stepStaircase(before, DECK_STAIRCASE, s.exact)
  stats.saveStaircase(DECK_MEMORY_ID, after)

  score.value = s
  change.value = { from: before.level, to: after.level, streak: after.streakRight }
  phase.value = 'result'
  resultShownAt = performance.now()
  emit('round-complete', {
    success: s.exact,
    level: before.level,
    accuracy: s.accuracy,
    durationMs: Math.round(performance.now() - recallStartedAt),
    metrics: { cards: sequence.value.length, correct: s.correct, memoMs: memoMs.value },
  })
  level.value = after.level
  emit('level', after.level)
}

useGameKeys((e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (phase.value === 'memorize') {
    if (e.key === 'ArrowRight') move(1)
    else if (e.key === 'ArrowLeft') move(-1)
    else if (e.key === 'Enter' || e.key === 'Escape') countdown.finishNow()
    else return
    e.preventDefault() // Esc must not quit the game (answer 001)
  } else if (phase.value === 'recall' && e.key === 'Backspace') {
    e.preventDefault()
    undo()
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
  <div class="deck-memory">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Level {{ level }}</span>
        <span class="muted">
          · {{ readyCards }} cards ·
          {{ formatDuration(readyCards * settings.secondsPerCard * 1000) }} to memorize</span
        >
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start · ← → flip through · Enter/Esc when done</p>
    </template>

    <template v-else-if="phase === 'memorize'">
      <TimerBar :progress="countdown.progress.value" />
      <div v-if="round.view === 'one'" class="memorize one">
        <p class="position mono muted">{{ pos + 1 }} / {{ sequence.length }}</p>
        <PlayingCard :id="sequence[pos]!" size="lg" />
        <div class="row">
          <button type="button" aria-label="Previous card" :disabled="pos === 0" @click="move(-1)">
            ‹
          </button>
          <button
            type="button"
            aria-label="Next card"
            :disabled="pos === sequence.length - 1"
            @click="move(1)"
          >
            ›
          </button>
        </div>
      </div>
      <div v-else class="memorize row-view">
        <PlayingCard v-for="(id, i) in sequence" :key="i" :id="id" size="md" />
      </div>
      <button type="button" class="primary done" @click="countdown.finishNow()">Done</button>
    </template>

    <template v-else-if="phase === 'recall'">
      <p class="muted small">
        Rebuild the order: {{ answer.length }} / {{ sequence.length }} placed
      </p>
      <div class="answer" aria-label="Your answer so far">
        <PlayingCard v-for="(id, i) in answer" :key="i" :id="id" size="sm" />
        <span v-if="answer.length === 0" class="muted small">tap cards below, or type codes</span>
      </div>
      <CardPicker :used="answer" @pick="pick" />
      <label class="codes">
        <span class="muted small">Type codes (e.g. AS 10H QD) and press Enter</span>
        <input
          v-model="codesText"
          name="codes"
          class="mono"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          @keydown.enter.prevent="onCodesEnter"
        />
      </label>
      <p v-if="problems.length > 0" class="code-problems" role="alert">
        <span v-for="(p, i) in problems" :key="i"
          >“{{ p.token }}” {{ p.reason === 'invalid' ? 'is not a card' : 'is already placed' }}.
        </span>
      </p>
      <div class="row">
        <button type="button" class="undo" :disabled="answer.length === 0" @click="undo">
          Undo
        </button>
        <button type="button" :disabled="answer.length === 0" @click="answer = []">Clear</button>
        <button type="button" class="primary check" @click="check">Check</button>
      </div>
    </template>

    <template v-else-if="score && change">
      <ol class="ops">
        <li v-for="(op, i) in score.ops" :key="i" :class="`op-${op.kind}`">
          <template v-if="op.kind === 'match'"><PlayingCard :id="op.item" size="sm" /></template>
          <template v-else-if="op.kind === 'substitute'">
            <PlayingCard :id="op.actual" size="sm" />
            <span class="muted small">was</span>
            <PlayingCard :id="op.expected" size="sm" />
          </template>
          <template v-else-if="op.kind === 'missing'">
            <span class="muted small">missing</span>
            <PlayingCard :id="op.expected" size="sm" />
          </template>
          <template v-else>
            <PlayingCard :id="op.actual" size="sm" />
            <span class="muted small">extra</span>
          </template>
        </li>
      </ol>
      <p class="verdict" :class="score.exact ? 'ok' : 'bad'">
        {{ score.exact ? 'Perfect order' : `${score.correct} of ${score.expectedLength} in place` }}
        <span class="muted"> · memorized in {{ formatDuration(memoMs) }}</span>
      </p>
      <p class="change mono">
        <template v-if="change.to !== change.from"
          >Level {{ change.from }} → {{ change.to }}</template
        >
        <template v-else-if="score.exact">
          Level {{ change.from }} (streak {{ change.streak }}/{{ DECK_STAIRCASE.upAfter }})
        </template>
        <template v-else>Level {{ change.from }}</template>
      </p>
      <button type="button" class="primary next" @click="start">Next</button>
      <p class="hint muted">Enter for the next deal</p>
    </template>
  </div>
</template>

<style scoped>
.deck-memory {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.deck-memory p {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.hint,
.small {
  font-size: var(--text-sm);
}
.memorize.one {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.row-view {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
}
.row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: center;
}
.row button {
  min-width: 3rem;
}
.answer {
  width: 100%;
  min-height: 3.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  align-items: center;
}
.codes {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.codes input {
  width: 100%;
  text-transform: uppercase;
}
.code-problems {
  color: var(--warning);
  font-size: var(--text-sm);
}
.ops {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}
.ops li {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border-radius: var(--radius-sm);
}
.op-match {
  box-shadow: inset 0 0 0 2px var(--accent-border);
}
.op-substitute,
.op-missing,
.op-extra {
  box-shadow: inset 0 0 0 2px var(--danger);
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
.done,
.check {
  min-width: 8rem;
  padding: var(--space-3) var(--space-5);
}
</style>
