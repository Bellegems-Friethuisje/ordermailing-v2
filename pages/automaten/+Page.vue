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
          @click="refreshMachine(selectedMachine!)"
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

        <!-- Trend strip -->
        <div class="rounded-xl border bg-card p-5 shadow-sm">
          <div class="mb-5 flex items-baseline justify-between gap-3">
            <div>
              <p class="text-sm font-semibold">Vulling over tijd</p>
              <p class="text-xs text-muted-foreground">Laatste {{ TREND_DAYS }} dagen</p>
            </div>
            <p class="text-xs text-muted-foreground">Laatst gemeten: {{ lastMeasured }}</p>
          </div>

          <div v-if="isLoadingHistory" class="flex h-24 items-end gap-1">
            <div
              v-for="i in TREND_DAYS"
              :key="i"
              class="flex-1 animate-pulse rounded-sm bg-muted"
              :style="{ height: `${20 + ((i * 13) % 60)}px` }"
            />
          </div>

          <p v-else-if="!hasTrend" class="py-6 text-center text-xs text-muted-foreground">
            Nog geen geschiedenis. Metingen worden vanaf nu opgeslagen.
          </p>

          <div v-else class="flex h-24 items-end gap-1">
            <div v-for="day in trendData" :key="day.key" class="group flex flex-1 flex-col items-center gap-1">
              <span
                class="text-[10px] font-medium text-muted-foreground tabular-nums opacity-0 transition-opacity group-hover:opacity-100"
              >
                {{ day.percent !== null ? day.percent + "%" : "" }}
              </span>
              <div
                class="w-full rounded-sm transition-all"
                :class="day.isToday ? 'bg-primary' : 'bg-primary/40 hover:bg-primary/60'"
                :style="{
                  height: day.percent !== null ? `${Math.max(3, (day.percent / 100) * 68)}px` : '3px',
                  opacity: day.percent !== null ? undefined : '0.2',
                }"
                :title="day.percent !== null ? `${day.fullLabel}: ${day.percent}% gevuld` : `${day.fullLabel}: geen meting`"
              />
              <span
                class="text-[10px] text-muted-foreground"
                :class="{ 'font-semibold text-foreground': day.isToday }"
              >
                {{ day.label }}
              </span>
            </div>
          </div>
        </div>

        <!-- Main content + missing panel -->
        <div class="flex flex-col gap-6 lg:flex-row lg:items-start">

          <!-- Left: filter tabs + grid -->
          <div class="order-2 lg:order-1 flex min-w-0 flex-1 flex-col gap-4">
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
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <button
                v-for="item in filteredItems"
                :key="item.name"
                type="button"
                :title="`Bekijk de geschiedenis van ${item.name}`"
                @click="openSlotDetail(item)"
                :class="[
                  'flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/40',
                  statusBorder(item),
                ]"
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
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-muted-foreground tabular-nums">
                    {{ item.number }} / {{ item.total }}
                    <span class="ml-1 opacity-70">({{ item.total - item.number }} ontbreekt)</span>
                  </p>
                  <p :class="['shrink-0 text-xs tabular-nums', forecastClass(item)]">{{ forecastLabel(item) }}</p>
                </div>
              </button>
            </div>

            <!-- Last refreshed -->
            <p class="text-xs text-muted-foreground">
              Laatst gemeten: {{ lastMeasured }}
              <span class="opacity-60">(opgehaald {{ lastRefreshed }})</span>
              <button class="ml-2 underline-offset-2 hover:underline" @click="refreshMachine(selectedMachine!)">
                Vernieuwen
              </button>
            </p>
          </div>

          <!-- Right: missing items panel -->
          <div class="order-1 lg:order-2 w-full lg:sticky lg:top-4 lg:w-72 shrink-0">
            <div class="rounded-xl border bg-card shadow-sm">
              <div class="flex items-start justify-between gap-2 border-b px-4 py-3">
                <div>
                  <p class="text-sm font-semibold">Ontbrekend</p>
                  <p class="text-xs text-muted-foreground">{{ missingItems.length }} artikel{{ missingItems.length !== 1 ? 'en' : '' }} bij te vullen</p>
                </div>
                <button
                  v-if="missingItems.length > 0"
                  @click="printPickList"
                  :disabled="isPrinting"
                  :title="printerIp ? `Print naar ${printerIp}` : 'Stel eerst een printer-IP in bij Settings'"
                  class="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Loader2 v-if="isPrinting" class="size-3.5 animate-spin" />
                  <Printer v-else class="size-3.5" />
                  Print
                </button>
              </div>
              <div
                v-if="printError"
                class="border-b bg-destructive/5 px-4 py-2 text-xs text-destructive"
              >
                {{ printError }}
              </div>

              <div v-if="missingItems.length === 0" class="px-4 py-8 text-center text-sm text-muted-foreground">
                Alles is op voorraad 🎉
              </div>

              <div v-else class="divide-y max-h-[60vh] overflow-y-auto">
                <div
                  v-for="item in missingItems"
                  :key="item.name"
                  class="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ item.name }}</p>
                    <p class="text-xs text-muted-foreground tabular-nums">
                      {{ item.number }} / {{ item.total }}
                    </p>
                  </div>
                  <span
                    :class="[
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                      item.number === 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
                    ]"
                  >
                    -{{ item.total - item.number }}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </template>
    </div>
  </TopLoader>

  <!-- Slot history — Dialog on desktop, Drawer on mobile -->
  <component :is="isDesktop ? Dialog : Drawer" v-model:open="detailOpen">
    <component :is="isDesktop ? DialogContent : DrawerContent" :class="isDesktop ? 'sm:max-w-lg' : ''">
      <component :is="isDesktop ? DialogHeader : DrawerHeader">
        <component :is="isDesktop ? DialogTitle : DrawerTitle">{{ detailItem?.name }}</component>
        <component :is="isDesktop ? DialogDescription : DrawerDescription">
          Voorraad van de laatste {{ HISTORY_DAYS }} dagen
        </component>
      </component>

      <div :class="['flex flex-col gap-4', !isDesktop && 'px-4 pb-6']">
        <!-- Forecast summary -->
        <div v-if="detailItem" class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-lg border bg-muted/30 px-2 py-2">
            <p class="text-sm font-bold tabular-nums leading-none">{{ detailItem.number }} / {{ detailItem.total }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">Nu</p>
          </div>
          <div class="rounded-lg border bg-muted/30 px-2 py-2">
            <p class="text-sm font-bold tabular-nums leading-none">{{ depletionLabel }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">Per dag</p>
          </div>
          <div class="rounded-lg border bg-muted/30 px-2 py-2">
            <p :class="['text-sm font-bold leading-none', forecastClass(detailItem)]">{{ forecastLabel(detailItem) }}</p>
            <p class="mt-1 text-[11px] text-muted-foreground">Prognose</p>
          </div>
        </div>

        <p v-if="detailError" class="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {{ detailError }}
        </p>

        <div v-else-if="isLoadingDetail" class="flex h-28 items-center justify-center text-muted-foreground">
          <Loader2 class="size-5 animate-spin" />
        </div>

        <p v-else-if="detailChart.length === 0" class="py-8 text-center text-xs text-muted-foreground">
          Nog geen metingen voor dit vak.
        </p>

        <div v-else class="flex h-28 items-end gap-0.5 overflow-x-auto">
          <div
            v-for="point in detailChart"
            :key="point.key"
            class="group flex min-w-[6px] flex-1 flex-col items-center justify-end gap-1"
            :title="`${point.label}: ${point.number} / ${point.total} (${point.percent}%)`"
          >
            <div
              class="w-full rounded-sm bg-primary/40 transition-all group-hover:bg-primary/70"
              :style="{ height: `${Math.max(3, (point.percent / 100) * 88)}px` }"
            />
          </div>
        </div>

        <p v-if="detailChart.length > 0" class="flex justify-between text-[10px] text-muted-foreground">
          <span>{{ detailChart[0].label }}</span>
          <span>{{ detailChart[detailChart.length - 1].label }}</span>
        </p>
      </div>
    </component>
  </component>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { Bot, AlertCircle, PackageX, PackageMinus, PackageCheck, Printer, Loader2 } from "lucide-vue-next";
import { useMediaQuery } from "@vueuse/core";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { apiFetch } from "@/lib/apiFetch";
import { usePrinterSettings } from "@/lib/usePrinterSettings";
import {
  MACHINE_CODES,
  MACHINE_NAMES,
  dayKeyOf,
  fillPercent,
  mergeItems,
  slotStatus,
  type MachineCode,
  type MachineItem,
} from "@/lib/automaten";
// The ESC/POS builder and its Buffer polyfill are only reachable through the
// print button, so both are imported on demand in printPickList() below rather than
// shipped in this page's chunk. Trailing slash forces the npm polyfill rather
// than the Node built-in.
import type { Buffer as NodeBuffer } from "buffer/";

type PrinterAdapter = ConstructorParameters<typeof import("@node-escpos/core").Printer>[0];

const { printerIp, loadPrinterConfig } = usePrinterSettings();
const isPrinting = ref(false);
const printError = ref<string | null>(null);
const isDesktop = useMediaQuery("(min-width: 768px)");

// Ticks the "Laatst gemeten" label. Started in onMounted because this page is
// server-rendered and there is no window during SSR.
const now = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  void loadPrinterConfig();
  nowTimer = setInterval(() => (now.value = Date.now()), 30_000);
});
onUnmounted(() => clearInterval(nowTimer));

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
const scrapedAt = ref<string | null>(null);
const activeFilter = ref<"all" | "empty" | "low" | "ok">("all");

// ─── Merge same-name items ────────────────────────────────────────────────────
const mergedItems = computed(() => mergeItems(items.value));

// ─── Derived counts ───────────────────────────────────────────────────────────
const emptyCount = computed(() => mergedItems.value.filter((i) => slotStatus(i) === "empty").length);
const lowCount = computed(() => mergedItems.value.filter((i) => slotStatus(i) === "low").length);
const okCount = computed(() => mergedItems.value.filter((i) => slotStatus(i) === "ok").length);

const missingItems = computed(() =>
  mergedItems.value
    .filter((i) => i.number < i.total)
    .sort((a, b) => {
      // Empty first, then sort by most missing
      if (a.number === 0 && b.number > 0) return -1;
      if (b.number === 0 && a.number > 0) return 1;
      return (b.total - b.number) - (a.total - a.number);
    }),
);

const filteredItems = computed(() => {
  const rank = (i: MachineItem) => (slotStatus(i) === "empty" ? 0 : slotStatus(i) === "low" ? 1 : 2);
  const list =
    activeFilter.value === "all" ? mergedItems.value : mergedItems.value.filter((i) => slotStatus(i) === activeFilter.value);
  // Sort: empty first, then low, then ok
  return [...list].sort((a, b) => rank(a) - rank(b));
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function stockPercent(item: MachineItem) {
  if (item.total === 0) return 0;
  return Math.round((item.number / item.total) * 100);
}

function statusLabel(item: MachineItem) {
  const status = slotStatus(item);
  return status === "empty" ? "Leeg" : status === "low" ? "Laag" : "OK";
}

function statusBadge(item: MachineItem) {
  const status = slotStatus(item);
  if (status === "empty") return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  if (status === "low") return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400";
  return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
}

function statusBorder(item: MachineItem) {
  const status = slotStatus(item);
  if (status === "empty") return "border-red-200 dark:border-red-800/50";
  if (status === "low") return "border-orange-200 dark:border-orange-800/50";
  return "";
}

function progressColor(item: MachineItem) {
  const status = slotStatus(item);
  if (status === "empty") return "bg-red-500";
  if (status === "low") return "bg-orange-400";
  return "bg-green-500";
}

function relativeTime(iso: string | null) {
  if (!iso) return "onbekend";
  const minutes = Math.round((now.value - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes)) return "onbekend";
  if (minutes < 1) return "net nu";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "dag" : "dagen"} geleden`;
}

const lastMeasured = computed(() => relativeTime(scrapedAt.value));

// ─── History, trend & forecast ────────────────────────────────────────────────
const HISTORY_DAYS = 30;
const TREND_DAYS = 14;

interface HistorySnapshot {
  scrapedAt: string;
  dayKey: string;
  totalFilled: number;
  totalCapacity: number;
  emptyCount: number;
  lowCount: number;
}

interface SlotForecast {
  name: string;
  number: number;
  total: number;
  depletionPerDay: number | null;
  emptyEta: string | null;
}

const history = ref<HistorySnapshot[]>([]);
const slotForecasts = ref<SlotForecast[]>([]);
const isLoadingHistory = ref(false);

const forecastByName = computed(() => new Map(slotForecasts.value.map((f) => [f.name, f])));

/** One bar per calendar day: fill percentage of that day's last snapshot. */
const trendData = computed(() => {
  const lastPerDay = new Map<string, HistorySnapshot>();
  // history is chronological, so the last write for a day wins.
  for (const snapshot of history.value) lastPerDay.set(snapshot.dayKey, snapshot);

  const today = new Date();
  return Array.from({ length: TREND_DAYS }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (TREND_DAYS - 1 - index));
    const snapshot = lastPerDay.get(dayKeyOf(date));
    return {
      key: dayKeyOf(date),
      label: date.toLocaleDateString("nl-BE", { weekday: "short" }).slice(0, 2),
      fullLabel: date.toLocaleDateString("nl-BE", { day: "numeric", month: "short" }),
      percent: snapshot ? fillPercent(snapshot) : null,
      isToday: index === TREND_DAYS - 1,
    };
  });
});

const hasTrend = computed(() => trendData.value.some((d) => d.percent !== null));

/** Days until the slot is projected to be empty, or null when there is no forecast. */
function forecastDays(item: MachineItem): number | null {
  const eta = forecastByName.value.get(item.name)?.emptyEta;
  if (!eta) return null;
  const days = (Date.parse(eta) - now.value) / 86_400_000;
  return Number.isFinite(days) ? Math.max(0, days) : null;
}

function forecastLabel(item: MachineItem) {
  if (slotStatus(item) === "empty") return "Nu leeg";
  const days = forecastDays(item);
  if (days === null) return "Leeg over ~? dagen";
  if (days < 1) return "Leeg binnen 1 dag";
  const rounded = Math.round(days);
  return `Leeg over ~${rounded} ${rounded === 1 ? "dag" : "dagen"}`;
}

function forecastClass(item: MachineItem) {
  if (slotStatus(item) === "empty") return "text-red-600 dark:text-red-400 font-medium";
  const days = forecastDays(item);
  if (days === null) return "text-muted-foreground/40";
  return days < 2 ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground";
}

async function fetchHistory(code: MachineCode) {
  isLoadingHistory.value = true;
  history.value = [];
  slotForecasts.value = [];

  try {
    const res = await apiFetch(`/api/automaten/history?machine=${code}&days=${HISTORY_DAYS}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { snapshots: HistorySnapshot[]; slots: SlotForecast[] };
    history.value = data.snapshots;
    slotForecasts.value = data.slots;
  } catch (e) {
    // History is a nice-to-have: the live stock table must still render.
    console.error("[automaten] Kon geschiedenis niet laden", e);
  } finally {
    isLoadingHistory.value = false;
  }
}

// ─── Slot detail drawer ───────────────────────────────────────────────────────
interface SlotPoint {
  scrapedAt: string;
  number: number;
  total: number;
}

const detailOpen = ref(false);
const detailItem = ref<MachineItem | null>(null);
const detailPoints = ref<SlotPoint[]>([]);
const detailForecast = ref<{ depletionPerDay: number | null; emptyEta: string | null } | null>(null);
const isLoadingDetail = ref(false);
const detailError = ref<string | null>(null);

/** 30 days of scrapes is far too many bars — collapse to the last one per day. */
const detailChart = computed(() => {
  const lastPerDay = new Map<string, SlotPoint>();
  for (const point of detailPoints.value) lastPerDay.set(dayKeyOf(point.scrapedAt), point);
  return Array.from(lastPerDay.values()).map((point) => ({
    key: point.scrapedAt,
    percent: point.total === 0 ? 0 : Math.round((point.number / point.total) * 100),
    number: point.number,
    total: point.total,
    label: new Date(point.scrapedAt).toLocaleDateString("nl-BE", { day: "numeric", month: "short" }),
  }));
});

const depletionLabel = computed(() => {
  const rate = detailForecast.value?.depletionPerDay;
  return rate === null || rate === undefined ? "—" : rate.toFixed(1);
});

async function openSlotDetail(item: MachineItem) {
  if (!selectedMachine.value) return;
  detailItem.value = item;
  detailOpen.value = true;
  detailPoints.value = [];
  detailForecast.value = null;
  detailError.value = null;
  isLoadingDetail.value = true;

  try {
    const res = await apiFetch(
      `/api/automaten/history/slot?machine=${selectedMachine.value}&name=${encodeURIComponent(item.name)}&days=${HISTORY_DAYS}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      points: SlotPoint[];
      depletionPerDay: number | null;
      emptyEta: string | null;
    };
    detailPoints.value = data.points;
    detailForecast.value = { depletionPerDay: data.depletionPerDay, emptyEta: data.emptyEta };
  } catch {
    detailError.value = "Kon de geschiedenis van dit vak niet laden.";
  } finally {
    isLoadingDetail.value = false;
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function selectMachine(code: MachineCode) {
  selectedMachine.value = code;
  activeFilter.value = "all";
  await Promise.all([fetchMachine(code), fetchHistory(code)]);
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
    const data = (await res.json()) as { ok: boolean; items: MachineItem[]; scrapedAt?: string };
    items.value = data.items;
    scrapedAt.value = data.scrapedAt ?? new Date().toISOString();
    lastRefreshed.value = new Date().toLocaleTimeString("nl-BE");
  } catch (e: any) {
    error.value = e?.message ?? "Onbekende fout. Probeer opnieuw.";
  } finally {
    isFetching.value = false;
  }
}

async function refreshMachine(code: MachineCode) {
  await Promise.all([fetchMachine(code), fetchHistory(code)]);
}

// ─── Printer transport ────────────────────────────────────────────────────────
// A browser has no raw TCP socket, so instead of @node-escpos/network-adapter we
// hand the printer an adapter that POSTs the finished ESC/POS buffer at port 9100
// (JetDirect), which is what the POS 80D speaks - it has no HTTP print service,
// so there is nothing to negotiate. @node-escpos/core only ever calls write()
// and close().
//
// Port 9100 is a raw socket, not an HTTP server: it consumes the body, prints it,
// and never sends a response. The request can therefore only ever end in our own
// timeout, and hitting that timeout is what "delivered" looks like. A refused or
// unreachable port rejects long before the timeout, and is a real error.
function createHttpAdapter(ip: string) {
  const send = async (buffer: Buffer) => {
    if (typeof window !== "undefined" && window.location.protocol === "https:") {
      throw new Error(
        `De browser blokkeert de verbinding naar ${ip}: deze pagina is HTTPS, de printer HTTP.`,
      );
    }

    try {
      await fetch(`http://${ip.includes(":") ? ip : `${ip}:9100`}/`, {
        method: "POST",
        mode: "no-cors",
        body: new Uint8Array(buffer),
        signal: AbortSignal.timeout(2000),
      });
    } catch (err) {
      const name = (err as { name?: string } | undefined)?.name;
      if (name !== "TimeoutError" && name !== "AbortError") {
        throw new Error(`Kan de printer op ${ip} niet bereiken.`);
      }
    }
  };

  return {
    open: (cb?: (e: Error | null) => void) => cb?.(null),
    write: (data: NodeBuffer, cb?: (e: Error | null) => void) => {
      void send(data).then(
        () => cb?.(null),
        (e) => cb?.(e instanceof Error ? e : new Error(String(e))),
      );
    },
    close: (cb?: (e: Error | null) => void) => cb?.(null),
    read: () => {},
  } as unknown as PrinterAdapter;
}

// ─── Print pick list (pluklijst) to thermal printer ──────────────────────────
// Printed straight from the browser: the printer lives on this network, not on
// the server.
async function printPickList() {
  printError.value = null;
  const ip = printerIp.value.trim();
  if (!ip) {
    printError.value = "Geen printer ingesteld. Stel een printer-IP in bij Settings.";
    return;
  }
  if (missingItems.value.length === 0) return;

  isPrinting.value = true;

  const [{ Printer: ThermalPrinter }, { Buffer }] = await Promise.all([
    import("@node-escpos/core"),
    import("buffer/"),
  ]);

  // iconv-lite and mutable-buffer reach for Buffer as a global.
  (globalThis as { Buffer?: unknown }).Buffer ??= Buffer;

  const printer = new ThermalPrinter(createHttpAdapter(ip), {
    encoding: "CP858",
    width: 48,
  });

  printer.hardware("init");
  printer.setCharacterCodeTable(19); // PC858 (Latin-1 + Euro)
  printer.align("ct");
  printer.style("b");
  printer.size(2, 2);
  printer.text("PLUKLIJST");
  printer.size(1, 1);
  printer.style("normal");
  printer.text(selectedMachine.value ? MACHINE_NAMES[selectedMachine.value] : "Automaat");
  printer.text(
    new Date().toLocaleString("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  printer.drawLine();

  printer.align("lt");
  printer.tableCustom([
    { text: "Artikel", align: "left", width: 0.72, style: "b" },
    { text: "Pluk", align: "right", width: 0.28, style: "b" },
  ]);
  printer.drawLine();

  let totalToPick = 0;
  for (const item of missingItems.value) {
    const toPick = Math.max(0, item.total - item.number);
    totalToPick += toPick;
    printer.tableCustom([
      { text: item.name, align: "left", width: 0.72 },
      { text: `${toPick}x`, align: "right", width: 0.28 },
    ]);
  }

  printer.drawLine();
  printer.tableCustom([
    { text: `Totaal (${missingItems.value.length} artikelen)`, align: "left", width: 0.72, style: "b" },
    { text: `${totalToPick}x`, align: "right", width: 0.28, style: "b" },
  ]);

  printer.newLine();
  printer.cut();

  try {
    // close() flushes the buffer through the adapter - this is where the
    // receipt actually leaves the browser.
    await printer.close();
  } catch (e: any) {
    printError.value = e?.message ?? "Printen mislukt.";
  } finally {
    isPrinting.value = false;
  }
}
</script>
