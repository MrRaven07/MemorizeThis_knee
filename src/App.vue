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
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
</style>
