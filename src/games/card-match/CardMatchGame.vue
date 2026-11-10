<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import TimerBar from '@/components/TimerBar.vue'
import { stepStaircase } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { useActiveTime } from '@/core/timing/useActiveTime'
import { useCountdown } from '@/core/timing/useCountdown'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import CardGrid from './CardGrid.vue'
import {
  CARD_MATCH_ID,
  CARD_STAIRCASE,
  cardLevelInfo,
  clearPending,
  createBoard,
  dealCards,
  faceUp,
  flip,
  isComplete,
  pairsOf,
  previewMs,
  type Board,
  type CardMatchSettings,
} from './logic'

const props = defineProps<{ settings: CardMatchSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'preview' | 'play' | 'result'

const RESULT_ENTER_GUARD_MS = 300
/** A mismatched pair stays visible this long (question 009). */
const FLIP_BACK_MS = 700

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const flipBack = useCountdown()
const playTime = useActiveTime()
const stats = useStatsStore()

const phase = ref<Phase>('ready')
const round = ref<CardMatchSettings>({ ...props.settings })
const level = ref(stats.getStaircase(CARD_MATCH_ID, CARD_STAIRCASE).level)
const board = ref<Board | null>(null)
const playedLevel = ref(1)
const change = ref<{ from: number; to: number; streak: number } | null>(null)
const grid = useTemplateRef<{ focus(): void }>('grid')
let resultShownAt = 0

const info = computed(() =>
  cardLevelInfo(phase.value === 'ready' ? level.value : playedLevel.value),
)
const pairs = computed(() => pairsOf(info.value))
const readyPreviewMs = computed(() => previewMs(level.value, props.settings.previewSecondsPerPair))
const faceUpList = computed(() =>
  board.value
    ? board.value.cards.map((_, i) => phase.value === 'preview' || faceUp(board.value!, i))
    : [],
)

onMounted(() => emit('level', level.value))

async function start() {
  flipBack.cancel()
  round.value = { ...props.settings }
  level.value = stats.getStaircase(CARD_MATCH_ID, CARD_STAIRCASE).level
  playedLevel.value = level.value
  const ms = previewMs(level.value, round.value.previewSecondsPerPair)
  board.value = createBoard(dealCards(rng, pairsOf(cardLevelInfo(level.value))), ms > 0)
  change.value = null

  if (ms > 0) {
    phase.value = 'preview'
    if ((await countdown.start(ms)) === 'cancelled') return
  }
  phase.value = 'play'
  playTime.start()
  // Keyboard players land on the cards instead of losing focus to <body>.
  await nextTick()
  grid.value?.focus()
}

function onFlip(i: number) {
  if (phase.value !== 'play' || !board.value) return
  if (board.value.pending) flipBack.cancel()
  const r = flip(board.value, i)
  board.value = r.board
  if (r.event === 'mismatch') {
    flipBack.start(FLIP_BACK_MS).then((outcome) => {
      if (outcome === 'done' && board.value) board.value = clearPending(board.value)
    })
  } else if (r.event === 'match' && isComplete(r.board)) {
    finish()
  }
}

function finish() {
  if (!board.value) return
  const b = board.value
  const durationMs = Math.round(playTime.stop())
  const success = b.memoryMistakes === 0
  const before = stats.getStaircase(CARD_MATCH_ID, CARD_STAIRCASE)
  const after = stepStaircase(before, CARD_STAIRCASE, success)
  stats.saveStaircase(CARD_MATCH_ID, after)

  change.value = { from: before.level, to: after.level, streak: after.streakRight }
  phase.value = 'result'
  resultShownAt = performance.now()
  const l = cardLevelInfo(before.level)
  const p = pairsOf(l)
  emit('round-complete', {
    success,
    level: before.level,
    accuracy: b.moves === 0 ? 1 : p / b.moves,
    durationMs,
    metrics: {
      pairs: p,
      rows: l.rows,
      cols: l.cols,
      moves: b.moves,
      extraMoves: b.moves - p,
      memoryMistakes: b.memoryMistakes,
      preview: round.value.previewSecondsPerPair > 0 ? 1 : 0,
    },
  })
  level.value = after.level
  emit('level', after.level)
}

useGameKeys((e) => {
  if (e.key === 'Escape' && phase.value === 'preview') {
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
  <div class="card-match">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Level {{ level }}</span>
        <span class="muted">
          · {{ info.rows }}×{{ info.cols }} ·
          {{ readyPreviewMs > 0 ? `preview ${(readyPreviewMs / 1000).toFixed(1)}s` : 'no preview' }}
        </span>
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start · Esc to skip the preview</p>
    </template>

    <template v-else-if="(phase === 'preview' || phase === 'play') && board">
      <TimerBar v-if="phase === 'preview'" :progress="countdown.progress.value" />
      <p v-else class="counter mono muted">Moves {{ board.moves }} · minimum {{ pairs }}</p>
      <CardGrid
        ref="grid"
        :cards="board.cards"
        :face-up="faceUpList"
        :matched="board.matched"
        :rows="info.rows"
        :cols="info.cols"
        @flip="onFlip"
      />
      <button v-if="phase === 'preview'" type="button" class="skip" @click="countdown.finishNow()">
        Skip
      </button>
    </template>

    <template v-else-if="board && change">
      <p class="score">
        Cleared in <strong class="mono">{{ board.moves }}</strong> moves
        <span class="muted">(minimum {{ pairs }})</span>
      </p>
      <p class="mono">Memory mistakes: {{ board.memoryMistakes }}</p>
      <p class="verdict" :class="board.memoryMistakes === 0 ? 'ok' : 'bad'">
        {{ board.memoryMistakes === 0 ? 'Perfect memory' : 'You forgot where a card was' }}
      </p>
      <p class="change mono">
        <template v-if="change.to !== change.from"
          >Level {{ change.from }} → {{ change.to }}</template
        >
        <template v-else-if="board.memoryMistakes === 0">
          Level {{ change.from }} (streak {{ change.streak }}/{{ CARD_STAIRCASE.upAfter }})
        </template>
        <template v-else>Level {{ change.from }}</template>
      </p>
      <button type="button" class="primary next" @click="start">Next</button>
      <p class="hint muted">Enter for the next round</p>
    </template>
  </div>
</template>

<style scoped>
.card-match {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.card-match p {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.hint,
.counter {
  font-size: var(--text-sm);
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
