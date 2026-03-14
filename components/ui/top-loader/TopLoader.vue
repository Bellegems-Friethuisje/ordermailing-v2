<template>
  <div class="relative">
    <div
      :class="[
        'transition-opacity duration-150',
        loading ? 'opacity-25 pointer-events-none select-none' : 'opacity-100',
      ]"
    >
      <slot />
    </div>
    <Transition name="fade">
      <div v-if="loading" class="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Loader2 class="size-6 animate-spin text-foreground" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";

defineProps<{ loading: boolean }>();
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
