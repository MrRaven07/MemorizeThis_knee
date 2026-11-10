import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from './App.vue'

describe('App', () => {
  it('mounts the app shell with a router view', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => h('p', 'home') } }],
    })
    router.push('/')
    await router.isReady()
    const w = mount(App, { global: { plugins: [router, createPinia()] } })
    expect(w.text()).toContain('home')
  })
})
