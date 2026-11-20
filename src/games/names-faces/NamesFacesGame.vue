<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import ResultDiff from '@/components/ResultDiff.vue'
import TimerBar from '@/components/TimerBar.vue'
import { stepThreeZone } from '@/core/difficulty/staircase'
import { useGameKeys } from '@/core/keyboard/useGameKeys'
import { createRng, type Rng } from '@/core/random/rng'
import { alignStrings } from '@/core/scoring/align'
import { useCountdown } from '@/core/timing/useCountdown'
import { progressLabel } from '@/games/progress'
import type { RoundResult } from '@/games/types'
import { useStatsStore } from '@/stores/stats'
import FaceView from './FaceView.vue'
import { describeFace, generateFaces } from './faces'
import {
  DROP_ACCURACY,
  NAMES_FACES_ID,
  assignNames,
  nfLevelFaces,
  nfOutcome,
  nfStaircase,
  scorePerson,
  type NamesFacesSettings,
  type Person,
} from './logic'
import { getNameSet } from './names'

const props = defineProps<{ settings: NamesFacesSettings; rng?: Rng }>()
const emit = defineEmits<{
  'round-complete': [result: RoundResult]
  level: [level: number | null]
}>()

type Phase = 'ready' | 'study' | 'recall' | 'result'
const RESULT_ENTER_GUARD_MS = 300

const rng = props.rng ?? createRng()
const countdown = useCountdown()
const stats = useStatsStore()

const phase = ref<Phase>('ready')
const round = ref<NamesFacesSettings>({ ...props.settings })
const level = ref(stats.getStaircase(NAMES_FACES_ID, nfStaircase(props.settings)).level)
const people = ref<Person[]>([])
/** recall order (indexes into people) */
const order = ref<number[]>([])
const index = ref(0)
const firstAns = ref<string[]>([])
const lastAns = ref<string[]>([])
const firstInput = useTemplateRef<HTMLInputElement>('firstInput')
const lastInput = useTemplateRef<HTMLInputElement>('lastInput')
const results = ref<
  {
    person: Person
    first: string
    last: string
    points: number
    firstOk: boolean
    lastOk: boolean
  }[]
>([])
const outcome = ref<{
  from: number
  to: number
  streak: number
  accuracy: number
  passed: boolean
} | null>(null)
let recallStartedAt = 0
let resultShownAt = 0

const full = computed(() => round.value.nameStyle === 'full')
const current = computed(() => people.value[order.value[index.value] ?? -1])
const fullName = (p: Person) => (p.last ? `${p.first} ${p.last}` : p.first)

/** Per-part result for screen readers (the visual ✓ / ✗ marks are aria-hidden). */
function resultLabel(r: { person: Person; firstOk: boolean; lastOk: boolean }): string {
  const part = (ok: boolean) => (ok ? 'right' : 'wrong')
  return full.value
    ? `${fullName(r.person)}: first name ${part(r.firstOk)}, last name ${part(r.lastOk)}`
    : `${fullName(r.person)}: ${part(r.firstOk)}`
}

onMounted(() => emit('level', level.value))

async function start() {
  round.value = { ...props.settings }
  level.value = stats.getStaircase(NAMES_FACES_ID, nfStaircase(round.value)).level
  const n = nfLevelFaces(level.value)
  people.value = assignNames(
    rng,
    generateFaces(rng, n),
    getNameSet(round.value.country),
    round.value.nameStyle,
  )
  order.value = rng.shuffle(people.value.map((_, i) => i))
  index.value = 0
  firstAns.value = Array(n).fill('')
  lastAns.value = Array(n).fill('')
  results.value = []
  outcome.value = null

  phase.value = 'study'
  if ((await countdown.start(n * round.value.secondsPerFace * 1000)) === 'cancelled') return
  phase.value = 'recall'
  recallStartedAt = performance.now()
  await nextTick()
  firstInput.value?.focus()
}

async function focusFirst() {
  await nextTick()
  firstInput.value?.focus()
}

function onFirstEnter() {
  if (full.value) lastInput.value?.focus()
  else advance()
}

function advance() {
  if (index.value < order.value.length - 1) {
    index.value++
    void focusFirst()
  } else check()
}

function back() {
  if (index.value === 0) return
  index.value--
  void focusFirst()
}

function check() {
  if (phase.value !== 'recall') return
  results.value = order.value.map((pi, k) => {
    const person = people.value[pi]!
    const first = firstAns.value[k] ?? ''
    const last = lastAns.value[k] ?? ''
    return { person, first, last, ...scorePerson(person, first, last, full.value) }
  })
  const points = results.value.reduce((a, r) => a + r.points, 0)
  const accuracy = points / results.value.length
  const zone = nfOutcome(accuracy)
  const cfg = nfStaircase(round.value)
  const before = stats.getStaircase(NAMES_FACES_ID, cfg)
  const after = stepThreeZone(before, cfg, zone)
  stats.saveStaircase(NAMES_FACES_ID, after)
  outcome.value = {
    from: before.level,
    to: after.level,
    streak: after.streakRight,
    accuracy,
    passed: zone === 'pass',
  }
  phase.value = 'result'
  resultShownAt = performance.now()
  emit('round-complete', {
    success: zone === 'pass',
    level: before.level,
    accuracy,
    durationMs: Math.round(performance.now() - recallStartedAt),
    metrics: { faces: results.value.length, points, fullNames: full.value ? 1 : 0 },
  })
  level.value = after.level
  emit('level', after.level)
}

useGameKeys((e) => {
  if (e.key === 'Escape' && phase.value === 'study') {
    e.preventDefault()
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
  <div class="names-faces">
    <template v-if="phase === 'ready'">
      <p class="intro">
        <span class="mono">Level {{ level }}</span>
        <span class="muted">
          · {{ nfLevelFaces(level) }} faces ·
          {{ settings.nameStyle === 'full' ? 'first and last names' : 'first names' }} ·
          {{ getNameSet(settings.country).name }}</span
        >
      </p>
      <button type="button" class="primary start" @click="start">Start</button>
      <p class="hint muted">Study each face and its name. Diacritics are optional when typing.</p>
    </template>

    <template v-else-if="phase === 'study'">
      <div class="study-bar">
        <TimerBar :progress="countdown.progress.value" />
        <button type="button" class="primary done" @click="countdown.finishNow()">Done</button>
      </div>
      <ul class="study-grid">
        <li
          v-for="(p, i) in people"
          :key="i"
          class="study-card"
          :aria-label="`${fullName(p)}: ${describeFace(p.face)}`"
        >
          <FaceView :face="p.face" />
          <span class="name">{{ p.first }}</span>
          <span v-if="p.last" class="last">{{ p.last }}</span>
        </li>
      </ul>
    </template>

    <template v-else-if="phase === 'recall' && current">
      <p class="muted small">Face {{ index + 1 }} / {{ order.length }}</p>
      <div class="recall-card" role="img" :aria-label="describeFace(current.face)">
        <FaceView :face="current.face" />
      </div>
      <div class="inputs">
        <label class="field">
          <span class="muted small">{{ full ? 'First name' : 'Name' }}</span>
          <input
            ref="firstInput"
            v-model="firstAns[index]"
            name="first"
            autocomplete="off"
            autocapitalize="words"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            @keydown.enter.prevent="!($event as KeyboardEvent).repeat && onFirstEnter()"
          />
        </label>
        <label v-if="full" class="field">
          <span class="muted small">Last name</span>
          <input
            ref="lastInput"
            v-model="lastAns[index]"
            name="last"
            autocomplete="off"
            autocapitalize="words"
            autocorrect="off"
            spellcheck="false"
            enterkeyhint="next"
            @keydown.enter.prevent="!($event as KeyboardEvent).repeat && advance()"
          />
        </label>
      </div>
      <div class="row">
        <button
          type="button"
          class="back"
          :disabled="index === 0"
          @pointerdown.prevent
          @click="back"
        >
          ← Back
        </button>
        <button v-if="index < order.length - 1" type="button" @pointerdown.prevent @click="advance">
          Next →
        </button>
        <button type="button" class="primary check" @pointerdown.prevent @click="check">
          Check
        </button>
      </div>
      <p class="hint muted">Enter = next · leave empty to skip</p>
    </template>

    <template v-else-if="outcome">
      <ul class="results">
        <li
          v-for="(r, i) in results"
          :key="i"
          :class="r.points === 1 ? 'right' : 'wrong'"
          :aria-label="resultLabel(r)"
        >
          <span class="mini"><FaceView :face="r.person.face" /></span>
          <span class="who">
            <strong>{{ fullName(r.person) }}</strong>
            <span class="mark" aria-hidden="true">
              <template v-if="full">
                first {{ r.firstOk ? '✓' : '✗' }} · last {{ r.lastOk ? '✓' : '✗' }}</template
              >
              <template v-else>{{ r.points === 1 ? ' ✓' : ' ✗' }}</template>
            </span>
            <span v-if="!r.firstOk" class="answer">
              <ResultDiff :ops="alignStrings(r.person.first, r.first.trim()).ops" />
            </span>
            <span v-if="full && !r.lastOk" class="answer">
              <ResultDiff :ops="alignStrings(r.person.last, r.last.trim()).ops" />
            </span>
          </span>
        </li>
      </ul>
      <p class="verdict" :class="outcome.passed ? 'ok' : 'bad'">
        {{ Math.round(outcome.accuracy * 100) }}% of the names
      </p>
      <p class="change mono">
        {{
          progressLabel(
            { ...outcome, upAfter: round.upAfter, max: nfStaircase(round).max },
            outcome.passed,
            {
              reset: outcome.accuracy >= DROP_ACCURACY,
            },
          )
        }}
      </p>
      <button type="button" class="primary next" @click="start">Next round</button>
      <p class="hint muted">Enter for the next round · 90% passes, under 50% lowers the level</p>
    </template>
  </div>
</template>

<style scoped>
.names-faces {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}
.names-faces p {
  margin: 0;
}
.intro {
  font-size: var(--text-lg);
}
.small,
.hint {
  font-size: var(--text-sm);
}
.study-bar {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding-block: var(--space-2);
  background: var(--bg);
}
.study-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: var(--space-3);
}
.study-card,
.recall-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.recall-card {
  width: min(60vw, 13rem);
}
.name,
.last {
  overflow-wrap: anywhere;
}
.name {
  font-weight: 700;
  font-size: var(--text-lg);
}
.last {
  color: var(--text-muted);
}
.inputs {
  width: min(100%, 22rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-align: left;
}
.field input {
  font-size: var(--text-lg);
  padding: var(--space-3);
}
.row {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: center;
}
.results {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.results li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  text-align: left;
}
.results li.right {
  border-color: var(--accent-border);
}
.results li.wrong {
  border-color: var(--danger);
}
.mini {
  width: 3rem;
  flex-shrink: 0;
}
.who {
  display: flex;
  flex-direction: column;
}
.answer :deep(.diff) {
  font-size: var(--text-md);
  text-align: left;
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
.next,
.check,
.done {
  min-width: 8rem;
  padding: var(--space-3) var(--space-5);
}
</style>
