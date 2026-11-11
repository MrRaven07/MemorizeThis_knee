import { describe, expect, it } from 'vitest'
import { toCsv, toJson } from './export'
import { parseAuto, parseCsv, parseJson, parsePaste } from './parse'

const pairsOf = (r: ReturnType<typeof parseCsv>) => r.pairs.map((p) => [p.input, p.output, p.line])

describe('parseCsv', () => {
  it('reads a header, quotes and line numbers', () => {
    const r = parseCsv('input,output\n00,sos\n01,"sat, mare"\n')
    expect(r.errors).toEqual([])
    expect(pairsOf(r)).toEqual([
      ['00', 'sos', 2],
      ['01', 'sat, mare', 3],
    ])
  })

  it('detects ; as delimiter, strips a BOM, header case-insensitive', () => {
    const r = parseCsv('\uFEFFInput;Output\n02;sanie\n')
    expect(r.errors).toEqual([])
    expect(pairsOf(r)).toEqual([['02', 'sanie', 2]])
  })

  it('skips blank lines but keeps counting them', () => {
    const r = parseCsv('00,sos\n\n01,sat')
    expect(pairsOf(r)).toEqual([
      ['00', 'sos', 1],
      ['01', 'sat', 3],
    ])
  })

  it('reports rows with the wrong number of fields and empty values', () => {
    const r = parseCsv('00,sos\n01,sat,extra\n02,\n')
    expect(r.errors.map((e) => e.line)).toEqual([2, 3])
  })

  it('reports duplicate inputs with both lines', () => {
    const r = parseCsv('00,sos\n01,sat\n00,soare')
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]!.line).toBe(3)
    expect(r.errors[0]!.message).toContain('line 1')
  })

  it('reports an ambiguous delimiter', () => {
    const r = parseCsv('a,b;c\n')
    expect(r.errors).toHaveLength(1)
    expect(r.pairs).toEqual([])
  })
})

describe('parseJson', () => {
  it('reads an array of string pairs', () => {
    const r = parseJson('[{"input":"00","output":"sos"},{"input":"03","output":"zeamă"}]')
    expect(r.errors).toEqual([])
    expect(r.pairs.map((p) => p.output)).toEqual(['sos', 'zeamă'])
  })

  it('never coerces numbers', () => {
    const r = parseJson('[{"input":0,"output":"sos"}]')
    expect(r.pairs).toEqual([])
    expect(r.errors[0]!.message).toMatch(/^item 1:/)
  })

  it('rejects non-arrays and invalid JSON', () => {
    expect(parseJson('{"input":"0"}').errors).toHaveLength(1)
    expect(parseJson('[{').errors).toHaveLength(1)
  })
})

describe('parsePaste', () => {
  it('uses the first separator by priority and splits once', () => {
    expect(pairsOf(parsePaste('00 - sos'))).toEqual([['00', 'sos', 1]])
    expect(pairsOf(parsePaste('03\tzeamă - x'))).toEqual([['03', 'zeamă - x', 1]])
    expect(pairsOf(parsePaste('a - b - c'))).toEqual([['a', 'b - c', 1]])
    expect(pairsOf(parsePaste('x;y,z'))).toEqual([['x', 'y,z', 1]])
  })

  it('reports a line without separator', () => {
    const r = parsePaste('00 - sos\nnothing here')
    expect(r.errors.map((e) => e.line)).toEqual([2])
  })

  it('normalizes to NFC', () => {
    const r = parsePaste('05 - s\u0326olz') // s + combining comma below
    expect(r.pairs[0]!.output).toBe('\u0219olz')
  })
})

describe('parseAuto', () => {
  it('picks the format', () => {
    expect(parseAuto('[{"input":"1","output":"a"}]').pairs).toHaveLength(1)
    expect(parseAuto('1,a\n2,b', 'deck.csv').pairs).toHaveLength(2)
    expect(parseAuto('1 - a').pairs).toHaveLength(1)
  })
})

describe('export round trip with ; in the first row', () => {
  it('re-imports its own export', () => {
    const cards = [
      { input: '00', output: 'sos; sus' },
      { input: '01', output: 'sat' },
    ]
    const r = parseCsv(toCsv(cards))
    expect(r.errors).toEqual([])
    expect(r.pairs.map((p) => ({ input: p.input, output: p.output }))).toEqual(cards)
  })
})

describe('export round trip', () => {
  const cards = [
    { input: '01', output: 'sat, mare' },
    { input: '05', output: 'solz "ș"' },
  ]
  it('CSV keeps diacritics, commas and quotes', () => {
    const csv = toCsv(cards)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(parseCsv(csv).pairs.map((p) => ({ input: p.input, output: p.output }))).toEqual(cards)
  })
  it('JSON round trip', () => {
    const json = toJson(cards)
    expect(json).toContain('\n  ')
    expect(parseJson(json).pairs.map((p) => ({ input: p.input, output: p.output }))).toEqual(cards)
  })
})
