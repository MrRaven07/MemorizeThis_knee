import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { closeTopOverlay, useBackClosable } from './overlays'

describe('back-closable overlays', () => {
  it('closes the most recently opened overlay first', async () => {
    const scope = effectScope()
    const a = ref(false)
    const b = ref(false)
    scope.run(() => {
      useBackClosable(
        () => a.value,
        () => (a.value = false),
      )
      useBackClosable(
        () => b.value,
        () => (b.value = false),
      )
    })
    expect(closeTopOverlay()).toBe(false)
    a.value = true
    await nextTick()
    b.value = true
    await nextTick()
    expect(closeTopOverlay()).toBe(true)
    expect(b.value).toBe(false)
    expect(a.value).toBe(true)
    await nextTick()
    expect(closeTopOverlay()).toBe(true)
    expect(a.value).toBe(false)
    await nextTick()
    expect(closeTopOverlay()).toBe(false)
    scope.stop()
  })

  it('unregisters when the component goes away', async () => {
    const scope = effectScope()
    const open = ref(false)
    scope.run(() =>
      useBackClosable(
        () => open.value,
        () => (open.value = false),
      ),
    )
    open.value = true
    await nextTick()
    scope.stop()
    expect(closeTopOverlay()).toBe(false)
  })
})
