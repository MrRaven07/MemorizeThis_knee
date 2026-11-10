import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CardGrid from './CardGrid.vue'
import CardSymbol from './CardSymbol.vue'
import { SYMBOL_NAMES } from './symbols'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.replaceChildren()
})

describe('CardSymbol', () => {
  it('has 18 distinct shapes and names', () => {
    const shapes = new Set(
      Array.from({ length: 18 }, (_, id) =>
        mount(CardSymbol, { props: { id } })
          .find('svg')
          .html()
          .replace(/data-symbol="\d+"/, '')
          .replace(/var\(--sym-\d\)/g, ''),
      ),
    )
    expect(shapes.size).toBe(18)
    expect(new Set(SYMBOL_NAMES).size).toBe(18)
  })
})

describe('CardGrid', () => {
  function setup(faceUp = [false, false, false, false, false, false]) {
    const w = mount(CardGrid, {
      props: {
        cards: [0, 1, 2, 0, 1, 2],
        faceUp,
        matched: [false, false, false, false, false, false],
        rows: 2,
        cols: 3,
      },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('renders one roving tab stop', () => {
    const w = setup()
    const buttons = w.findAll('button.card')
    expect(buttons).toHaveLength(6)
    expect(buttons.filter((b) => b.attributes('tabindex') === '0')).toHaveLength(1)
  })

  it('arrow keys move focus by the column count', async () => {
    const w = setup()
    const buttons = w.findAll('button.card')
    ;(buttons[0]!.element as HTMLButtonElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(buttons[1]!.element)
    await buttons[1]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(buttons[4]!.element)
    await buttons[4]!.trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(buttons[4]!.element) // clamped at the edge
    expect(buttons[4]!.attributes('tabindex')).toBe('0')
  })

  it('click emits flip; Enter keydown is left to the browser', async () => {
    const w = setup()
    const buttons = w.findAll('button.card')
    await buttons[4]!.trigger('click')
    expect(w.emitted('flip')).toEqual([[4]])
    await buttons[2]!.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('flip')).toHaveLength(1)
  })

  it('aria-labels say hidden or the symbol name', () => {
    const w = setup([true, false, false, false, false, false])
    const buttons = w.findAll('button.card')
    expect(buttons[0]!.attributes('aria-label')).toBe(`Card 1, ${SYMBOL_NAMES[0]}`)
    expect(buttons[1]!.attributes('aria-label')).toBe('Card 2, hidden')
    expect(buttons[0]!.classes()).toContain('up')
  })

  it('on narrow screens a wide grid swaps, and arrows use the rendered columns', async () => {
    const original = globalThis.matchMedia
    globalThis.matchMedia = ((q: string) => ({
      matches: true,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof matchMedia
    try {
      const w = mount(CardGrid, {
        props: {
          cards: [0, 1, 2, 3, 0, 1, 2, 3],
          faceUp: Array(8).fill(false),
          matched: Array(8).fill(false),
          rows: 2,
          cols: 4,
        },
        attachTo: document.body,
      })
      mounted.push(w)
      await w.vm.$nextTick()
      expect(w.find('.grid').attributes('style')).toContain('repeat(2, 1fr)')
      const buttons = w.findAll('button.card')
      ;(buttons[0]!.element as HTMLButtonElement).focus()
      await buttons[0]!.trigger('keydown', { key: 'ArrowDown' })
      expect(document.activeElement).toBe(buttons[2]!.element)
    } finally {
      globalThis.matchMedia = original
    }
  })
})
