import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import {
  GAP_MS,
  KIM_LEVELS,
  KIMS_GAME_DEFAULTS,
  KIMS_GAME_FIELDS,
  TRAY_CELLS,
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
  summarizeKimsGame,
  trayObjects,
} from './logic'
import { KIM_OBJECTS } from './objects'

describe('settings', () => {
  it('defaults survive sanitizing', () => {
    expect(KIMS_GAME_DEFAULTS).toEqual({ mode: 'list', timeMultiplier: 1, upAfter: 3 })
    expect(sanitizeSettings(KIMS_GAME_DEFAULTS, KIMS_GAME_DEFAULTS, KIMS_GAME_FIELDS)).toEqual(
      KIMS_GAME_DEFAULTS,
    )
  })

  it('bad values fall back or clamp', () => {
    const s = sanitizeSettings(
      { mode: 'nonsense', timeMultiplier: 9, upAfter: 0 },
      KIMS_GAME_DEFAULTS,
      KIMS_GAME_FIELDS,
    )
    expect(s).toEqual({ mode: 'list', timeMultiplier: 2, upAfter: 3 })
    expect(sanitizeSettings({ mode: 'missing' }, KIMS_GAME_DEFAULTS, KIMS_GAME_FIELDS).mode).toBe(
      'missing',
    )
  })

  it('the staircase follows upAfter and spans the 11 levels', () => {
    const cfg = kimStaircase({ ...KIMS_GAME_DEFAULTS, upAfter: 5 })
    expect(cfg).toMatchObject({ start: 1, min: 1, max: 11, upAfter: 5, downAfter: 1 })
  })

  it('each mode has its own staircase key', () => {
    expect(levelKey('list')).toBe('kims-game:list')
    expect(levelKey('missing')).toBe('kims-game:missing')
    expect(modeCode('list')).toBe(0)
    expect(modeCode('missing')).toBe(1)
  })
})

describe('levels', () => {
  it('list: 10…20 objects, nothing missing', () => {
    expect(KIM_LEVELS.list.map((l) => l.objects)).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ])
    expect(KIM_LEVELS.list.every((l) => l.missing === 0)).toBe(true)
  })

  it('missing: 10…20 objects, k = 1 (L1–4), 2 (L5–8), 3 (L9–11)', () => {
    expect(KIM_LEVELS.missing.map((l) => l.objects)).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ])
    expect(KIM_LEVELS.missing.map((l) => l.missing)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3])
  })

  it('no level is easier than the one before', () => {
    for (const levels of Object.values(KIM_LEVELS)) {
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i]!.objects).toBeGreaterThanOrEqual(levels[i - 1]!.objects)
        expect(levels[i]!.missing).toBeGreaterThanOrEqual(levels[i - 1]!.missing)
        expect(levels[i]!.objects + levels[i]!.missing).toBeGreaterThan(levels[i - 1]!.objects + levels[i - 1]!.missing)
      }
    }
  })

  it('kimLevelInfo clamps out-of-range levels', () => {
    expect(kimLevelInfo('list', 0)).toEqual({ objects: 10, missing: 0 })
    expect(kimLevelInfo('missing', 99)).toEqual({ objects: 20, missing: 3 })
    expect(kimLevelInfo('missing', 5)).toEqual({ objects: 14, missing: 2 })
  })

  it('view time = max(1 s, (2 s + 0.8 s × objects) × multiplier)', () => {
    expect(kimViewMs(10, 1)).toBe(10000)
    expect(kimViewMs(20, 1)).toBe(18000)
    expect(kimViewMs(10, 0.5)).toBe(5000)
    expect(kimViewMs(20, 2)).toBe(36000)
    expect(kimViewMs(0, 0.1)).toBe(1000)
    expect(GAP_MS).toBe(1000)
  })
})

describe('tray', () => {
  it('places distinct catalogue objects in random cells of a 5×4 tray', () => {
    const tray = generateTray(createRng(1), 12)
    expect(tray).toHaveLength(TRAY_CELLS)
    const ids = trayObjects(tray)
    expect(ids).toHaveLength(12)
    expect(new Set(ids).size).toBe(12)
    const known = new Set(KIM_OBJECTS.map((o) => o.id))
    for (const id of ids) expect(known.has(id)).toBe(true)
    expect(tray.filter((c) => c === null)).toHaveLength(8)
  })

  it('is deterministic for a seed and varies across seeds', () => {
    expect(generateTray(createRng(7), 10)).toEqual(generateTray(createRng(7), 10))
    expect(generateTray(createRng(7), 10)).not.toEqual(generateTray(createRng(8), 10))
  })

  it('a full tray uses all 20 cells', () => {
    expect(trayObjects(generateTray(createRng(3), 20))).toHaveLength(20)
  })

  it('never repeats the previous tray', () => {
    const prev = generateTray(createRng(5), 10)
    // an rng that would replay the same tray first
    const next = generateTray(createRng(5), 10, prev)
    expect(next).not.toEqual(prev)
  })
})

describe('missing mode', () => {
  it('removes k objects and keeps every other object in its cell', () => {
    const tray = generateTray(createRng(2), 14)
    const missing = chooseMissing(createRng(4), tray, 2)
    expect(missing).toHaveLength(2)
    expect(new Set(missing).size).toBe(2)
    for (const id of missing) expect(tray).toContain(id)
    const partial = partialTray(tray, missing)
    expect(partial).toHaveLength(TRAY_CELLS)
    expect(trayObjects(partial)).toHaveLength(12)
    const expected = tray.map((id) => (id !== null && missing.includes(id) ? null : id))
    expect(partial).toEqual(expected)
    const emptied = tray.filter((id, i) => id !== null && partial[i] === null)
    expect(emptied.sort()).toEqual([...missing].sort())
  })

  it('the picker holds the k missing objects plus max(4, 2k) distractors, none from the tray', () => {
    for (const k of [1, 2, 3]) {
      const tray = generateTray(createRng(k), 16)
      const missing = chooseMissing(createRng(k + 10), tray, k)
      const picker = missingPicker(createRng(k + 20), tray, missing)
      expect(picker).toHaveLength(k + Math.max(4, 2 * k))
      expect(new Set(picker).size).toBe(picker.length)
      for (const id of missing) expect(picker).toContain(id)
      const onTray = new Set(trayObjects(tray))
      expect(picker.filter((id) => onTray.has(id)).sort()).toEqual([...missing].sort())
    }
  })
})

describe('list picker', () => {
  it('holds every tray object plus as many distractors, shuffled, no duplicates', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const tray = generateTray(createRng(seed), 10 + seed)
      const ids = trayObjects(tray)
      const picker = listPicker(createRng(seed + 100), tray)
      expect(picker).toHaveLength(ids.length * 2)
      expect(new Set(picker).size).toBe(picker.length)
      for (const id of ids) expect(picker).toContain(id)
      const onTray = new Set(ids)
      expect(picker.filter((id) => !onTray.has(id))).toHaveLength(ids.length)
      // ordered differently from the tray
      expect(picker.filter((id) => onTray.has(id))).not.toEqual(ids)
    }
  })

  it('works with 20 objects (40 in the picker)', () => {
    const picker = listPicker(createRng(9), generateTray(createRng(9), 20))
    expect(picker).toHaveLength(40)
    expect(new Set(picker).size).toBe(40)
  })
})

describe('scoring', () => {
  it('a perfect answer passes', () => {
    expect(scoreKim(['a', 'b', 'c'], ['c', 'b', 'a'])).toEqual({
      hits: 3,
      misses: 0,
      wrong: 0,
      exact: true,
      accuracy: 1,
    })
  })

  it('accuracy = hits / (hits + misses + wrong)', () => {
    const s = scoreKim(['a', 'b', 'c', 'd'], ['a', 'b', 'x'])
    expect(s).toMatchObject({ hits: 2, misses: 2, wrong: 1, exact: false })
    expect(s.accuracy).toBeCloseTo(2 / 5)
  })

  it('tapping everything scores low and fails', () => {
    const tray = generateTray(createRng(1), 10)
    const picker = listPicker(createRng(2), tray)
    const s = scoreKim(trayObjects(tray), picker)
    expect(s.exact).toBe(false)
    expect(s.accuracy).toBe(0.5)
  })

  it('an empty answer scores 0', () => {
    expect(scoreKim(['a'], [])).toMatchObject({ hits: 0, misses: 1, accuracy: 0, exact: false })
    expect(scoreKim([], []).accuracy).toBe(0)
  })
})

describe('summary', () => {
  const mk = (
    mode: number,
    objects: number,
    success: boolean,
    accuracy: number,
    i: number,
  ): RoundRecord => ({
    id: String(i),
    gameId: 'kims-game',
    at: i,
    sessionId: null,
    success,
    level: objects - 9,
    accuracy,
    durationMs: 1000,
    metrics: { mode, objects, missing: mode === 1 ? 1 : 0, hits: 0, misses: 0, wrong: 0 },
  })

  it('not played', () => {
    expect(summarizeKimsGame([])).toEqual({ headline: 'not played', stats: [] })
  })

  it('played but never perfect', () => {
    const s = summarizeKimsGame([mk(0, 10, false, 0.5, 1)])
    expect(s.headline).toBe('no perfect round yet')
    expect(s.stats.find((x) => x.label === 'Best (list)')!.value).toBe('—')
  })

  it('best object count across modes, per-mode bests, accuracy and success', () => {
    const s = summarizeKimsGame([
      mk(0, 12, true, 1, 1),
      mk(1, 14, true, 1, 2),
      mk(0, 15, false, 0.5, 3),
      mk(1, 13, false, 0, 4),
    ])
    expect(s.headline).toBe('best 14 objects')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '4' },
      { label: 'Best (list)', value: '12 objects' },
      { label: 'Best (missing)', value: '14 objects' },
      { label: 'Accuracy (last 10)', value: '63%' },
      { label: 'Success (last 20)', value: '50%' },
    ])
  })
})
