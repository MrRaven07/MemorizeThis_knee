import { describe, expect, it } from 'vitest'
import { formatDuration } from './format'

describe('formatDuration', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(7_000)).toBe('0:07')
    expect(formatDuration(760_000)).toBe('12:40')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
  })

  it('floors partial seconds and treats negatives as zero', () => {
    expect(formatDuration(7_999)).toBe('0:07')
    expect(formatDuration(-5)).toBe('0:00')
  })
})
