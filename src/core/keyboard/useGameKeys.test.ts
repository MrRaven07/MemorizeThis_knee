import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useGameKeys } from './useGameKeys'

function mountWith(handler: (e: KeyboardEvent) => void) {
  const Comp = defineComponent({
    setup() {
      useGameKeys(handler)
      return () => h('div', [h('button', { class: 'b' }, 'Done'), h('input', { class: 'i' })])
    },
  })
  return mount(Comp, { attachTo: document.body })
}

function keydown(target: Element, key: string) {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  target.dispatchEvent(e)
  return e
}

describe('useGameKeys', () => {
  afterEach(() => document.body.replaceChildren())

  it('handles keys pressed on the page', () => {
    const handler = vi.fn<(e: KeyboardEvent) => void>()
    const w = mountWith(handler)
    keydown(document.body, 'Enter')
    expect(handler).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('ignores keys typed into inputs', () => {
    const handler = vi.fn<(e: KeyboardEvent) => void>()
    const w = mountWith(handler)
    keydown(w.find('.i').element, 'Enter')
    expect(handler).not.toHaveBeenCalled()
    w.unmount()
  })

  it('leaves Enter and Space on a focused button to the button', () => {
    const handler = vi.fn<(e: KeyboardEvent) => void>()
    const w = mountWith(handler)
    const btn = w.find('.b').element
    expect(keydown(btn, 'Enter').defaultPrevented).toBe(false)
    keydown(btn, ' ')
    expect(handler).not.toHaveBeenCalled()
    keydown(btn, 'Escape')
    expect(handler).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('stops listening after unmount', () => {
    const handler = vi.fn<(e: KeyboardEvent) => void>()
    mountWith(handler).unmount()
    keydown(document.body, 'Enter')
    expect(handler).not.toHaveBeenCalled()
  })
})
