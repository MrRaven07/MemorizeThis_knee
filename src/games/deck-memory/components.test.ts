import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import CardPicker from './CardPicker.vue'
import PlayingCard from './PlayingCard.vue'
import { parseCode } from './cards'

const mounted: { unmount(): void }[] = []
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.replaceChildren()
})

describe('PlayingCard', () => {
  it('shows rank and suit, colour class and a name', () => {
    const w = mount(PlayingCard, { props: { id: parseCode('QD')! } })
    expect(w.text()).toContain('Q')
    expect(w.text()).toContain('♦')
    expect(w.classes()).toContain('red')
    expect(w.attributes('aria-label')).toBe('Queen of diamonds')
    expect(mount(PlayingCard, { props: { id: parseCode('AS')! } }).classes()).toContain('black')
  })

  it('small cards still show the rank', () => {
    const w = mount(PlayingCard, { props: { id: parseCode('10H')!, size: 'sm' } })
    expect(w.find('.center').text()).toBe('10♥')
  })
})

describe('CardPicker', () => {
  function setup(used: number[] = []) {
    const w = mount(CardPicker, { props: { used }, attachTo: document.body })
    mounted.push(w)
    return w
  }

  it('52 buttons; used cards are aria-disabled; a click emits pick', async () => {
    const w = setup([parseCode('AS')!])
    const buttons = w.findAll('button.pick')
    expect(buttons).toHaveLength(52)
    expect(buttons[0]!.attributes('aria-disabled')).toBe('true')
    await buttons[1]!.trigger('click')
    expect(w.emitted('pick')).toEqual([[1]])
    expect(buttons.filter((b) => b.attributes('tabindex') === '0')).toHaveLength(1)
  })

  it('arrows move by 1 across and 13 down', async () => {
    const w = setup()
    const buttons = w.findAll('button.pick')
    ;(buttons[0]!.element as HTMLButtonElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(document.activeElement).toBe(buttons[1]!.element)
    await buttons[1]!.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(document.activeElement).toBe(buttons[14]!.element)
  })

  it('used cards stay focusable (aria-disabled), so keyboard navigation keeps working', async () => {
    const w = setup([0])
    const buttons = w.findAll('button.pick')
    expect(buttons[0]!.attributes('disabled')).toBeUndefined()
    expect(buttons[0]!.attributes('aria-disabled')).toBe('true')
    await buttons[0]!.trigger('click')
    expect(w.emitted('pick')).toBeUndefined()
    ;(buttons[0]!.element as HTMLButtonElement).focus()
    await buttons[0]!.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(document.activeElement).toBe(buttons[1]!.element)
  })
})
