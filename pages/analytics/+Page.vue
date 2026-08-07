<template>
  <TopLoader :loading="loading">
    <div class="flex flex-col gap-6">
      <!-- ─── Header ──────────────────────────────────────────────────────────── -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Uitgaven</h1>
          <p class="text-sm text-muted-foreground">Wat je uitgeeft, bij wie, en of het stijgt.</p>
        </div>

        <!-- Period picker -->
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="p in PERIODS"
            :key="p.value"
            type="button"
            class="rounded-md border px-2.5 py-1.5 text-sm transition-colors"
            :class="
              period === p.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted'
            "
            @click="selectPeriod(p.value)"
          >
            {{ p.label }}
          </button>
        </div>
      </div>

      <!-- Free range inputs -->
      <div v-if="period === 'custom'" class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Van</label>
          <Input v-model="customFrom" type="date" class="w-44" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Tot</label>
          <Input v-model="customTo" type="date" class="w-44" />
        </div>
        <Button :disabled="!customFrom || !customTo" @click="fetchAnalytics">Toepassen</Button>
      </div>

      <p v-if="error" class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        {{ error }}
      </p>

      <!-- ─── Stat cards ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div v-for="stat in statCards" :key="stat.label" class="rounded-lg border bg-card p-4">
          <div class="mb-2 flex items-center gap-1.5 text-muted-foreground">
            <component :is="stat.icon" class="size-3.5" />
            <span class="text-xs font-medium">{{ stat.label }}</span>
          </div>
          <p class="text-2xl font-bold tabular-nums" :class="stat.tone">{{ loading ? "—" : stat.value }}</p>
        </div>
      </div>

      <!-- ─── Month bar chart ─────────────────────────────────────────────────── -->
      <div class="rounded-lg border bg-card p-5">
        <p class="text-sm font-semibold">Uitgaven per maand</p>
        <p class="mb-5 text-xs text-muted-foreground">{{ rangeLabel }}</p>

        <div v-if="loading" class="flex h-32 items-end gap-1.5">
          <div
            v-for="i in 12"
            :key="i"
            class="flex-1 animate-pulse rounded-sm bg-muted"
            :style="{ height: `${20 + ((i * 17) % 60)}px` }"
          />
        </div>

        <div v-else-if="data.byMonth.length === 0" class="py-8 text-center text-sm text-muted-foreground">
          Geen uitgaven in deze periode.
        </div>

        <div v-else class="flex h-32 items-end gap-1.5">
          <div v-for="m in data.byMonth" :key="m.month" class="group flex flex-1 flex-col items-center gap-1">
            <span
              class="text-[10px] font-medium tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            >
              {{ m.spend ? formatCompact(m.spend) : "" }}
            </span>
            <div
              class="w-full rounded-sm bg-primary/40 transition-all hover:bg-primary/60"
              :style="{
                height: m.spend ? `${Math.max(6, (m.spend / maxMonth) * 96)}px` : '3px',
                opacity: m.spend ? undefined : '0.2',
              }"
              :title="`${monthLabel(m.month)}: ${formatEuro(m.spend)}`"
            />
            <span class="text-[10px] text-muted-foreground">{{ monthShort(m.month) }}</span>
          </div>
        </div>
      </div>

      <!-- ─── Price changes ───────────────────────────────────────────────────── -->
      <div class="rounded-lg border bg-card p-5">
        <p class="text-sm font-semibold">Prijswijzigingen</p>
        <p class="mb-4 text-xs text-muted-foreground">Meer dan 5% verschil, nieuwste eerst.</p>

        <div v-if="loading" class="flex flex-col gap-2">
          <div v-for="i in 3" :key="i" class="h-12 animate-pulse rounded-md bg-muted" />
        </div>

        <p v-else-if="data.priceChanges.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          Geen prijswijzigingen in deze periode.
        </p>

        <div v-else class="flex flex-col divide-y">
          <div v-for="(change, i) in data.priceChanges" :key="`${change.productId}-${change.changedAt}-${i}`"
            class="flex items-center justify-between gap-3 py-2.5">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ change.internalName }}</p>
              <p class="truncate text-xs text-muted-foreground">
                {{ change.supplierName }} · {{ formatDate(change.changedAt) }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ formatEuro(change.oldPrice) }} → {{ formatEuro(change.newPrice) }}
              </span>
              <span
                class="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
                :class="
                  change.pct > 0
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                "
              >
                {{ change.pct > 0 ? "▲" : "▼" }} {{ Math.abs(change.pct).toFixed(1) }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Suppliers + top products ────────────────────────────────────────── -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- Per supplier -->
        <div class="rounded-lg border bg-card p-5">
          <p class="mb-4 text-sm font-semibold">Per leverancier</p>

          <div v-if="loading" class="flex flex-col gap-2">
            <div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-md bg-muted" />
          </div>

          <p v-else-if="data.bySupplier.length === 0" class="py-6 text-center text-sm text-muted-foreground">
            Geen bestellingen in deze periode.
          </p>

          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 text-left font-medium text-muted-foreground">Leverancier</th>
                <th class="pb-2 text-right font-medium text-muted-foreground">Bestellingen</th>
                <th class="pb-2 text-right font-medium text-muted-foreground">Uitgaven</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="s in data.bySupplier" :key="s.supplierId">
                <td class="py-2.5 pr-3">
                  <p class="truncate font-medium">{{ s.supplierName }}</p>
                  <!-- Share-of-total bar -->
                  <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div class="h-full rounded-full bg-primary" :style="{ width: `${sharePct(s.spend)}%` }" />
                  </div>
                </td>
                <td class="py-2.5 text-right tabular-nums text-muted-foreground">{{ s.orderCount }}</td>
                <td class="py-2.5 text-right font-semibold tabular-nums">{{ formatEuro(s.spend) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Top products -->
        <div class="rounded-lg border bg-card p-5">
          <p class="mb-4 text-sm font-semibold">Top producten</p>

          <div v-if="loading" class="flex flex-col gap-2">
            <div v-for="i in 5" :key="i" class="h-10 animate-pulse rounded-md bg-muted" />
          </div>

          <p v-else-if="data.topProducts.length === 0" class="py-6 text-center text-sm text-muted-foreground">
            Geen producten in deze periode.
          </p>

          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="pb-2 text-left font-medium text-muted-foreground">Product</th>
                <th class="pb-2 text-right font-medium text-muted-foreground">Aantal</th>
                <th class="pb-2 text-right font-medium text-muted-foreground">Uitgaven</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="p in data.topProducts" :key="p.productId">
                <td class="truncate py-2.5 pr-3 font-medium">{{ p.internalName }}</td>
                <td class="py-2.5 text-right tabular-nums text-muted-foreground">{{ p.totalQuantity }}</td>
                <td class="py-2.5 text-right font-semibold tabular-nums">{{ formatEuro(p.spend) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </TopLoader>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Euro, ClipboardList, Receipt, TrendingUp } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/lib/useAuth";

interface Analytics {
  totalSpend: number;
  orderCount: number;
  bySupplier: Array<{ supplierId: string; supplierName: string; spend: number; orderCount: number }>;
  byMonth: Array<{ month: string; spend: number }>;
  topProducts: Array<{ productId: string; internalName: string; totalQuantity: number; spend: number }>;
  priceChanges: Array<{
    productId: string;
    internalName: string;
    supplierName: string;
    oldPrice: number;
    newPrice: number;
    changedAt: string;
    pct: number;
  }>;
}

const EMPTY: Analytics = {
  totalSpend: 0,
  orderCount: 0,
  bySupplier: [],
  byMonth: [],
  topProducts: [],
  priceChanges: [],
};

const { loading: authLoading } = useAuth();

const loading = ref(true);
const error = ref("");
const data = ref<Analytics>(EMPTY);

// ─── Period ───────────────────────────────────────────────────────────────────
type Period = "thisMonth" | "lastMonth" | "thisYear" | "custom";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "thisMonth", label: "Deze maand" },
  { value: "lastMonth", label: "Vorige maand" },
  { value: "thisYear", label: "Dit jaar" },
  { value: "custom", label: "Vrij bereik" },
];

const period = ref<Period>("thisYear");
const customFrom = ref("");
const customTo = ref("");

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** [from, to] as YYYY-MM-DD for the selected period. */
const range = computed<{ from: string; to: string }>(() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period.value) {
    case "thisMonth":
      return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
    case "lastMonth":
      return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "custom":
      return { from: customFrom.value, to: customTo.value };
  }
});

function selectPeriod(next: Period) {
  period.value = next;
  if (next === "custom") {
    if (!customFrom.value) customFrom.value = range.value.from || `${new Date().getFullYear()}-01-01`;
    if (!customTo.value) customTo.value = iso(new Date());
    return; // wait for "Toepassen"
  }
  fetchAnalytics();
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchAnalytics() {
  const { from, to } = range.value;
  if (!from || !to) return;

  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams({ from, to });
    const res = await apiFetch(`/api/orders/analytics?${params}`);
    if (!res.ok) {
      error.value =
        res.status === 403
          ? "Je hebt geen toegang tot deze pagina."
          : `Kon de gegevens niet laden (${res.status}).`;
      data.value = EMPTY;
      return;
    }
    data.value = (await res.json()) as Analytics;
  } catch {
    error.value = "Kon de gegevens niet laden.";
    data.value = EMPTY;
  } finally {
    loading.value = false;
  }
}

watch(
  authLoading,
  (isLoading) => {
    if (!isLoading) fetchAnalytics();
  },
  { immediate: true },
);

// ─── Derived ──────────────────────────────────────────────────────────────────
const priceIncreaseCount = computed(() => data.value.priceChanges.filter((c) => c.pct > 0).length);

const averageOrder = computed(() =>
  data.value.orderCount > 0 ? data.value.totalSpend / data.value.orderCount : 0,
);

const statCards = computed(() => [
  { label: "Totale uitgaven", value: formatEuro(data.value.totalSpend), icon: Euro, tone: "" },
  { label: "Bestellingen", value: String(data.value.orderCount), icon: ClipboardList, tone: "" },
  { label: "Gem. bestelwaarde", value: formatEuro(averageOrder.value), icon: Receipt, tone: "" },
  {
    label: "Prijsstijgingen",
    value: String(priceIncreaseCount.value),
    icon: TrendingUp,
    tone: priceIncreaseCount.value > 0 ? "text-red-600 dark:text-red-400" : "",
  },
]);

const maxMonth = computed(() => Math.max(1, ...data.value.byMonth.map((m) => m.spend)));

const rangeLabel = computed(() => {
  const { from, to } = range.value;
  if (!from || !to) return "";
  return `${formatDate(from)} — ${formatDate(to)}`;
});

function sharePct(spend: number): number {
  if (data.value.totalSpend <= 0) return 0;
  return Math.min(100, (spend / data.value.totalSpend) * 100);
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function formatEuro(n: number): string {
  return `€ ${(n ?? 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Compact label for the tiny bar-chart hover text. */
function formatCompact(n: number): string {
  if (n >= 1000) return `€ ${Math.round(n / 100) / 10}k`;
  return `€ ${Math.round(n)}`;
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

function monthShort(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("nl-NL", { month: "short" });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}
</script>
