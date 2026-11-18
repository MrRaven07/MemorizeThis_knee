/**
 * Adaptive difficulty ("staircase"): `upAfter` right answers in a row raise the
 * level by `upStep`; `downAfter` misses in a row lower it by `downStep`.
 * Keeps the player training right at the edge of what they can do.
 */
export interface StaircaseConfig {
  start: number
  min: number
  max: number
  upAfter: number
  upStep: number
  downAfter: number
  downStep: number
}

export interface StaircaseState {
  level: number
  streakRight: number
  streakWrong: number
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function initStaircase(cfg: StaircaseConfig): StaircaseState {
  return { level: clamp(cfg.start, cfg.min, cfg.max), streakRight: 0, streakWrong: 0 }
}

export function stepStaircase(
  state: StaircaseState,
  cfg: StaircaseConfig,
  correct: boolean,
): StaircaseState {
  if (correct) {
    const streakRight = state.streakRight + 1
    if (streakRight >= cfg.upAfter) {
      return {
        level: clamp(state.level + cfg.upStep, cfg.min, cfg.max),
        streakRight: 0,
        streakWrong: 0,
      }
    }
    return { level: state.level, streakRight, streakWrong: 0 }
  }
  const streakWrong = state.streakWrong + 1
  if (streakWrong >= cfg.downAfter) {
    return {
      level: clamp(state.level - cfg.downStep, cfg.min, cfg.max),
      streakRight: 0,
      streakWrong: 0,
    }
  }
  return { level: state.level, streakRight: 0, streakWrong }
}

const finiteOr = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback

/** For saved states: pulls the level into [min, max]; repairs corrupted values. */
export function clampStaircase(state: StaircaseState, cfg: StaircaseConfig): StaircaseState {
  return {
    level: clamp(Math.round(finiteOr(state?.level, cfg.start)), cfg.min, cfg.max),
    streakRight: Math.max(0, finiteOr(state?.streakRight, 0)),
    streakWrong: Math.max(0, finiteOr(state?.streakWrong, 0)),
  }
}

/**
 * Three-zone step for score-based games (N-Back, Quick Math): a pass counts
 * toward going up, a drop lowers the level, and a "stay" keeps it but resets
 * the streak (questions 014/015).
 */
export function stepThreeZone(
  state: StaircaseState,
  cfg: StaircaseConfig,
  outcome: 'pass' | 'stay' | 'drop',
): StaircaseState {
  if (outcome === 'pass') return stepStaircase(state, cfg, true)
  if (outcome === 'drop') return stepStaircase(state, cfg, false)
  return { level: state.level, streakRight: 0, streakWrong: 0 }
}
