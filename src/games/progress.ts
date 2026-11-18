/** The level line under a round's result, shared by all adaptive games. */
export interface LevelChange {
  from: number
  to: number
  /** correct rounds in a row after this round */
  streak: number
  upAfter: number
  max: number
}

export function progressLabel(
  c: LevelChange,
  passed: boolean,
  opts: { noun?: string; reset?: boolean } = {},
): string {
  const noun = opts.noun ?? 'Level'
  if (c.to !== c.from) return `${noun} ${c.from} → ${c.to}`
  if (passed && c.from >= c.max) return `${noun} ${c.from} (max)`
  if (passed) return `${noun} ${c.from} (streak ${c.streak}/${c.upAfter})`
  if (opts.reset) return `${noun} ${c.from} (streak reset)`
  return `${noun} ${c.from}`
}
