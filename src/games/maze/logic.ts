import type { StaircaseConfig } from '@/core/difficulty/staircase'
import type { Rng } from '@/core/random/rng'
import type { GameSettings, GameSummary, RoundRecord, SettingField } from '@/games/types'
import type { MazeKeys } from '@/stores/settings'

/**
 * Maze: see a maze with walls and spikes for a few seconds, then type the
 * whole route. Spec §6.4, question 008.
 *
 * Grid: odd size N, cells[y][x]. Rooms at even,even; cells with one odd
 * coordinate are walls between rooms; odd,odd are pillars (always walls).
 * No outer wall ring — stepping off the grid is the edge.
 */
export const MAZE_ID = 'maze'

export type Cell = 'open' | 'wall' | 'spike'
export interface Pos {
  x: number
  y: number
}
export type Dir = 'up' | 'left' | 'down' | 'right'
export type { MazeKeys }

export interface Maze {
  size: number
  cells: Cell[][]
  start: Pos
  end: Pos
}

/** Share of remaining between-room walls opened after carving, so mazes have loops. */
export const EXTRA_OPENING_RATE = 0.1

export const DIR_DELTA: Record<Dir, Pos> = {
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  down: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
}
const DIRS: Dir[] = ['up', 'left', 'down', 'right']

export const DIR_ARROW: Record<Dir, string> = { up: '↑', left: '←', down: '↓', right: '→' }

export const KEYMAPS: Record<MazeKeys, Record<string, Dir>> = {
  wasd: { w: 'up', a: 'left', s: 'down', d: 'right' },
  '1234': { '1': 'up', '2': 'left', '3': 'down', '4': 'right' },
}

const inside = (m: Maze, p: Pos) => p.x >= 0 && p.y >= 0 && p.x < m.size && p.y < m.size
const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y

export function generateMaze(rng: Rng, size: number, spikes: number): Maze {
  const cells: Cell[][] = Array.from({ length: size }, () => Array<Cell>(size).fill('wall'))
  const rooms = (size + 1) / 2
  const maze: Maze = { size, cells, start: { x: 0, y: 0 }, end: { x: size - 1, y: size - 1 } }

  // Randomized depth-first carve over rooms.
  const visited = new Set<string>()
  const stack: Pos[] = [{ x: 0, y: 0 }]
  visited.add('0,0')
  cells[0]![0] = 'open'
  while (stack.length > 0) {
    const room = stack.at(-1)!
    const next = rng
      .shuffle(DIRS)
      .map((d) => ({ x: room.x + DIR_DELTA[d].x, y: room.y + DIR_DELTA[d].y }))
      .find(
        (r) => r.x >= 0 && r.y >= 0 && r.x < rooms && r.y < rooms && !visited.has(`${r.x},${r.y}`),
      )
    if (!next) {
      stack.pop()
      continue
    }
    visited.add(`${next.x},${next.y}`)
    cells[next.y * 2]![next.x * 2] = 'open'
    cells[room.y + next.y]![room.x + next.x] = 'open' // the wall between (in cell coordinates)
    stack.push(next)
  }

  // Extra openings → loops, so "shortest route" means something. Exactly
  // EXTRA_OPENING_RATE of the remaining between-room walls (at least one).
  const closed: Pos[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const between = (x % 2 === 1) !== (y % 2 === 1)
      if (between && cells[y]![x] === 'wall') closed.push({ x, y })
    }
  }
  const extra =
    closed.length === 0 ? 0 : Math.max(1, Math.round(closed.length * EXTRA_OPENING_RATE))
  for (const p of rng.shuffle(closed).slice(0, extra)) cells[p.y]![p.x] = 'open'

  // Spikes: keep each only if the maze stays solvable. Always terminates.
  const candidates: Pos[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = { x, y }
      const nearStart = Math.abs(x) + Math.abs(y) <= 1
      if (cells[y]![x] === 'open' && !nearStart && !same(p, maze.end)) candidates.push(p)
    }
  }
  let placed = 0
  for (const p of rng.shuffle(candidates)) {
    if (placed >= spikes) break
    cells[p.y]![p.x] = 'spike'
    if (bfsPath(maze) === null) cells[p.y]![p.x] = 'open'
    else placed++
  }
  return maze
}

/** A shortest route from start to end, or null if there is none. */
export function bfsPath(maze: Maze): Dir[] | null {
  const key = (p: Pos) => p.y * maze.size + p.x
  const prev = new Map<number, { from: Pos; dir: Dir }>()
  const queue: Pos[] = [maze.start]
  const seen = new Set([key(maze.start)])
  while (queue.length > 0) {
    const p = queue.shift()!
    if (same(p, maze.end)) {
      const route: Dir[] = []
      let cur = p
      while (!same(cur, maze.start)) {
        const step = prev.get(key(cur))!
        route.push(step.dir)
        cur = step.from
      }
      return route.reverse()
    }
    for (const d of DIRS) {
      const n = { x: p.x + DIR_DELTA[d].x, y: p.y + DIR_DELTA[d].y }
      if (!inside(maze, n) || seen.has(key(n)) || maze.cells[n.y]![n.x] !== 'open') continue
      seen.add(key(n))
      prev.set(key(n), { from: p, dir: d })
      queue.push(n)
    }
  }
  return null
}

export function parseRoute(text: string, keys: MazeKeys): Dir[] {
  const map = KEYMAPS[keys]
  return Array.from(text.toLowerCase()).flatMap((ch) => (map[ch] ? [map[ch]] : []))
}

export type Outcome = 'win' | 'wall' | 'spike' | 'outside' | 'short'

export interface Simulation {
  outcome: Outcome
  /** visited cells, start first; the failing cell is not included */
  path: Pos[]
  failAt: Pos | null
  movesUsed: number
  shortest: boolean
}

export function simulateRoute(maze: Maze, route: Dir[]): Simulation {
  const path: Pos[] = [maze.start]
  let p = maze.start
  for (let i = 0; i < route.length; i++) {
    const d = DIR_DELTA[route[i]!]
    const n = { x: p.x + d.x, y: p.y + d.y }
    const fail = (outcome: Outcome, failAt: Pos | null): Simulation => ({
      outcome,
      path,
      failAt,
      movesUsed: i + 1,
      shortest: false,
    })
    if (!inside(maze, n)) return fail('outside', null)
    const cell = maze.cells[n.y]![n.x]
    if (cell === 'wall') return fail('wall', n)
    if (cell === 'spike') return fail('spike', n)
    path.push(n)
    p = n
    if (same(p, maze.end)) {
      const best = bfsPath(maze)
      return {
        outcome: 'win',
        path,
        failAt: null,
        movesUsed: i + 1,
        shortest: best?.length === i + 1,
      }
    }
  }
  return { outcome: 'short', path, failAt: null, movesUsed: route.length, shortest: false }
}

export interface MazeSettings extends GameSettings {
  /** correct rounds in a row to level up (question 007) */
  upAfter: number
  timeMultiplier: number
}

export const MAZE_DEFAULTS: MazeSettings = { timeMultiplier: 1, upAfter: 3 }

export const MAZE_FIELDS: SettingField[] = [
  {
    key: 'timeMultiplier',
    label: 'Viewing time',
    type: 'number',
    min: 0.5,
    max: 2,
    step: 0.25,
    unit: '×',
    help: 'below 1 is harder, above 1 is easier · keys are set in Settings',
  },
  { key: 'upAfter', label: 'Correct in a row to level up', type: 'number', min: 3, max: 5 },
]

export interface MazeLevel {
  size: number
  spikes: number
  viewSeconds: number
}

/** The difficulty curve (question 008). Index 0 = level 1. */
export const MAZE_LEVELS: readonly MazeLevel[] = [
  { size: 5, spikes: 0, viewSeconds: 6 },
  { size: 5, spikes: 1, viewSeconds: 5 },
  { size: 7, spikes: 1, viewSeconds: 7 },
  { size: 7, spikes: 2, viewSeconds: 6 },
  { size: 9, spikes: 2, viewSeconds: 8 },
  { size: 9, spikes: 3, viewSeconds: 7 },
  { size: 11, spikes: 3, viewSeconds: 9 },
  { size: 11, spikes: 4, viewSeconds: 8 },
  { size: 13, spikes: 5, viewSeconds: 10 },
  { size: 13, spikes: 6, viewSeconds: 9 },
]

export const MAZE_STAIRCASE: StaircaseConfig = {
  start: 1,
  min: 1,
  max: MAZE_LEVELS.length,
  upAfter: 3,
  upStep: 1,
  downAfter: 1,
  downStep: 1,
}

/** The staircase for one round, using that round's settings snapshot. */
export function mazeStaircase(s: MazeSettings): StaircaseConfig {
  return { ...MAZE_STAIRCASE, upAfter: s.upAfter }
}

export function mazeLevelInfo(level: number): MazeLevel {
  const i = Math.min(MAZE_LEVELS.length, Math.max(1, Math.round(level))) - 1
  return MAZE_LEVELS[i]!
}

export function mazeViewMs(level: number, multiplier: number): number {
  return Math.max(1000, Math.round(mazeLevelInfo(level).viewSeconds * 1000 * multiplier))
}

export function summarizeMaze(rounds: RoundRecord[]): GameSummary {
  if (rounds.length === 0) return { headline: 'not played', stats: [] }
  const wins = rounds.filter((r) => r.success)
  const largest = wins.length > 0 ? Math.max(...wins.map((r) => r.metrics.size ?? 0)) : null
  const shortest = wins.filter((r) => r.metrics.shortest === 1).length
  const recent = rounds.slice(-20)
  const winPct = Math.round((recent.filter((r) => r.success).length / recent.length) * 100)
  return {
    headline: largest === null ? 'no maze solved yet' : `largest ${largest}×${largest}`,
    stats: [
      { label: 'Rounds', value: String(rounds.length) },
      { label: 'Largest solved', value: largest === null ? '—' : `${largest}×${largest}` },
      { label: 'Win rate (last 20)', value: `${winPct}%` },
      { label: 'Shortest routes', value: `${shortest} of ${wins.length}` },
    ],
  }
}
