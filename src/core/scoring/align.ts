/**
 * Fair recall scoring: align what the player recalled with the target
 * (Levenshtein alignment), so a skipped or extra item only costs that item.
 * `alignSequences` works on any items (digits, cards…); `alignStrings` is the
 * text version used by the digit/letter games.
 */
export type SeqOp<T> =
  | { kind: 'match'; item: T }
  | { kind: 'substitute'; expected: T; actual: T }
  | { kind: 'missing'; expected: T }
  | { kind: 'extra'; actual: T }

export interface SeqResult<T> {
  ops: SeqOp<T>[]
  correct: number
  expectedLength: number
  /** correct / (expectedLength + extra items); 1 when both are empty. */
  accuracy: number
  exact: boolean
}

export function alignSequences<T>(
  e: readonly T[],
  a: readonly T[],
  equals: (x: T, y: T) => boolean = Object.is,
): SeqResult<T> {
  const n = e.length
  const m = a.length

  // dp[i][j] = edit distance between e[0..i) and a[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sub = dp[i - 1]![j - 1]! + (equals(e[i - 1]!, a[j - 1]!) ? 0 : 1)
      dp[i]![j] = Math.min(sub, dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1)
    }
  }

  // Backtrace from the end. Tie preference: match/substitute, then missing, then extra.
  const ops: SeqOp<T>[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    const here = dp[i]![j]!
    if (i > 0 && j > 0) {
      const same = equals(e[i - 1]!, a[j - 1]!)
      if (dp[i - 1]![j - 1]! + (same ? 0 : 1) === here) {
        ops.push(
          same
            ? { kind: 'match', item: e[i - 1]! }
            : { kind: 'substitute', expected: e[i - 1]!, actual: a[j - 1]! },
        )
        i--
        j--
        continue
      }
    }
    if (i > 0 && dp[i - 1]![j]! + 1 === here) {
      ops.push({ kind: 'missing', expected: e[i - 1]! })
      i--
    } else {
      ops.push({ kind: 'extra', actual: a[j - 1]! })
      j--
    }
  }
  ops.reverse()

  const correct = ops.filter((o) => o.kind === 'match').length
  const extra = ops.filter((o) => o.kind === 'extra').length
  const denominator = n + extra
  return {
    ops,
    correct,
    expectedLength: n,
    accuracy: denominator === 0 ? 1 : correct / denominator,
    exact: correct === n && m === n,
  }
}

// ---------- text version (unchanged behaviour) ----------

export type DiffOp =
  | { kind: 'match'; char: string }
  | { kind: 'substitute'; expected: string; actual: string }
  | { kind: 'missing'; expected: string }
  | { kind: 'extra'; actual: string }

export interface AlignResult {
  ops: DiffOp[]
  correct: number
  expectedLength: number
  /** correct / (expectedLength + extra characters); 1 when both are empty. */
  accuracy: number
  exact: boolean
}

/** NFC-normalize and split into code points (never UTF-16 units). */
export function toChars(s: string): string[] {
  return Array.from(s.normalize('NFC'))
}

export function alignStrings(expected: string, actual: string): AlignResult {
  const r = alignSequences(toChars(expected), toChars(actual))
  return {
    ...r,
    ops: r.ops.map((o) => (o.kind === 'match' ? { kind: 'match', char: o.item } : o)),
  }
}
