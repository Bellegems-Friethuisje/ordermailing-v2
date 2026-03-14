<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ src?: string; alt?: string; class?: HTMLAttributes["class"] }>();
</script>

<template>
  <img
    v-if="props.src"
    :src="props.src"
    :alt="props.alt"
    :class="cn('aspect-square h-full w-full object-cover', props.class)"
  />
</template>
