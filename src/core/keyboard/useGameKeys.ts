import { onMounted, onUnmounted } from 'vue'

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  )
}

/**
 * Keyboard shortcuts for a game screen (Enter to start, Esc to skip, …).
 *
 * - Listens on `document`, which runs BEFORE GameShell's `window` listener in
 *   the bubble phase — so a game that calls `e.preventDefault()` on Esc stops
 *   the shell from quitting (docs/agents/questions/001).
 * - Ignores keys typed into inputs/selects (the settings drawer, RecallInput —
 *   which handles its own Enter), Enter/Space on a focused button or link
 *   (the button handles it), and events already handled.
 */
/** A focused button/link owns Enter and Space (keyboard users activate it). */
function ownsActivationKey(e: KeyboardEvent): boolean {
  return (
    (e.key === 'Enter' || e.key === ' ') &&
    (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)
  )
}

export function useGameKeys(handler: (e: KeyboardEvent) => void): void {
  function onKeydown(e: KeyboardEvent) {
    if (e.defaultPrevented || isEditable(e.target) || ownsActivationKey(e)) return
    handler(e)
  }
  onMounted(() => document.addEventListener('keydown', onKeydown))
  onUnmounted(() => document.removeEventListener('keydown', onKeydown))
}
