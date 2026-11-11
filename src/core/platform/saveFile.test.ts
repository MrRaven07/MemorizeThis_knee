import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const isNative = vi.hoisted(() => ({ value: false }))
const writeFile = vi.hoisted(() =>
  vi.fn<(opts: unknown) => Promise<{ uri: string }>>(async () => ({
    uri: 'file:///cache/backup.json',
  })),
)
const share = vi.hoisted(() => vi.fn<(opts: unknown) => Promise<object>>(async () => ({})))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNative.value } }))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}))
vi.mock('@capacitor/share', () => ({ Share: { share } }))

import { saveTextFile } from './saveFile'

describe('saveTextFile', () => {
  beforeEach(() => {
    isNative.value = false
    writeFile.mockClear()
    share.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('web: downloads through a Blob link', async () => {
    const create = vi.fn<(blob: Blob) => string>(() => 'blob:x')
    const revoke = vi.fn<(url: string) => void>(() => {})
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await saveTextFile('backup.json', '{"a":1}', 'application/json')
    expect(create).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:x')
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('native: writes to the cache and opens the share sheet', async () => {
    isNative.value = true
    await saveTextFile('backup.json', '{"a":1}', 'application/json')
    expect(writeFile).toHaveBeenCalledWith({
      path: 'backup.json',
      data: '{"a":1}',
      directory: 'CACHE',
      encoding: 'utf8',
    })
    expect(share).toHaveBeenCalledWith({
      title: 'backup.json',
      files: ['file:///cache/backup.json'],
    })
  })
})
