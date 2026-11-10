<script setup lang="ts">
import { formatDuration } from '@/core/format'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
</script>

<template>
  <span v-if="session.current" class="session-clock mono muted" title="Time played this session">
    session {{ formatDuration(session.liveActiveMs) }}
  </span>
</template>

<style scoped>
.session-clock {
  font-size: var(--text-sm);
}
</style>
