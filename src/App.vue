<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <main class="app">
    <RouterView />
  </main>
</template>

<style scoped>
.app {
  max-width: 40rem;
  margin: 0 auto;
  padding: var(--space-4);
  /* the body is padded by the safe-area insets; don't let that add a scroll */
  min-height: calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
}
</style>
