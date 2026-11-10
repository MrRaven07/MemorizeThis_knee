<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TimerBar from '@/components/TimerBar.vue'
import { stepStaircase } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { useCountdown } from '@/core/timing/useCountdown'
import type { RoundResult } from '@/games/types'
import { useSettingsStore } from '@/stores/settings'
import { useStatsStore } from '@/stores/stats'
import MazeGrid from './MazeGrid.vue'
import RouteInput from './RouteInput.vue'
import {
  bfsPath,
  DIR_ARROW,
  DIR_DELTA,
  generateMaze,
  KEYMAPS,
  MAZE_ID,
  MAZE_STAIRCASE,
  mazeLevelInfo,
  mazeViewMs,
  parseRoute,
  simulateRoute,
  type Maze,
  type MazeSettings,
  type Outcome,
  type Pos,
  type Simulation,
} from './logic'

const props = defineProps<{ settings: MazeSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'show' | 'recall' | 'result'

const RESULT_ENTER_GUARD_MS = 300
const REPLAY_STEP_MS = 120

const VERDICT: Record<Outcome, string> = {
  win: 'Solved!',
  wall: 'Hit a wall',
  spike: 'Stepped on a spike',
  outside: 'Walked off the maze',
  short: "Didn't reach the end",
}

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const replay = useCountdown({ pauseWhenHidden: false })
const stats = useStatsStore()
const settingsStore = useSettingsStore()

const phase = ref<Phase>('ready')
const round = ref<MazeSettings>({ ...props.settings })
const level = ref(stats.getStaircase(MAZE_ID, MAZE_STAIRCASE).level)
const maze = ref<Maze | null>(null)
const route = ref('')
const sim = ref<Simulation | null>(null)
const shownSteps = ref(0)
const replayDone = ref(false)
const hint = ref<Pos[]>([])
const change = ref<{ from: number; to: number; streak: number } | null>(null)
let recallStartedAt = 0
let resultShownAt = 0

const info = computed(() => mazeLevelInfo(level.value))
const keys = computed(() => settingsStore.mazeKeys)
const legend = computed(() =>
  Object.entries(KEYMAPS[keys.value])
    .map(([k, d]) => `${k} ${DIR_ARROW[d]}`)
    .join('  '),
)
const replayPath = computed(() => sim.value?.path.slice(0, shownSteps.value) ?? [])

onMounted(() => emit('level', level.value))

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

async function start() {
  replay.cancel()
  round.value = { ...props.settings }
  level.value = stats.getStaircase(MAZE_ID, MAZE_STAIRCASE).level
  const lv = mazeLevelInfo(level.value)
  maze.value = generateMaze(rng, lv.size, lv.spikes)
  route.value = ''
  sim.value = null
  hint.value = []
  change.value = null

  phase.value = 'show'
  if ((await countdown.start(mazeViewMs(level.value, round.value.timeMultiplier))) === 'cancelled')
    return
  phase.value = 'recall'
  recallStartedAt = performance.now()
}

async function playReplay(s: Simulation) {
  replayDone.value = false
  shownSteps.value = 1
  if (reducedMotion()) {
    shownSteps.value = s.path.length
    replayDone.value = true
    return
  }
  while (shownSteps.value < s.path.length) {
    if ((await replay.start(REPLAY_STEP_MS)) === 'cancelled') return
    shownSteps.value++
  }
  if (s.failAt && (await replay.start(REPLAY_STEP_MS)) === 'cancelled') return
  replayDone.value = true
}

function submit() {
  if (phase.value !== 'recall' || !maze.value) return
  const s = simulateRoute(maze.value, parseRoute(route.value, keys.value))
  const best = bfsPath(maze.value)?.length ?? 1
  const win = s.outcome === 'win'
  const before = stats.getStaircase(MAZE_ID, MAZE_STAIRCASE)
  const after = stepStaircase(before, MAZE_STAIRCASE, win)
  stats.saveStaircase(MAZE_ID, after)

  sim.value = s
  change.value = { from: before.level, to: after.level, streak: after.streakRight }
  phase.value = 'result'
  resultShownAt = performance.now()

  const lv = mazeLevelInfo(before.level)
  emit('round-complete', {
    success: win,
    level: before.level,
    accuracy: win ? 1 : Math.min(1, (s.path.length - 1) / best),
    durationMs: Math.round(performance.now() - recallStartedAt),
    metrics: { size: lv.size, spikes: lv.spikes, moves: s.movesUsed, shortest: s.shortest ? 1 : 0 },
  })
  level.value = after.level
  emit('level', after.level)
  void playReplay(s)
}

function showShortest() {
  if (!maze.value) return
  const cells: Pos[] = [maze.value.start]
  let p = maze.value.start
  for (const d of bfsPath(maze.value) ?? []) {
    p = { x: p.x + DIR_DELTA[d].x, y: p.y + DIR_DELTA[d].y }
    cells.push(p)
  }
  hint.value = cells
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
  <div class="maze-game">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Level {{ level }}</span>
        <span class="muted">
          · {{ info.size }}×{{ info.size }} · {{ info.spikes }}
          {{ info.spikes === 1 ? 'spike' : 'spikes' }} ·
          {{ (mazeViewMs(level, settings.timeMultiplier) / 1000).toFixed(1) }}s</span
        >
      </p>
      <p class="muted legend mono">{{ legend }}</p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint-text muted">Enter to start · Esc to skip the timer</p>
    </template>

    <template v-else-if="phase === 'show' && maze">
      <TimerBar :progress="countdown.progress.value" />
      <MazeGrid :maze="maze" />
      <button type="button" class="skip" @click="countdown.finishNow()">Skip</button>
    </template>

    <template v-else-if="phase === 'recall'">
      <p class="muted legend mono">{{ legend }}</p>
      <RouteInput v-model="route" :keys="keys" @submit="submit" />
    </template>

    <template v-else-if="maze && sim && change">
      <MazeGrid
        :maze="maze"
        :path="replayPath"
        :fail-at="replayDone ? sim.failAt : null"
        :highlight="hint"
      />
      <p class="verdict" :class="sim.outcome === 'win' ? 'ok' : 'bad'">
        {{ VERDICT[sim.outcome] }}
        <span v-if="sim.shortest" class="star">· Shortest route ★</span>
      </p>
      <p class="change mono">
        <template v-if="change.to !== change.from"
          >Level {{ change.from }} → {{ change.to }}</template
        >
        <template v-else-if="sim.outcome === 'win'">
          Level {{ change.from }} (streak {{ change.streak }}/{{ MAZE_STAIRCASE.upAfter }})
        </template>
        <template v-else>Level {{ change.from }}</template>
      </p>
      <div class="actions">
        <button type="button" class="hint" @click="showShortest">Show a shortest route</button>
        <button type="button" class="primary next" @click="start">Next</button>
      </div>
      <p class="hint-text muted">Enter for the next maze</p>
    </template>
  </div>
</template>

<style scoped>
.maze-game {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.intro,
.legend,
.hint-text,
.verdict,
.change {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.legend,
.hint-text {
  font-size: var(--text-sm);
}
.verdict.ok {
  color: var(--accent);
}
.verdict.bad {
  color: var(--danger);
}
.star {
  color: var(--warning);
}
.change {
  color: var(--text-muted);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}
.start,
.next {
  min-width: 10rem;
  padding: var(--space-3) var(--space-5);
}
</style>
