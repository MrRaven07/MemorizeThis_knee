import { describe, expect, it } from 'vitest'
import { createRng } from '@/core/random/rng'
import { sanitizeSettings } from '@/games/settings'
import type { RoundRecord } from '@/games/types'
import { describeFace, faceDifferences, generateFaces } from './faces'
import {
  NAMES_FACES_DEFAULTS,
  NAMES_FACES_FIELDS,
  NAMES_FACES_ID,
  NF_LEVELS,
  assignNames,
  foldName,
  nfStaircase,
  nfOutcome,
  scorePerson,
  summarizeNamesFaces,
} from './logic'
import { ro } from './names/ro'

describe('names & faces logic', () => {
  it('ids, defaults, levels, staircase', () => {
    expect(NAMES_FACES_ID).toBe('names-faces')
    expect(NAMES_FACES_DEFAULTS).toEqual({
      country: 'ro',
      nameStyle: 'first',
      secondsPerFace: 6,
      upAfter: 3,
    })
    expect(
      sanitizeSettings(NAMES_FACES_DEFAULTS, NAMES_FACES_DEFAULTS, NAMES_FACES_FIELDS),
    ).toEqual(NAMES_FACES_DEFAULTS)
    expect(NF_LEVELS).toEqual([3, 4, 5, 6, 8, 10, 12, 15, 18, 20])
    expect(NF_LEVELS.every((n, i) => i === 0 || n > NF_LEVELS[i - 1]!)).toBe(true)
    expect(nfStaircase(NAMES_FACES_DEFAULTS)).toMatchObject({
      start: 1,
      min: 1,
      max: 10,
      upAfter: 3,
    })
  })

  it('foldName: diacritics, case, hyphens and spaces fold; typos do not', () => {
    expect(foldName('  Ștefan ')).toBe('stefan')
    expect(foldName('ŞTEFAN')).toBe('stefan') // cedilla form folds too
    expect(foldName('Popescu-Tăriceanu')).toBe('popescu tariceanu')
    expect(foldName('Ana   Maria')).toBe('ana maria')
    expect(foldName('Ioana')).not.toBe(foldName('Ioan'))
    expect(foldName('Stefn')).not.toBe(foldName('Ștefan'))
  })

  it('faces: any two in a round differ in at least 3 salient features (20 faces, many seeds)', () => {
    const problems: string[] = []
    for (let seed = 0; seed < 150; seed++) {
      const faces = generateFaces(createRng(seed), 20)
      if (faces.length !== 20) problems.push(`seed ${seed} count`)
      for (let i = 0; i < faces.length; i++)
        for (let j = i + 1; j < faces.length; j++)
          if (faceDifferences(faces[i]!, faces[j]!) < 3) problems.push(`seed ${seed} ${i}/${j}`)
    }
    expect(problems.slice(0, 5)).toEqual([])
  })

  it('faces are described in words for screen readers', () => {
    const [face] = generateFaces(createRng(1), 1)
    expect(describeFace(face!)).toMatch(/hair/)
  })

  it('names match the face presentation and are unique per round', () => {
    const rng = createRng(2)
    const faces = generateFaces(rng, 20)
    const people = assignNames(rng, faces, ro, 'full')
    const firsts = people.map((p) => foldName(p.first))
    const lasts = people.map((p) => foldName(p.last))
    expect(new Set(firsts).size).toBe(20)
    expect(new Set(lasts).size).toBe(20)
    for (const p of people) {
      expect((p.face.presentation === 'f' ? ro.female : ro.male).includes(p.first)).toBe(true)
    }
    expect(
      assignNames(createRng(3), generateFaces(createRng(3), 4), ro, 'first').every(
        (p) => p.last === '',
      ),
    ).toBe(true)
  })

  it('scoring: first-name mode is 0/1; full mode is half a point each', () => {
    const p = { first: 'Ștefan', last: 'Popescu' }
    expect(scorePerson(p, 'stefan', '', false)).toEqual({ points: 1, firstOk: true, lastOk: false })
    expect(scorePerson(p, 'Ștefan', 'popescu', true)).toEqual({
      points: 1,
      firstOk: true,
      lastOk: true,
    })
    expect(scorePerson(p, 'Ștefan', 'Popa', true)).toEqual({
      points: 0.5,
      firstOk: true,
      lastOk: false,
    })
    expect(scorePerson(p, '', '', true).points).toBe(0)
  })

  it('three zones on accuracy', () => {
    expect(nfOutcome(0.9)).toBe('pass')
    expect(nfOutcome(0.7)).toBe('stay')
    expect(nfOutcome(0.4)).toBe('drop')
  })

  it('summary', () => {
    const mk = (level: number, success: boolean, faces: number, accuracy: number): RoundRecord => ({
      id: `${level}${accuracy}`,
      gameId: 'names-faces',
      at: 0,
      sessionId: null,
      success,
      level,
      accuracy,
      durationMs: 1,
      metrics: { faces, points: faces * accuracy, fullNames: 0 },
    })
    const s = summarizeNamesFaces([mk(2, true, 4, 1), mk(4, true, 6, 0.95), mk(5, false, 8, 0.5)])
    expect(s.headline).toBe('best level 4')
    expect(s.stats).toEqual([
      { label: 'Rounds', value: '3' },
      { label: 'Best level', value: '4' },
      { label: 'Most faces in a passed round', value: '6' },
      { label: 'Accuracy (last 10)', value: '82%' },
      { label: 'Success (last 20)', value: '67%' },
    ])
    expect(summarizeNamesFaces([]).headline).toBe('not played')
  })
})
