import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'

import './styles/tokens.css'
import './styles/base.css'

import App from './App.vue'
import router from './router'
import { appStorage, runMigrations } from './core/storage/persist'
import { installBackButton } from './core/platform/backButton'

// Upgrade saved data BEFORE any store reads it. Never touch data from a newer app version.
if (runMigrations(appStorage) === 'future-version') {
  createApp({
    render: () =>
      h(
        'p',
        { style: 'padding: 2rem; max-width: 30rem; margin: auto' },
        'Your saved data is from a newer version of MemorizeThis. Update the app to continue.',
      ),
  }).mount('#app')
} else {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
  if (Capacitor.isNativePlatform()) installBackButton(router).catch(() => {})
}
