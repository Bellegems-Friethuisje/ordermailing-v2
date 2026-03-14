<template>
  <TopLoader :loading="isFetching">
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Automaten</h1>
        <p class="text-sm text-muted-foreground">Bekijk de voorraad van de automaten in real-time.</p>
      </div>

      <!-- Machine selector -->
      <div class="flex flex-wrap gap-3">
        <button
          v-for="code in MACHINE_CODES"
          :key="code"
          @click="selectMachine(code)"
          :disabled="isFetching"
          :class="[
            'flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-medium transition-all',
            selectedMachine === code
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-muted',
            isFetching ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          ]"
        >
          <Bot class="size-4" />
          {{ MACHINE_NAMES[code] }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isFetching" class="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <div class="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p class="text-sm">
          Voorraad ophalen voor <span class="font-semibold text-foreground">{{ MACHINE_NAMES[selectedMachine!] }}</span
          >…
        </p>
        <p class="text-xs opacity-60">Dit kan tot 30 seconden duren.</p>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        class="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-destructive"
      >
        <AlertCircle class="size-8 opacity-70" />
        <p class="text-sm font-medium">{{ error }}</p>
        <button
          class="mt-1 rounded-lg border border-destructive/30 px-4 py-2 text-xs hover:bg-destructive/10 transition-colors"
          @click="fetchMachine(selectedMachine!)"
        >
          Opnieuw proberen
        </button>
      </div>

      <!-- No machine selected -->
      <div v-else-if="!selectedMachine" class="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <Bot class="size-12 opacity-20" />
        <p class="text-sm opacity-50">Kies een automaat hierboven om de voorraad te bekijken.</p>
      </div>

      <!-- Results -->
      <template v-else-if="items.length > 0">
        <!-- Summary bar -->
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <span class="flex size-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <PackageX class="size-4 text-red-600 dark:text-red-400" />
            </span>
            <div>
              <p class="text-lg font-bold leading-none">{{ emptyCount }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">Leeg</p>
            </div>
          </div>
          <div class="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <span class="flex size-9 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <PackageMinus class="size-4 text-orange-500 dark:text-orange-400" />
            </span>
            <div>
              <p class="text-lg font-bold leading-none">{{ lowCount }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">Laag</p>
            </div>
          </div>
          <div class="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
            <span class="flex size-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <PackageCheck class="size-4 text-green-600 dark:text-green-400" />
            </span>
            <div>
              <p class="text-lg font-bold leading-none">{{ okCount }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">OK</p>
            </div>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
          <button
            v-for="tab in FILTER_TABS"
            :key="tab.value"
            @click="activeFilter = tab.value"
            :class="[
              'rounded-md px-3 py-1.5 text-xs font-medium transition-all',
              activeFilter === tab.value
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ]"
          >
            {{ tab.label }}
            <span class="ml-1 tabular-nums opacity-60">({{ tab.count }})</span>
          </button>
        </div>

        <!-- Item grid -->
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div
            v-for="item in filteredItems"
            :key="item.name"
            :class="['flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm', statusBorder(item)]"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm font-medium leading-snug">{{ item.name }}</p>
              <span :class="['shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', statusBadge(item)]">
                {{ statusLabel(item) }}
              </span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                :class="['h-full rounded-full transition-all', progressColor(item)]"
                :style="{ width: stockPercent(item) + '%' }"
              />
            </div>
            <p class="text-xs text-muted-foreground tabular-nums">
              {{ item.number }} / {{ item.total }}
              <span class="ml-1 opacity-70">({{ item.total - item.number }} ontbreekt)</span>
            </p>
          </div>
        </div>

        <!-- Last refreshed -->
        <p class="text-xs text-muted-foreground">
          Laatste update: {{ lastRefreshed }}
          <button class="ml-2 underline-offset-2 hover:underline" @click="fetchMachine(selectedMachine!)">
            Vernieuwen
          </button>
        </p>
      </template>
    </div>
  </TopLoader>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { Bot, AlertCircle, PackageX, PackageMinus, PackageCheck } from "lucide-vue-next";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import { apiFetch } from "@/lib/apiFetch";

interface MachineItem {
  name: string;
  number: number;
  total: number;
}

const MACHINE_CODES = ["4820", "5122", "5317"] as const;
type MachineCode = (typeof MACHINE_CODES)[number];

const MACHINE_NAMES: Record<MachineCode, string> = {
  "4820": "Plats - schotels",
  "5122": "Automaat binnen",
  "5317": "Drankjesautomaat",
};

const FILTER_TABS = computed(() => [
  { label: "Alles", value: "all" as const, count: items.value.length },
  { label: "Leeg", value: "empty" as const, count: emptyCount.value },
  { label: "Laag", value: "low" as const, count: lowCount.value },
  { label: "OK", value: "ok" as const, count: okCount.value },
]);

const selectedMachine = ref<MachineCode | null>(null);
const isFetching = ref(false);
const error = ref<string | null>(null);
const items = ref<MachineItem[]>([]);
const lastRefreshed = ref("");
const activeFilter = ref<"all" | "empty" | "low" | "ok">("all");

// ─── Merge same-name items ────────────────────────────────────────────────────
const mergedItems = computed(() => {
  const map = new Map<string, MachineItem>();
  for (const item of items.value) {
    const existing = map.get(item.name);
    if (existing) {
      existing.number += item.number;
      existing.total += item.total;
    } else {
      map.set(item.name, { ...item });
    }
  }
  return Array.from(map.values());
});

// ─── Derived counts ───────────────────────────────────────────────────────────
const emptyCount = computed(() => mergedItems.value.filter((i) => i.number === 0).length);
const lowCount = computed(() => mergedItems.value.filter((i) => i.number > 0 && i.number < i.total).length);
const okCount = computed(() => mergedItems.value.filter((i) => i.number === i.total).length);

const filteredItems = computed(() => {
  let list = mergedItems.value;
  if (activeFilter.value === "empty") list = list.filter((i) => i.number === 0);
  else if (activeFilter.value === "low") list = list.filter((i) => i.number > 0 && i.number < i.total);
  else if (activeFilter.value === "ok") list = list.filter((i) => i.number === i.total);
  // Sort: empty first, then low, then ok
  return [...list].sort((a, b) => {
    const rankA = a.number === 0 ? 0 : a.number < a.total ? 1 : 2;
    const rankB = b.number === 0 ? 0 : b.number < b.total ? 1 : 2;
    return rankA - rankB;
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stockPercent(item: MachineItem) {
  if (item.total === 0) return 0;
  return Math.round((item.number / item.total) * 100);
}

function statusLabel(item: MachineItem) {
  if (item.number === 0) return "Leeg";
  if (item.number < item.total) return "Laag";
  return "OK";
}

function statusBadge(item: MachineItem) {
  if (item.number === 0) return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  if (item.number < item.total) return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400";
  return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
}

function statusBorder(item: MachineItem) {
  if (item.number === 0) return "border-red-200 dark:border-red-800/50";
  if (item.number < item.total) return "border-orange-200 dark:border-orange-800/50";
  return "";
}

function progressColor(item: MachineItem) {
  if (item.number === 0) return "bg-red-500";
  if (item.number < item.total) return "bg-orange-400";
  return "bg-green-500";
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function selectMachine(code: MachineCode) {
  selectedMachine.value = code;
  activeFilter.value = "all";
  await fetchMachine(code);
}

async function fetchMachine(code: MachineCode) {
  isFetching.value = true;
  error.value = null;
  items.value = [];

  try {
    const res = await apiFetch(`/api/automaten?machine=${code}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as any)?.message ?? `HTTP ${res.status}`);
    }
    const data = (await res.json()) as { ok: boolean; items: MachineItem[] };
    items.value = data.items;
    lastRefreshed.value = new Date().toLocaleTimeString("nl-BE");
  } catch (e: any) {
    error.value = e?.message ?? "Onbekende fout. Probeer opnieuw.";
  } finally {
    isFetching.value = false;
  }
}
</script>
