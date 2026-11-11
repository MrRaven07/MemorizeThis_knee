import { describe, expect, it } from 'vitest'
import { createMemoryAdapter } from './adapter'
import { exportAll, importAll, validateBackup } from './backup'

describe('backup', () => {
  it('round-trips UTF-8 data and only mt: keys', () => {
    const a = createMemoryAdapter({
      'mt:version': '1',
      'mt:x': JSON.stringify({ w: 'zeamă ș ț' }),
      other: 'ignored',
    })
    const b = createMemoryAdapter()
    expect(importAll(b, exportAll(a))).toEqual({ ok: true })
    expect(JSON.parse(b.get('mt:x')!)).toEqual({ w: 'zeamă ș ț' })
    expect(b.get('other')).toBeNull()
  })

  it('export has the documented envelope', () => {
    const parsed = JSON.parse(exportAll(createMemoryAdapter({ 'mt:version': '1' })))
    expect(parsed).toMatchObject({ app: 'memorize-this', version: 2, data: { 'mt:version': '1' } })
    expect(typeof parsed.exportedAt).toBe('number')
  })

  it('restore replaces existing mt: keys', () => {
    const b = createMemoryAdapter({ 'mt:version': '1', 'mt:old': '1', keep: 'x' })
    const file = JSON.stringify({
      app: 'memorize-this',
      exportedAt: 0,
      version: 1,
      data: { 'mt:version': '1', 'mt:new': '2' },
    })
    expect(importAll(b, file)).toEqual({ ok: true })
    expect(b.get('mt:old')).toBeNull()
    expect(b.get('mt:new')).toBe('2')
    expect(b.get('keep')).toBe('x')
  })

  it.each([
    ['not json', 'nope'],
    ['foreign app', '{"app":"x","version":1,"data":{}}'],
    ['newer version', '{"app":"memorize-this","version":99,"data":{"mt:a":"1"}}'],
    ['non-string value', '{"app":"memorize-this","version":1,"data":{"mt:a":1}}'],
    ['non mt: key', '{"app":"memorize-this","version":1,"data":{"evil":"1"}}'],
    ['missing data', '{"app":"memorize-this","version":1}'],
  ])('rejects %s without writing anything', (_label, json) => {
    const b = createMemoryAdapter({ 'mt:keep': 'yes' })
    const r = importAll(b, json)
    expect(r.ok).toBe(false)
    expect(b.keys()).toEqual(['mt:keep'])
  })

  it('validateBackup checks without writing and reports the export date', () => {
    const json = exportAll(createMemoryAdapter({ 'mt:version': '1' }))
    const r = validateBackup(json)
    expect(r).toEqual({ ok: true, exportedAt: expect.any(Number) })
    expect(validateBackup('nope').ok).toBe(false)
  })

  it('rejects a backup whose saved data is from a newer app version', () => {
    const b = createMemoryAdapter({ 'mt:keep': 'yes' })
    const file = JSON.stringify({
      app: 'memorize-this',
      version: 1,
      data: { 'mt:version': '99', 'mt:a': '1' },
    })
    expect(importAll(b, file).ok).toBe(false)
    expect(b.keys()).toEqual(['mt:keep'])
  })
})
