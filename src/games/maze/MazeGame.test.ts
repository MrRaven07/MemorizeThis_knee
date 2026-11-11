import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRng } from '@/core/random/rng'
import { appStorage } from '@/core/storage/persist'
import type { RoundResult } from '@/games/types'
import { useSettingsStore } from '@/stores/settings'
import { useStatsStore } from '@/stores/stats'
import MazeGame from './MazeGame.vue'
import {
  bfsPath,
  DIR_DELTA,
  generateMaze,
  KEYMAPS,
  MAZE_DEFAULTS,
  MAZE_ID,
  type Dir,
  type Maze,
  type MazeKeys,
} from './logic'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []

function encode(route: Dir[], keys: MazeKeys): string {
  const inv = Object.fromEntries(Object.entries(KEYMAPS[keys]).map(([k, d]) => [d, k]))
  return route.map((d) => inv[d]).join('')
}

/** A route that follows the shortest path, then walks into the first adjacent wall. */
function routeIntoWall(maze: Maze): Dir[] {
  const best = bfsPath(maze)!
  let p = maze.start
  const prefix: Dir[] = []
  for (let i = 0; i <= best.length; i++) {
    for (const d of Object.keys(DIR_DELTA) as Dir[]) {
      const n = { x: p.x + DIR_DELTA[d].x, y: p.y + DIR_DELTA[d].y }
      if (
        n.x >= 0 &&
        n.y >= 0 &&
        n.x < maze.size &&
        n.y < maze.size &&
        maze.cells[n.y]![n.x] === 'wall'
      ) {
        return [...prefix, d]
      }
    }
    const d = best[i]!
    prefix.push(d)
    p = { x: p.x + DIR_DELTA[d].x, y: p.y + DIR_DELTA[d].y }
  }
  throw new Error('no wall found')
}

describe('MazeGame', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'Date',
      ],
    })
  })
  afterEach(() => {
    for (const w of mounted.splice(0)) w.unmount()
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  function setup(level = 1) {
    if (level !== 1)
      useStatsStore().saveStaircase(MAZE_ID, { level, streakRight: 0, streakWrong: 0 })
    const sizes = [5, 5]
    const spikes = [0, 1]
    const maze = generateMaze(createRng(1), sizes[level - 1]!, spikes[level - 1]!)
    const w = mount(MazeGame, {
      props: { settings: MAZE_DEFAULTS, rng: createRng(1) },
      attachTo: document.body,
    })
    mounted.push(w)
    return { w, maze }
  }

  async function revealAndType(w: ReturnType<typeof setup>['w'], text: string) {
    await w.find('button.start').trigger('click')
    expect(w.findAll('.cell')).toHaveLength(25)
    vi.advanceTimersByTime(6050)
    await flushPromises()
    const input = w.find('input.route')
    await input.setValue(text)
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
  }

  it('win with the shortest route', async () => {
    const { w, maze } = setup()
    await flushPromises()
    expect(w.emitted('level')![0]).toEqual([1])
    await revealAndType(w, encode(bfsPath(maze)!, 'wasd'))
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result).toMatchObject({
      success: true,
      level: 1,
      accuracy: 1,
      metrics: { shortest: 1, size: 5 },
    })
    expect(w.text()).toContain('Solved!')
    expect(w.text()).toContain('Shortest route')
  })

  it('uses the global key set', async () => {
    useSettingsStore().setMazeKeys('1234')
    const { w, maze } = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(6050)
    await flushPromises()
    expect(w.find('input.route').attributes('inputmode')).toBe('numeric')
    const input = w.find('input.route')
    await input.setValue(encode(bfsPath(maze)!, '1234'))
    await input.trigger('keydown', { key: 'Enter' })
    expect((w.emitted('round-complete')![0] as [RoundResult])[0].success).toBe(true)
  })

  it('walking off the edge loses and levels down', async () => {
    const { w } = setup(2)
    await revealAndType(w, 'w')
    const [result] = w.emitted('round-complete')![0] as [RoundResult]
    expect(result.success).toBe(false)
    expect(w.text()).toContain('Walked off the maze')
    expect(w.emitted('level')!.at(-1)).toEqual([1])
  })

  it('replay animates then shows the failure', async () => {
    const { w, maze } = setup()
    const route = routeIntoWall(maze)
    await revealAndType(w, encode(route, 'wasd'))
    expect(w.findAll('.cell.on-path')).toHaveLength(1)
    expect(w.find('.cell.fail').exists()).toBe(false)
    // each replay step starts after the previous one resolves, so advance step by step
    for (let i = 0; i < route.length + 2; i++) {
      vi.advanceTimersByTime(150)
      await flushPromises()
    }
    expect(w.findAll('.cell.on-path')).toHaveLength(route.length) // start + all moves but the failing one
    expect(w.find('.cell.fail').exists()).toBe(true)
    expect(w.text()).toContain('Hit a wall')
  })

  it('Show a shortest route highlights the BFS cells', async () => {
    const { w, maze } = setup()
    await revealAndType(w, 'w')
    await w.find('button.hint').trigger('click')
    expect(w.findAll('.cell.hint')).toHaveLength(bfsPath(maze)!.length + 1)
  })

  it('unmount during replay leaves no errors', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { w, maze } = setup()
    await revealAndType(w, encode(bfsPath(maze)!, 'wasd'))
    vi.advanceTimersByTime(100)
    mounted.splice(0)
    w.unmount()
    vi.advanceTimersByTime(5000)
    await flushPromises()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('Esc during show skips; Next has the 300 ms Enter guard', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(esc)
    await flushPromises()
    expect(esc.defaultPrevented).toBe(true)
    const input = w.find('input.route')
    expect(input.exists()).toBe(true)
    await input.setValue('w')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    ;(document.activeElement as HTMLElement | null)?.blur()
    vi.advanceTimersByTime(100)
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect(w.find('button.next').exists()).toBe(true)
    vi.advanceTimersByTime(300)
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect(w.find('button.next').exists()).toBe(false)
    expect(w.findAll('.cell')).toHaveLength(25)
  })

  it('a route that stops short marks its last cell (Q008)', async () => {
    const { w, maze } = setup()
    const best = bfsPath(maze)!
    await revealAndType(w, encode(best.slice(0, 1), 'wasd'))
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(150)
      await flushPromises()
    }
    expect(w.text()).toContain("Didn't reach the end")
    expect(w.findAll('.cell.last')).toHaveLength(1)
    expect(w.find('.cell.fail').exists()).toBe(false)
  })

  it('the key set is fixed for the round; the route has a length cap', async () => {
    const { w } = setup()
    await w.find('button.start').trigger('click')
    vi.advanceTimersByTime(6050)
    await flushPromises()
    useSettingsStore().setMazeKeys('1234')
    await flushPromises()
    const input = w.find('input.route')
    expect(input.attributes('inputmode')).toBe('text')
    expect(input.attributes('maxlength')).toBe('50')
  })
})
