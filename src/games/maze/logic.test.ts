import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  bfsPath,
  generateMaze,
  MAZE_DEFAULTS,
  MAZE_FIELDS,
  MAZE_ID,
  MAZE_LEVELS,
  MAZE_STAIRCASE,
  mazeLevelInfo,
  mazeViewMs,
  parseRoute,
  simulateRoute,
  summarizeMaze,
  type Dir,
  type Maze,
} from './logic'

// 3×3 hand-built maze: wall at (1,0), spike at (1,2); start (0,0), end (2,2)
const small: Maze = {
  size: 3,
  cells: [
    ['open', 'wall', 'open'],
    ['open', 'open', 'open'],
    ['open', 'spike', 'open'],
  ],
  start: { x: 0, y: 0 },
  end: { x: 2, y: 2 },
}

const isBetweenRooms = (x: number, y: number) => (x % 2 === 1) !== (y % 2 === 1)

describe('maze logic', () => {
  it('table, staircase and settings', () => {
    expect(MAZE_ID).toBe('maze')
    expect(MAZE_LEVELS).toHaveLength(10)
    expect(MAZE_LEVELS[0]).toEqual({ size: 5, spikes: 0, viewSeconds: 6 })
    expect(MAZE_LEVELS[9]).toEqual({ size: 13, spikes: 6, viewSeconds: 9 })
    const problems = MAZE_LEVELS.flatMap((l, i) => {
      const prev = MAZE_LEVELS[i - 1]
      return [
        l.size % 2 === 0 && `L${i + 1} even size`,
        prev && l.size < prev.size && `L${i + 1} smaller`,
        prev && l.spikes < prev.spikes && `L${i + 1} fewer spikes`,
      ].filter(Boolean)
    })
    expect(problems).toEqual([])
    expect(MAZE_STAIRCASE).toEqual({
      start: 1,
      min: 1,
      max: 10,
      upAfter: 3,
      upStep: 1,
      downAfter: 1,
      downStep: 1,
    })
    expect(mazeLevelInfo(99)).toBe(MAZE_LEVELS[9])
    expect(mazeViewMs(1, 1)).toBe(6000)
    expect(mazeViewMs(1, 0.1)).toBe(1000)
    expect(sanitizeSettings(MAZE_DEFAULTS, MAZE_DEFAULTS, MAZE_FIELDS)).toEqual(MAZE_DEFAULTS)
  })

  it('structure: rooms at even,even, pillars at odd,odd, open start and end', () => {
    const m = generateMaze(createRng(1), 7, 0)
    expect(m.size).toBe(7)
    expect(m.cells).toHaveLength(7)
    expect(m.start).toEqual({ x: 0, y: 0 })
    expect(m.end).toEqual({ x: 6, y: 6 })
    const problems: string[] = []
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const c = m.cells[y]![x]
        if (x % 2 === 1 && y % 2 === 1 && c !== 'wall') problems.push(`pillar ${x},${y}`)
        if (x % 2 === 0 && y % 2 === 0 && c !== 'open') problems.push(`room ${x},${y}`)
      }
    }
    expect(problems).toEqual([])
  })

  it('500 seeds × 10 levels solvable', () => {
    const failures: string[] = []
    let fullSpikes = 0
    let total = 0
    for (const [i, level] of MAZE_LEVELS.entries()) {
      for (let seed = 0; seed < 500; seed++) {
        const m = generateMaze(createRng(seed * 31 + i), level.size, level.spikes)
        const spikes = m.cells.flat().filter((c) => c === 'spike').length
        if (bfsPath(m) === null) failures.push(`L${i + 1} seed ${seed} unsolvable`)
        if (spikes > level.spikes) failures.push(`L${i + 1} seed ${seed} too many spikes`)
        if (m.cells[0]![0] !== 'open' || m.cells[level.size - 1]![level.size - 1] !== 'open') {
          failures.push(`L${i + 1} seed ${seed} start/end blocked`)
        }
        total++
        if (spikes === level.spikes) fullSpikes++
      }
    }
    expect(failures).toEqual([])
    expect(fullSpikes / total).toBeGreaterThanOrEqual(0.95)
  })

  it('extra openings create loops', () => {
    let loopy = 0
    for (let seed = 0; seed < 100; seed++) {
      const m = generateMaze(createRng(seed), 9, 0)
      let openings = 0
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 9; x++)
          if (isBetweenRooms(x, y) && m.cells[y]![x] !== 'wall') openings++
      const rooms = 5 * 5
      if (openings > rooms - 1) loopy++
    }
    expect(loopy).toBeGreaterThanOrEqual(90)
  })

  it('parseRoute filters to the key set, case-insensitive', () => {
    expect(parseRoute(' W a S d x😀 ', 'wasd')).toEqual(['up', 'left', 'down', 'right'])
    expect(parseRoute('1234 wasd', '1234')).toEqual(['up', 'left', 'down', 'right'])
    expect(parseRoute('', 'wasd')).toEqual([])
  })

  it('simulateRoute outcomes', () => {
    const r = (...d: Dir[]) => simulateRoute(small, d)
    expect(r('down', 'down', 'right', 'right')).toMatchObject({
      outcome: 'spike',
      failAt: { x: 1, y: 2 },
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    })
    expect(r('right')).toMatchObject({ outcome: 'wall', failAt: { x: 1, y: 0 } })
    expect(r('up')).toMatchObject({ outcome: 'outside', failAt: null })
    expect(r('down')).toMatchObject({ outcome: 'short', failAt: null })
    expect(r()).toMatchObject({ outcome: 'short', movesUsed: 0 })
    expect(r('down', 'right', 'right', 'down', 'left')).toMatchObject({
      outcome: 'win',
      movesUsed: 4,
      shortest: true,
    })
    expect(r('down', 'right', 'right', 'up', 'down', 'down')).toMatchObject({
      outcome: 'win',
      movesUsed: 6,
      shortest: false,
    })
    expect(bfsPath(small)).toHaveLength(4)
  })

  it('summary', () => {
    const mk = (size: number, success: boolean, shortest: number): RoundRecord => ({
      id: `${size}${success}`,
      gameId: 'maze',
      at: 0,
      sessionId: null,
      success,
      level: 1,
      accuracy: success ? 1 : 0.5,
      durationMs: 1,
      metrics: { size, shortest, spikes: 0, moves: 4 },
    })
    const s = summarizeMaze([mk(5, true, 1), mk(9, true, 0), mk(11, false, 0)])
    expect(s.headline).toBe('largest 9×9')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Largest solved', value: '9×9' },
      { label: 'Win rate (last 20)', value: '67%' },
      { label: 'Shortest routes', value: '1 of 2' },
    ])
    expect(summarizeMaze([]).headline).toBe('not played')
    expect(summarizeMaze([mk(5, false, 0)]).headline).toBe('no maze solved yet')
  })
})
