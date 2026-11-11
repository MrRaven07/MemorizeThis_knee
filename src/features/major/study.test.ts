import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import { appStorage } from '@/core/storage/persist'
import { routes } from '@/router'
import { useDecksStore } from '@/stores/decks'
import { useSessionStore } from '@/stores/session'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []

function makeDeck(n: number) {
  const s = useDecksStore()
  const d = s.createDeck('x')
  for (let i = 0; i < n; i++) s.addCard(d.id, String(i).padStart(2, '0'), `w${i}`)
  return s.getDeck(d.id)!
}

async function study(deckId: string, query: string) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(`/major/${deckId}/study?${query}`)
  await router.isReady()
  const w = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  mounted.push(w)
  await flushPromises()
  await vi.dynamicImportSettled()
  await flushPromises()
  return { w, router }
}

const prompt = (w: ReturnType<typeof mount>) => w.find('.prompt').text()
async function answer(w: ReturnType<typeof mount>, knew: boolean) {
  await w.find('button.flip').trigger('click')
  await w.find(knew ? 'button.knew' : 'button.missed').trigger('click')
}

describe('StudyView', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
  })
  afterEach(() => {
    for (const w of mounted.splice(0)) w.unmount()
    document.body.replaceChildren()
  })

  it('smart: flip, answer, next card, counter', async () => {
    const d = makeDeck(3)
    const { w } = await study(d.id, 'mode=smart&dir=forward')
    expect(prompt(w)).toBe('00')
    expect(w.find('.answer').exists()).toBe(false)
    await w.find('button.flip').trigger('click')
    expect(w.find('.answer').text()).toBe('w0')
    await w.find('button.knew').trigger('click')
    expect(prompt(w)).toBe('01')
    expect(w.text()).toContain('knew 1')
    expect(useDecksStore().getDeck(d.id)!.progress.forward[d.cards[0]!.id]!.box).toBe(2)
  })

  it('a missed card returns after 3 others', async () => {
    const d = makeDeck(5)
    const { w } = await study(d.id, 'mode=smart&dir=forward')
    const first = prompt(w)
    await answer(w, false)
    const between: string[] = []
    for (let i = 0; i < 3; i++) {
      between.push(prompt(w))
      await answer(w, true)
    }
    expect(between).not.toContain(first)
    expect(prompt(w)).toBe(first)
  })

  it('reverse shows the output and updates reverse progress only', async () => {
    const d = makeDeck(2)
    const { w } = await study(d.id, 'mode=smart&dir=reverse')
    expect(prompt(w)).toBe('w0')
    await answer(w, true)
    const deck = useDecksStore().getDeck(d.id)!
    expect(deck.progress.reverse[d.cards[0]!.id]!.box).toBe(2)
    expect(deck.progress.forward[d.cards[0]!.id]).toBeUndefined()
  })

  it('shuffle shows each card once, then a summary; Again restarts', async () => {
    const d = makeDeck(4)
    const { w } = await study(d.id, 'mode=shuffle&dir=forward')
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      seen.push(prompt(w))
      await answer(w, i % 2 === 0)
    }
    expect([...seen].sort()).toEqual(['00', '01', '02', '03'])
    expect(w.find('.summary').text()).toContain('2 of 4')
    await w.find('button.again').trigger('click')
    expect(w.find('.prompt').exists()).toBe(true)
  })

  it('pick selection limits the cards', async () => {
    const d = makeDeck(5)
    useDecksStore().studySelection = [d.cards[3]!.id]
    const { w } = await study(d.id, 'mode=shuffle&dir=forward')
    expect(prompt(w)).toBe('03')
    await answer(w, true)
    expect(w.find('.summary').exists()).toBe(true)
  })

  it('session time counts only while studying', async () => {
    const d = makeDeck(2)
    const { w } = await study(d.id, 'mode=smart&dir=forward')
    expect(useSessionStore().isActive).toBe(true)
    w.unmount()
    mounted.splice(0)
    expect(useSessionStore().isActive).toBe(false)
  })

  it('k / d keys work only after flipping', async () => {
    const d = makeDeck(3)
    const { w } = await study(d.id, 'mode=smart&dir=forward')
    const key = (k: string) =>
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }),
      )
    key('k')
    await flushPromises()
    expect(prompt(w)).toBe('00')
    key(' ')
    await flushPromises()
    expect(w.find('.answer').exists()).toBe(true)
    key('k')
    await flushPromises()
    expect(prompt(w)).toBe('01')
  })

  it('browser shortcuts like Ctrl+D are not recorded as answers', async () => {
    const d = makeDeck(3)
    const { w } = await study(d.id, 'mode=smart&dir=forward')
    await w.find('button.flip').trigger('click')
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true, cancelable: true }),
    )
    await flushPromises()
    expect(prompt(w)).toBe('00')
    expect(useDecksStore().getDeck(d.id)!.progress.forward[d.cards[0]!.id]).toBeUndefined()
  })
})
