import type { Card } from './types'

type Pair = Pick<Card, 'input' | 'output'>

function csvField(s: string): string {
  // ';' is quoted too, so our own files never look like ';'-separated CSV.
  return /[",;\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV with a header and a UTF-8 BOM (so Excel shows diacritics correctly). */
export function toCsv(cards: Pair[]): string {
  const rows = ['input,output', ...cards.map((c) => `${csvField(c.input)},${csvField(c.output)}`)]
  return '\uFEFF' + rows.join('\r\n') + '\r\n'
}

export function toJson(cards: Pair[]): string {
  return JSON.stringify(
    cards.map((c) => ({ input: c.input, output: c.output })),
    null,
    2,
  )
}
