import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import App from '@/App.vue'
import { appStorage } from '@/core/storage/persist'
import { routes } from '@/router'
import { useDecksStore } from '@/stores/decks'

vi.mock('@/core/storage/persist', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/core/storage/persist')>()
  const { createMemoryAdapter } = await import('@/core/storage/adapter')
  return { ...orig, appStorage: createMemoryAdapter() }
})

const mounted: { unmount(): void }[] = []

async function mountAt(path: string): Promise<{ router: Router; w: ReturnType<typeof mount> }> {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  await router.isReady()
  const w = mount(App, { global: { plugins: [router] }, attachTo: document.body })
  mounted.push(w)
  await flushPromises()
  await vi.dynamicImportSettled()
  await flushPromises()
  return { router, w }
}

async function settle() {
  await flushPromises()
  await vi.dynamicImportSettled()
  await flushPromises()
}

describe('Major System views', () => {
  beforeEach(() => {
    for (const k of appStorage.keys()) appStorage.remove(k)
    setActivePinia(createPinia())
  })
  afterEach(() => {
    for (const w of mounted.splice(0)) w.unmount()
    document.body.replaceChildren()
  })

  it('empty state explains the format; creating a deck opens it', async () => {
    const { w, router } = await mountAt('/major')
    expect(w.text()).toContain('00 - sos')
    await w.find('input[name="deck-name"]').setValue('Major RO')
    await w.find('form.new-deck').trigger('submit')
    await settle()
    expect(router.currentRoute.value.name).toBe('deck')
    expect((w.find('input.title').element as HTMLInputElement).value).toBe('Major RO')
  })

  it('unknown deck redirects to the list', async () => {
    const { router } = await mountAt('/major/nope')
    expect(router.currentRoute.value.name).toBe('major')
  })

  it('paste import shows a preview, then adds the cards', async () => {
    const deck = useDecksStore().createDeck('x')
    const { w } = await mountAt(`/major/${deck.id}`)
    await w.find('textarea[name="paste"]').setValue('00 - sos\n01 - sat')
    expect(w.find('.import-preview').text()).toContain('2 new')
    await w.find('button.apply-import').trigger('click')
    await settle()
    expect(useDecksStore().getDeck(deck.id)!.cards).toHaveLength(2)
    expect(w.findAll('tr.card-row')).toHaveLength(2)
  })

  it('an error line is listed and blocks the import', async () => {
    const deck = useDecksStore().createDeck('x')
    const { w } = await mountAt(`/major/${deck.id}`)
    await w.find('textarea[name="paste"]').setValue('00 - sos\nbroken')
    expect(w.find('.import-errors').text()).toContain('line 2')
    expect(w.find('button.apply-import').attributes('disabled')).toBeDefined()
  })

  it('conflicts: keep vs replace', async () => {
    const s = useDecksStore()
    const deck = s.createDeck('x')
    s.addCard(deck.id, '00', 'sos')
    const { w } = await mountAt(`/major/${deck.id}`)
    const paste = w.find('textarea[name="paste"]')
    await paste.setValue('00 - soare')
    expect(w.find('.import-preview').text()).toContain('1 changed')
    await w.find('input[value="keep"]').setValue(true)
    await w.find('button.apply-import').trigger('click')
    expect(s.getDeck(deck.id)!.cards[0]!.output).toBe('sos')
    await paste.setValue('00 - soare')
    await w.find('input[value="replace"]').setValue(true)
    await w.find('button.apply-import').trigger('click')
    expect(s.getDeck(deck.id)!.cards[0]!.output).toBe('soare')
  })

  it('pick mode: the range box reports problems', async () => {
    const s = useDecksStore()
    const deck = s.createDeck('x')
    s.addCard(deck.id, '0', 'a')
    s.addCard(deck.id, '1', 'b')
    const { w } = await mountAt(`/major/${deck.id}`)
    await w.find('input[value="pick"]').setValue(true)
    await w.find('input[name="range"]').setValue('0-1, x')
    await w.find('button.apply-range').trigger('click')
    expect(w.find('.range-problems').text()).toContain('x')
    expect(w.findAll('input.pick-card:checked')).toHaveLength(2)
  })

  it('Home tile counts decks and cards', async () => {
    const first = await mountAt('/')
    expect(first.w.find('.major-tile').text()).toContain('no decks yet')
    first.w.unmount()
    const s = useDecksStore()
    const d = s.createDeck('x')
    s.addCard(d.id, '00', 'sos')
    s.addCard(d.id, '01', 'sat')
    const { w } = await mountAt('/')
    expect(w.find('.major-tile').text()).toContain('1 deck · 2 cards')
  })
})
