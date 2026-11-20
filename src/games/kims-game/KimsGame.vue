<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import TimerBar from '@/components/TimerBar.vue'
import { stepStaircase } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { useCountdown } from '@/core/timing/useCountdown'
import { progressLabel } from '@/games/progress'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import {
  GAP_MS,
  TRAY_COLS,
  chooseMissing,
  generateTray,
  kimLevelInfo,
  kimStaircase,
  kimViewMs,
  levelKey,
  listPicker,
  missingPicker,
  modeCode,
  partialTray,
  scoreKim,
  trayObjects,
  type KimMode,
  type KimScore,
  type KimsGameSettings,
  type Tray,
} from './logic'
import { objectById } from './objects'

const props = defineProps<{ settings: KimsGameSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

/** ready → show → [gap → partial tray] → pick → result */
type Phase = 'ready' | 'show' | 'gap' | 'pick' | 'result'
const RESULT_ENTER_GUARD_MS = 300
/** Picker columns: 4 keeps the names readable at 400 px. */
const PICKER_COLS = 4

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const stats = useStatsStore()

const levelFor = (s: KimsGameSettings) =>
  stats.getStaircase(levelKey(s.mode), kimStaircase(s)).level

const phase = ref<Phase>('ready')
const round = ref<KimsGameSettings>({ ...props.settings })
const level = ref(levelFor(props.settings))
const tray = ref<Tray>([])
/** what the player has to pick: every tray object (list) or the removed ones (missing) */
const targets = ref<string[]>([])
const choices = ref<string[]>([])
const picked = ref<Set<string>>(new Set())
const score = ref<KimScore | null>(null)
const change = ref<{ from: number; to: number; streak: number } | null>(null)
const active = ref(0)
const buttons = ref<HTMLButtonElement[]>([])
let lastTray: Tray | undefined
let viewMs = 0
let pickStartedAt = 0
let resultShownAt = 0

/** Shown on the intro: the chosen mode's level (it can change before the round starts). */
const intro = computed(() => {
  const info = kimLevelInfo(props.settings.mode, level.value)
  return { ...info, viewMs: kimViewMs(info.objects, props.settings.timeMultiplier) }
})
const isMissing = computed(() => round.value.mode === 'missing')
/** The tray shown while picking: the same cells minus the missing objects. */
const shownTray = computed(() =>
  isMissing.value ? partialTray(tray.value, targets.value) : tray.value,
)
const targetSet = computed(() => new Set(targets.value))
const wrongPicks = computed(() => [...picked.value].filter((id) => !targetSet.value.has(id)))

onMounted(() => emit('level', level.value))

// Each mode has its own level: show the chosen mode's level before the round starts.
watch(
  () => props.settings.mode,
  () => {
    if (phase.value !== 'ready' && phase.value !== 'result') return
    level.value = levelFor(props.settings)
    emit('level', level.value)
  },
)

const nameOf = (id: string) => objectById(id)?.name ?? id
const emojiOf = (id: string) => objectById(id)?.emoji ?? '?'

async function start() {
  round.value = { ...props.settings }
  const mode: KimMode = round.value.mode
  level.value = levelFor(round.value)
  emit('level', level.value)
  const info = kimLevelInfo(mode, level.value)
  tray.value = generateTray(rng, info.objects, lastTray)
  lastTray = tray.value
  if (mode === 'missing') {
    targets.value = chooseMissing(rng, tray.value, info.missing)
    choices.value = missingPicker(rng, tray.value, targets.value)
  } else {
    targets.value = trayObjects(tray.value)
    choices.value = listPicker(rng, tray.value)
  }
  picked.value = new Set()
  score.value = null
  change.value = null
  active.value = 0

  const planned = kimViewMs(info.objects, round.value.timeMultiplier)
  viewMs = planned
  phase.value = 'show'
  if ((await countdown.start(planned)) === 'cancelled') return
  if (mode === 'missing') {
    phase.value = 'gap'
    if ((await countdown.start(GAP_MS)) === 'cancelled') return
  }
  phase.value = 'pick'
  pickStartedAt = performance.now()
  await nextTick()
  buttons.value[0]?.focus()
}

function toggle(id: string) {
  if (phase.value !== 'pick') return
  const next = new Set(picked.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  picked.value = next
}

function check() {
  if (phase.value !== 'pick') return
  const s = scoreKim(targets.value, [...picked.value])
  const key = levelKey(round.value.mode)
  const cfg = kimStaircase(round.value)
  const before = stats.getStaircase(key, cfg)
  const after = stepStaircase(before, cfg, s.exact)
  stats.saveStaircase(key, after)
  score.value = s
  change.value = { from: before.level, to: after.level, streak: after.streakRight }
  phase.value = 'result'
  resultShownAt = performance.now()
  const info = kimLevelInfo(round.value.mode, before.level)
  emit('round-complete', {
    success: s.exact,
    level: before.level,
    accuracy: s.accuracy,
    durationMs: Math.round(performance.now() - pickStartedAt),
    metrics: {
      mode: modeCode(round.value.mode),
      objects: info.objects,
      missing: info.missing,
      hits: s.hits,
      misses: s.misses,
      wrong: s.wrong,
      viewMs,
    },
  })
  level.value = after.level
  emit('level', after.level)
}

/** Result marks on the original tray — never colour alone: ✓ recalled, ○ missed. */
function resultMark(id: string | null): { cls: string; mark: string } {
  if (id === null || !targetSet.value.has(id)) return { cls: '', mark: '' }
  return picked.value.has(id) ? { cls: 'hit', mark: '✓' } : { cls: 'missed', mark: '○' }
}

function resultLabel(id: string): string {
  const m = resultMark(id).cls
  return m === 'hit'
    ? `${nameOf(id)}, recalled`
    : m === 'missed'
      ? `${nameOf(id)}, missed`
      : nameOf(id)
}

function onKeydown(e: KeyboardEvent, i: number) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const n = choices.value.length
  const c = PICKER_COLS
  const moves: Record<string, number> = {
    ArrowRight: (i % c) + 1 < c && i + 1 < n ? i + 1 : i,
    ArrowLeft: i % c > 0 ? i - 1 : i,
    ArrowDown: i + c < n ? i + c : i,
    ArrowUp: i - c >= 0 ? i - c : i,
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
    // record the exposure the player actually had
    viewMs = Math.round(viewMs - countdown.remainingMs.value)
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
  <div class="kims-game">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Level {{ level }}</span>
        <span class="muted">
          · {{ intro.objects }} objects<template v-if="settings.mode === 'missing'">
            · {{ intro.missing }} missing</template
          >
          · {{ (intro.viewMs / 1000).toFixed(1) }}s</span
        >
      </p>
      <p class="muted small">
        {{
          settings.mode === 'missing'
            ? 'Study the tray. It comes back with objects missing: pick the ones that are gone.'
            : 'Study the tray. Then pick every object that was on it.'
        }}
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Enter to start · Esc to skip the viewing time</p>
    </template>

    <template v-else-if="phase === 'show'">
      <TimerBar :progress="countdown.progress.value" />
      <div
        class="tray"
        :style="{ gridTemplateColumns: `repeat(${TRAY_COLS}, 1fr)` }"
        role="list"
        aria-label="Tray to remember"
      >
        <div
          v-for="(id, i) in tray"
          :key="i"
          class="cell"
          :class="{ empty: id === null }"
          :data-id="id ?? undefined"
          :role="id === null ? undefined : 'listitem'"
          :aria-label="id === null ? undefined : nameOf(id)"
          :aria-hidden="id === null ? 'true' : undefined"
        >
          <span v-if="id !== null" class="emoji" aria-hidden="true">{{ emojiOf(id) }}</span>
        </div>
      </div>
    </template>

    <template v-else-if="phase === 'gap'">
      <div class="blank" aria-label="The tray is hidden" role="img" />
    </template>

    <template v-else-if="phase === 'pick'">
      <div
        v-if="isMissing"
        class="tray"
        :style="{ gridTemplateColumns: `repeat(${TRAY_COLS}, 1fr)` }"
        role="list"
        aria-label="The tray now"
      >
        <div
          v-for="(id, i) in shownTray"
          :key="i"
          class="cell"
          :class="{ empty: id === null }"
          :data-id="id ?? undefined"
          :role="id === null ? undefined : 'listitem'"
          :aria-label="id === null ? undefined : nameOf(id)"
          :aria-hidden="id === null ? 'true' : undefined"
        >
          <span v-if="id !== null" class="emoji" aria-hidden="true">{{ emojiOf(id) }}</span>
        </div>
      </div>
      <p class="muted small">
        {{ isMissing ? 'Which objects are missing?' : 'Which objects were on the tray?' }}
        ({{ picked.size }} / {{ targets.length }})
      </p>
      <div class="picker-scroll">
        <div
          class="picker"
          :style="{ gridTemplateColumns: `repeat(${PICKER_COLS}, 1fr)` }"
          role="group"
          :aria-label="isMissing ? 'Pick the missing objects' : 'Pick the tray objects'"
        >
          <button
            v-for="(id, i) in choices"
            :key="id"
            :ref="(el) => (buttons[i] = el as HTMLButtonElement)"
            type="button"
            class="choice"
            :class="{ picked: picked.has(id) }"
            :data-id="id"
            :aria-pressed="picked.has(id) ? 'true' : 'false'"
            :aria-label="nameOf(id)"
            :tabindex="i === active ? 0 : -1"
            @click="toggle(id)"
            @focus="active = i"
            @keydown="onKeydown($event, i)"
          >
            <span class="emoji" aria-hidden="true">{{ emojiOf(id) }}</span>
            <span class="name">{{ nameOf(id) }}</span>
          </button>
        </div>
      </div>
      <button type="button" class="primary check" @click="check">Check</button>
    </template>

    <template v-else-if="score && change">
      <div
        class="tray"
        :style="{ gridTemplateColumns: `repeat(${TRAY_COLS}, 1fr)` }"
        role="list"
        :aria-label="`The tray: ${score.hits} recalled, ${score.misses} missed, ${score.wrong} wrong`"
      >
        <div
          v-for="(id, i) in tray"
          :key="i"
          class="cell"
          :class="[
            id === null ? 'empty' : resultMark(id).cls,
            { kept: id !== null && !targetSet.has(id) },
          ]"
          :data-id="id ?? undefined"
          :role="id === null ? undefined : 'listitem'"
          :aria-label="id === null ? undefined : resultLabel(id)"
          :aria-hidden="id === null ? 'true' : undefined"
        >
          <template v-if="id !== null">
            <span class="emoji" aria-hidden="true">{{ emojiOf(id) }}</span>
            <span v-if="resultMark(id).mark" class="mark" aria-hidden="true">{{
              resultMark(id).mark
            }}</span>
          </template>
        </div>
      </div>
      <p class="verdict" :class="score.exact ? 'ok' : 'bad'">
        {{ score.exact ? 'All correct' : `${score.hits} of ${targets.length} recalled` }}
        <span v-if="score.wrong > 0" class="muted"> · {{ score.wrong }} wrong</span>
      </p>
      <ul v-if="wrongPicks.length > 0" class="wrong-list" aria-label="Wrong picks">
        <li v-for="id in wrongPicks" :key="id">
          <span aria-hidden="true">✗ {{ emojiOf(id) }}</span> {{ nameOf(id) }}
        </li>
      </ul>
      <p class="change mono">
        {{
          progressLabel(
            { ...change, upAfter: round.upAfter, max: kimStaircase(round).max },
            score.exact,
          )
        }}
      </p>
      <p class="legend muted small">✓ recalled · ○ missed · ✗ wrong pick</p>
      <button type="button" class="primary next" @click="start">Next</button>
      <p class="hint muted">Enter for the next tray</p>
    </template>
  </div>
</template>

<style scoped>
.kims-game {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.kims-game p {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.small,
.hint {
  font-size: var(--text-sm);
}
.tray,
.blank {
  width: min(100%, 28rem);
}
.tray {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius);
  background: var(--surface-raised);
  border: 1px solid var(--border);
}
.blank {
  aspect-ratio: 5 / 4;
  border-radius: var(--radius);
  background: var(--surface-raised);
  border: 1px solid var(--border);
}
.cell {
  position: relative;
  aspect-ratio: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
}
.emoji {
  font-size: clamp(1.5rem, 8vw, 2.25rem);
  line-height: 1;
}
.cell.hit {
  background: var(--accent-dim);
  border: 2px solid var(--accent);
}
.cell.missed {
  border: 2px dashed var(--warning);
}
.cell.kept {
  opacity: 0.45;
}
.mark {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: var(--text-sm);
  font-weight: 700;
}
.cell.hit .mark {
  color: var(--accent);
}
.cell.missed .mark {
  color: var(--warning);
}
/* the picker scrolls inside itself, so the page never does */
.picker-scroll {
  width: min(100%, 28rem);
  max-height: 55vh;
  overflow-y: auto;
  border-radius: var(--radius);
}
.picker {
  display: grid;
  gap: var(--space-2);
}
.choice {
  min-width: 0;
  min-height: 4.5rem;
  padding: var(--space-2) var(--space-1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  touch-action: manipulation;
}
.choice .emoji {
  font-size: 1.75rem;
}
.choice .name {
  font-size: 0.75rem;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.choice.picked {
  background: var(--accent-dim);
  border: 2px solid var(--accent);
}
.choice.picked .name {
  color: var(--accent);
  font-weight: 700;
}
.wrong-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}
.wrong-list li {
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--danger-dim);
  border: 1px solid var(--danger);
  color: var(--danger);
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
.next,
.check {
  min-width: 8rem;
  padding: var(--space-3) var(--space-5);
}
</style>
