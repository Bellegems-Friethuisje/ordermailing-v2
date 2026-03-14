<script setup lang="ts">
import { watch } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import { useSidebar } from "./utils";

const { setOpenMobile, isMobile } = useSidebar();
const pageContext = usePageContext();

watch(
  () => pageContext.urlPathname,
  () => {
    if (isMobile.value) setOpenMobile(false);
  },
);
</script>

<template></template>
