import type { CapacitorConfig } from '@capacitor/cli'

/** Android app wrapper (plan 10). The web build in dist/ is the whole app. */
const config: CapacitorConfig = {
  appId: 'io.github.mrraven07.memorizethis',
  appName: 'MemorizeThis',
  webDir: 'dist',
  backgroundColor: '#0d1117',
  plugins: {
    SystemBars: {
      // edge-to-edge with correct env(safe-area-inset-*) values (base.css pads with them)
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK', // light icons on our dark background
    },
  },
}

export default config
