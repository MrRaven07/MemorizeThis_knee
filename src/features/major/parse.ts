import type { ParsedPair, ParseError, ParseResult } from './types'

/**
 * Import parsers for flashcard decks: CSV, JSON and a forgiving paste format.
 * Rules (question 010): every error is reported with its 1-based line (JSON:
 * item number) and blocks the import; text is trimmed and NFC-normalized;
 * duplicate inputs within one file are errors.
 */

const BOM = '\uFEFF'
const clean = (s: string) => s.normalize('NFC').trim()
const stripBom = (s: string) => (s.startsWith(BOM) ? s.slice(1) : s)

/** Adds duplicate-input errors (case-sensitive, after NFC/trim). */
function checkDuplicates(result: ParseResult): ParseResult {
  const firstLine = new Map<string, number>()
  const errors: ParseError[] = [...result.errors]
  for (const p of result.pairs) {
    const seen = firstLine.get(p.input)
    if (seen !== undefined) {
      errors.push({ line: p.line, message: `"${p.input}" is already on line ${seen}` })
    } else {
      firstLine.set(p.input, p.line)
    }
  }
  errors.sort((a, b) => a.line - b.line)
  return { pairs: result.pairs, errors }
}

function pairOrError(
  input: string,
  output: string,
  line: number,
  pairs: ParsedPair[],
  errors: ParseError[],
) {
  const i = clean(input)
  const o = clean(output)
  if (!i || !o) errors.push({ line, message: 'both sides must be filled in' })
  else pairs.push({ input: i, output: o, line })
}

// ---------- CSV (RFC 4180) ----------

/** Splits one record into fields; returns null if a quote is left open. */
function splitCsvLine(line: string, delim: string): string[] | null {
  const fields: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"' && cur.trim() === '') {
      quoted = true
      cur = ''
    } else if (ch === delim) {
      fields.push(cur)
      cur = ''
    } else cur += ch
  }
  if (quoted) return null
  fields.push(cur)
  return fields
}

/** Groups physical lines into records (a quoted field may span lines). */
function csvRecords(text: string): { text: string; line: number }[] {
  const lines = text.split(/\r?\n/)
  const records: { text: string; line: number }[] = []
  let buf: string | null = null
  let start = 0
  lines.forEach((l, idx) => {
    if (buf === null) {
      buf = l
      start = idx + 1
    } else buf += '\n' + l
    const quotes = (buf.match(/"/g) ?? []).length
    if (quotes % 2 === 0) {
      records.push({ text: buf, line: start })
      buf = null
    }
  })
  if (buf !== null) records.push({ text: buf, line: start })
  return records
}

export function parseCsv(raw: string): ParseResult {
  const records = csvRecords(stripBom(raw)).filter((r) => r.text.trim() !== '')
  const pairs: ParsedPair[] = []
  const errors: ParseError[] = []
  if (records.length === 0) return { pairs, errors }

  // Only the FIRST row can be a header (question 010); it also fixes the delimiter.
  const header = /^\s*"?input"?\s*([,;])\s*"?output"?\s*$/i.exec(records[0]!.text)
  const isHeader = (r: { line: number }) => header !== null && r.line === records[0]!.line
  const firstData = records.find((r) => !isHeader(r)) ?? records[0]!
  const fits = (d: string) => splitCsvLine(firstData.text, d)?.length === 2
  const commaFits = header ? header[1] === ',' : fits(',')
  const semiFits = header ? header[1] === ';' : fits(';')
  if (commaFits === semiFits) {
    return {
      pairs,
      errors: [
        {
          line: firstData.line,
          message: 'cannot tell whether columns are separated by "," or ";"',
        },
      ],
    }
  }
  const delim = commaFits ? ',' : ';'

  for (const r of records) {
    if (isHeader(r)) continue
    const fields = splitCsvLine(r.text, delim)
    if (fields === null) errors.push({ line: r.line, message: 'a quote is not closed' })
    else if (fields.length !== 2)
      errors.push({ line: r.line, message: `expected 2 columns, found ${fields.length}` })
    else pairOrError(fields[0]!, fields[1]!, r.line, pairs, errors)
  }
  return checkDuplicates({ pairs, errors })
}

// ---------- JSON ----------

export function parseJson(raw: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(stripBom(raw))
  } catch {
    return { pairs: [], errors: [{ line: 1, message: 'not valid JSON' }] }
  }
  if (!Array.isArray(data)) {
    return {
      pairs: [],
      errors: [{ line: 1, message: 'expected a list: [{ "input": "…", "output": "…" }]' }],
    }
  }
  const pairs: ParsedPair[] = []
  const errors: ParseError[] = []
  data.forEach((item: unknown, idx) => {
    const n = idx + 1
    const obj = item as { input?: unknown; output?: unknown } | null
    if (typeof obj !== 'object' || obj === null) {
      errors.push({ line: n, message: `item ${n}: expected an object` })
    } else if (typeof obj.input !== 'string' || typeof obj.output !== 'string') {
      errors.push({ line: n, message: `item ${n}: "input" and "output" must be text (in quotes)` })
    } else {
      const before = errors.length
      pairOrError(obj.input, obj.output, n, pairs, errors)
      if (errors.length > before)
        errors[errors.length - 1]!.message = `item ${n}: both sides must be filled in`
    }
  })
  const checked = checkDuplicates({ pairs, errors })
  return {
    pairs: checked.pairs,
    errors: checked.errors.map((e) =>
      e.message.startsWith('item ') ? e : { ...e, message: `item ${e.line}: ${e.message}` },
    ),
  }
}

// ---------- Paste ----------

const PASTE_SEPARATORS = ['\t', ' - ', ';', ','] as const

export function parsePaste(raw: string): ParseResult {
  const pairs: ParsedPair[] = []
  const errors: ParseError[] = []
  stripBom(raw)
    .split(/\r?\n/)
    .forEach((text, idx) => {
      const line = idx + 1
      if (text.trim() === '') return
      const sep = PASTE_SEPARATORS.find((s) => text.includes(s))
      if (!sep) {
        errors.push({ line, message: 'no separator found (use " - ", tab, ";" or ",")' })
        return
      }
      const at = text.indexOf(sep)
      pairOrError(text.slice(0, at), text.slice(at + sep.length), line, pairs, errors)
    })
  return checkDuplicates({ pairs, errors })
}

/** Picks the parser from the file name or the content. */
export function parseAuto(text: string, filename?: string): ParseResult {
  // A file saved in another encoding (e.g. Excel "ANSI") decodes with U+FFFD.
  const bad = text.split(/\r?\n/).findIndex((l) => l.includes('\uFFFD'))
  if (bad >= 0) {
    return {
      pairs: [],
      errors: [
        { line: bad + 1, message: 'unreadable characters — save the file as UTF-8 and try again' },
      ],
    }
  }
  const name = filename?.toLowerCase() ?? ''
  if (name.endsWith('.json')) return parseJson(text)
  if (name.endsWith('.csv')) return parseCsv(text)
  if (!name && stripBom(text).trimStart().startsWith('[')) {
    // Looks like JSON; if it isn't, it's a paste that happens to start with "[".
    const json = parseJson(text)
    if (!(json.errors.length === 1 && json.errors[0]!.message === 'not valid JSON')) return json
  }
  return parsePaste(text)
}
