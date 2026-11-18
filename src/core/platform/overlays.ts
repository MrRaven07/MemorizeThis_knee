import { onScopeDispose, watch } from 'vue'

/**
 * In-page panels (settings drawer, confirmations) that the Android back
 * button should close before leaving the page. Most recently opened first.
 */
const stack: (() => void)[] = []

function remove(close: () => void) {
  const i = stack.lastIndexOf(close)
  if (i >= 0) stack.splice(i, 1)
}

/** Closes the top open panel; returns false when none is open. */
export function closeTopOverlay(): boolean {
  const close = stack.pop()
  if (!close) return false
  close()
  return true
}

/** Registers a panel while `isOpen()` is true. */
export function useBackClosable(isOpen: () => boolean, close: () => void): void {
  watch(
    isOpen,
    (open) => {
      remove(close)
      if (open) stack.push(close)
    },
    { immediate: true },
  )
  onScopeDispose(() => remove(close))
}
