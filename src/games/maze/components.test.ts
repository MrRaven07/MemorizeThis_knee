import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import MazeGrid from './MazeGrid.vue'
import RouteInput from './RouteInput.vue'
import type { Maze } from './logic'

const small: Maze = {
  size: 3,
  cells: [
    ['open', 'wall', 'open'],
    ['open', 'open', 'open'],
    ['open', 'spike', 'open'],
  ],
  start: { x: 0, y: 0 },
  end: { x: 2, y: 2 },
}

const mounted: { unmount(): void }[] = []
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  document.body.replaceChildren()
})

describe('MazeGrid', () => {
  it('renders every cell with the right classes', () => {
    const w = mount(MazeGrid, {
      props: {
        maze: small,
        path: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
        ],
        failAt: { x: 1, y: 2 },
        highlight: [{ x: 2, y: 1 }],
      },
    })
    mounted.push(w)
    const cells = w.findAll('.cell')
    expect(cells).toHaveLength(9)
    const at = (x: number, y: number) => cells[y * 3 + x]!.classes()
    expect(at(1, 0)).toContain('wall')
    expect(at(1, 2)).toContain('spike')
    expect(at(1, 2)).toContain('fail')
    expect(at(0, 0)).toEqual(expect.arrayContaining(['start', 'on-path']))
    expect(at(0, 1)).toContain('on-path')
    expect(at(2, 2)).toContain('end')
    expect(at(2, 1)).toContain('hint')
    expect(w.findAll('.on-path')).toHaveLength(2)
  })
})

describe('RouteInput', () => {
  function setup(modelValue = '') {
    const w = mount(RouteInput, {
      props: {
        modelValue,
        keys: 'wasd' as const,
        'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }),
      },
      attachTo: document.body,
    })
    mounted.push(w)
    return w
  }

  it('filters typing to the key set and shows arrows', async () => {
    const w = setup()
    await w.find('input.route').setValue('wXaq1')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['wa'])
    expect(w.findAll('.arrow').map((a) => a.text())).toEqual(['↑', '←'])
    expect((w.find('input.route').element as HTMLInputElement).value).toBe('wa')
  })

  it('pad buttons add and remove moves, and ok submits', async () => {
    const w = setup('wa')
    await w.find('.pad-right').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['wad'])
    await w.find('.pad-back').trigger('click')
    expect(w.emitted('update:modelValue')!.at(-1)).toEqual(['wa'])
    await w.find('.pad-ok').trigger('click')
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it('Enter submits exactly once', async () => {
    const w = setup('w')
    await w.find('input.route').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it('pad buttons do not steal focus', async () => {
    const w = setup()
    const e = new Event('pointerdown', { cancelable: true, bubbles: true })
    w.find('.pad-up').element.dispatchEvent(e)
    expect(e.defaultPrevented).toBe(true)
  })

  it('uses the numeric keyboard for the 1234 key set', () => {
    const w = mount(RouteInput, { props: { modelValue: '', keys: '1234' as const } })
    mounted.push(w)
    expect(w.find('input.route').attributes('inputmode')).toBe('numeric')
    expect(w.find('.pad-up').text()).toContain('1')
  })
})
