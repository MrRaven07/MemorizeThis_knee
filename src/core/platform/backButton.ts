import type { Router } from 'vue-router'

/**
 * The Android back button: exits from Home, otherwise goes back — or Home
 * when the page was opened directly (no history). Leaving a game this way
 * is the same as pressing Quit: the round is not recorded.
 */
export async function handleBack(router: Router, app: { exitApp(): void }): Promise<void> {
  if (router.currentRoute.value.name === 'home') {
    app.exitApp()
    return
  }
  if (router.options.history.state.back) router.back()
  else await router.push({ name: 'home' })
}

/** Wires the hardware back button (call only on native platforms). */
export async function installBackButton(router: Router): Promise<void> {
  const { App } = await import('@capacitor/app')
  await App.addListener('backButton', () => void handleBack(router, App))
}
