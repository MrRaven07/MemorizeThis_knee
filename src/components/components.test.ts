import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { h } from 'vue'
import { alignStrings } from '@/core/scoring/align'
import type { SettingField } from '@/games/types'
import { useSessionStore } from '@/stores/session'
import GameShell from './GameShell.vue'
import RecallInput from './RecallInput.vue'
import ResultDiff from './ResultDiff.vue'
import SettingsForm from './SettingsForm.vue'
import TimerBar from './TimerBar.vue'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const fields: SettingField[] = [
  { key: 'n', label: 'Digits', type: 'number', min: 1, max: 50 },
  { key: 'sep', label: 'Separate groups', type: 'boolean' },
]
const defaults = { n: 10, sep: true }

describe('SettingsForm', () => {
  it('clearing a number emits the default and 0 emits the minimum', async () => {
    const w = mount(SettingsForm, { props: { fields, modelValue: defaults, defaults } })
    const input = w.find('input[name="n"]')
    await input.setValue('')
    await input.trigger('change')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({ n: 10 })
    expect((input.element as HTMLInputElement).value).toBe('10')
    await input.setValue('0')
    await input.trigger('change')
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({ n: 1 })
  })

  it('toggles booleans', async () => {
    const w = mount(SettingsForm, { props: { fields, modelValue: defaults, defaults } })
    await w.find('input[name="sep"]').setValue(false)
    expect(w.emitted('update:modelValue')!.at(-1)![0]).toMatchObject({ sep: false })
  })
})

describe('RecallInput', () => {
  it('Enter emits submit and typing updates the model', async () => {
    const w = mount(RecallInput, { props: { modelValue: '12', label: 'Answer' } })
    await w.find('input').setValue('123')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['123'])
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it('uses the numeric keyboard by default and disables autocorrect', () => {
    const input = mount(RecallInput, { props: { modelValue: '', label: 'Answer' } }).find('input')
    expect(input.attributes('inputmode')).toBe('numeric')
    expect(input.attributes('autocomplete')).toBe('off')
    expect(input.attributes('spellcheck')).toBe('false')
  })
})

describe('ResultDiff', () => {
  it('renders one span per op with its kind', () => {
    const d = mount(ResultDiff, { props: { ops: alignStrings('123', '13').ops } })
    expect(d.findAll('.diff-match')).toHaveLength(2)
    expect(d.findAll('.diff-missing')).toHaveLength(1)
    expect(d.find('.diff-missing').text()).toBe('2')
  })
})

describe('TimerBar', () => {
  it('exposes remaining time as a progressbar', () => {
    const w = mount(TimerBar, { props: { progress: 0.25 } })
    expect(w.attributes('role')).toBe('progressbar')
    expect(w.attributes('aria-valuenow')).toBe('75')
  })
})

describe('GameShell', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => document.body.replaceChildren())

  function mountShell() {
    return mount(GameShell, {
      props: { title: 'Long Number', gameId: 'long-number', level: 7 },
      slots: { default: () => h('p', 'play area') },
      attachTo: document.body,
    })
  }

  it('starts session activity on mount and stops it on unmount', () => {
    const w = mountShell()
    const session = useSessionStore()
    expect(session.isActive).toBe(true)
    expect(w.text()).toContain('play area')
    w.unmount()
    expect(session.isActive).toBe(false)
  })

  it('Esc quits, unless a game already handled it (preventDefault)', () => {
    const w = mountShell()
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    handled.preventDefault()
    window.dispatchEvent(handled)
    expect(w.emitted('quit')).toBeUndefined()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))
    expect(w.emitted('quit')).toHaveLength(1)
  })
})
