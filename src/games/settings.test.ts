import { describe, expect, it } from 'vitest'
import { sanitizeSettings } from './settings'
import type { SettingField } from './types'

const fields: SettingField[] = [
  { key: 'n', label: 'N', type: 'number', min: 1, max: 50 },
  { key: 'half', label: 'Half', type: 'number', min: 0, max: 5, step: 0.5 },
  { key: 'sep', label: 'Sep', type: 'boolean' },
  {
    key: 'keys',
    label: 'Keys',
    type: 'select',
    options: [
      { value: 'wasd', label: 'WASD' },
      { value: '1234', label: '1234' },
    ],
  },
]
const defaults = { n: 10, half: 1, sep: true, keys: 'wasd' }

describe('sanitizeSettings', () => {
  it.each([[{ n: '' }], [{ n: NaN }], [{ n: 'abc' }], [{ n: Infinity }], [{}], [null], ['junk']])(
    'bad number %j falls back to default',
    (raw) => {
      expect(sanitizeSettings(raw, defaults, fields).n).toBe(10)
    },
  )

  it('accepts numeric strings from form inputs', () => {
    expect(sanitizeSettings({ n: '7' }, defaults, fields).n).toBe(7)
  })

  it('clamps and rounds numbers', () => {
    expect(sanitizeSettings({ n: 0 }, defaults, fields).n).toBe(1)
    expect(sanitizeSettings({ n: -5 }, defaults, fields).n).toBe(1)
    expect(sanitizeSettings({ n: 999 }, defaults, fields).n).toBe(50)
    expect(sanitizeSettings({ n: 7.6 }, defaults, fields).n).toBe(8)
    expect(sanitizeSettings({ half: 1.3 }, defaults, fields).half).toBe(1.5)
  })

  it('booleans must be booleans', () => {
    expect(sanitizeSettings({ sep: 'yes' }, defaults, fields).sep).toBe(true)
    expect(sanitizeSettings({ sep: false }, defaults, fields).sep).toBe(false)
  })

  it('rejects unknown select values and drops unknown keys', () => {
    expect(sanitizeSettings({ keys: 'zzz', junk: 1 }, defaults, fields)).toEqual(defaults)
    expect(sanitizeSettings({ keys: '1234' }, defaults, fields).keys).toBe('1234')
  })
})
