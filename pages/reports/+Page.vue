<template>
  <TopLoader :loading="loading">
    <div id="print-report" class="flex flex-col gap-6">
      <!-- ─── Header ──────────────────────────────────────────────────────────── -->
      <div class="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Bestelrapport</h1>
          <p class="text-sm text-muted-foreground">
            Vergelijk twee periodes om te zien wat je opvallend meer (of minder) bent gaan bestellen.
          </p>
        </div>
        <Button variant="outline" :disabled="loading" @click="exportPdf">
          <Printer class="size-4" />
          Exporteer naar PDF
        </Button>
      </div>

      <!-- ─── Print-only header ──────────────────────────────────────────────────
           The screen header above is interactive chrome; this is the plain-text
           summary that actually ends up on paper, since the live controls
           (buttons, dropdowns) carry no meaning once printed. -->
      <div class="hidden print:block">
        <h1 class="text-xl font-bold">Bestelrapport</h1>
        <p class="text-sm text-muted-foreground">
          Periode A: {{ formatRangeLabel(rangeA) }} &nbsp;·&nbsp; Periode B: {{ formatRangeLabel(rangeB) }}
          <template v-if="supplierFilterName">&nbsp;·&nbsp; Leverancier: {{ supplierFilterName }}</template>
          &nbsp;·&nbsp; Gegenereerd op
          {{ new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) }}
        </p>
      </div>

      <!-- ─── Period pickers ──────────────────────────────────────────────────── -->
      <div class="print:hidden">
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="rounded-lg border bg-card p-4">
            <p class="mb-2 text-sm font-semibold">
              Periode A <span class="font-normal text-muted-foreground">(vergelijking)</span>
            </p>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="p in PERIODS"
                :key="p.value"
                type="button"
                class="rounded-md border px-2.5 py-1.5 text-sm transition-colors"
                :class="
                  periodA === p.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                "
                @click="selectPeriod('A', p.value)"
              >
                {{ p.label }}
              </button>
            </div>
            <div v-if="periodA === 'custom'" class="mt-3 flex flex-wrap items-end gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium">Van</label>
                <Input v-model="customFromA" type="date" class="w-40" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium">Tot</label>
                <Input v-model="customToA" type="date" class="w-40" />
              </div>
            </div>
            <p class="mt-3 text-xs text-muted-foreground">{{ formatRangeLabel(rangeA) }}</p>
          </div>

          <div class="rounded-lg border bg-card p-4">
            <p class="mb-2 text-sm font-semibold">
              Periode B <span class="font-normal text-muted-foreground">(te beoordelen)</span>
            </p>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="p in PERIODS"
                :key="p.value"
                type="button"
                class="rounded-md border px-2.5 py-1.5 text-sm transition-colors"
                :class="
                  periodB === p.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted'
                "
                @click="selectPeriod('B', p.value)"
              >
                {{ p.label }}
              </button>
            </div>
            <div v-if="periodB === 'custom'" class="mt-3 flex flex-wrap items-end gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium">Van</label>
                <Input v-model="customFromB" type="date" class="w-40" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-xs font-medium">Tot</label>
                <Input v-model="customToB" type="date" class="w-40" />
              </div>
            </div>
            <p class="mt-3 text-xs text-muted-foreground">{{ formatRangeLabel(rangeB) }}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium">Leverancier:</label>
            <select
              v-model="supplierFilter"
              class="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Alle leveranciers</option>
              <option v-for="s in data.bySupplier" :key="s.supplierId" :value="s.supplierId">
                {{ s.supplierName }}
              </option>
            </select>
          </div>
          <Button :disabled="!canFetch" @click="fetchReport">Vergelijk</Button>
        </div>
      </div>

      <p
        v-if="error"
        class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {{ error }}
      </p>

      <!-- ─── Stat cards ──────────────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 print:break-inside-avoid">
        <div v-for="stat in statCards" :key="stat.label" class="rounded-lg border bg-card p-4">
          <div class="mb-2 flex items-center gap-1.5 text-muted-foreground">
            <component :is="stat.icon" class="size-3.5" />
            <span class="text-xs font-medium">{{ stat.label }}</span>
          </div>
          <p class="text-2xl font-bold tabular-nums" :class="stat.tone">{{ loading ? "—" : stat.value }}</p>
          <p v-if="!loading && stat.sub" class="mt-1 text-xs" :class="stat.subTone">{{ stat.sub }}</p>
        </div>
      </div>

      <!-- ─── A vs B comparison chart ─────────────────────────────────────────── -->
      <div class="rounded-lg border bg-card p-5 print:break-inside-avoid">
        <p class="text-sm font-semibold">Periode A vs Periode B</p>
        <p class="mb-5 text-xs text-muted-foreground">De totalen naast elkaar — B is de periode die je beoordeelt.</p>

        <div v-if="loading" class="flex h-32 items-end gap-6">
          <div v-for="i in 3" :key="i" class="h-24 flex-1 animate-pulse rounded-sm bg-muted" />
        </div>

        <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div v-for="m in comparisonMetrics" :key="m.label" class="flex flex-col items-center">
            <p class="mb-3 text-xs font-medium text-muted-foreground">{{ m.label }}</p>
            <div class="flex h-28 items-end gap-4">
              <div class="flex flex-col items-center gap-1.5">
                <span class="text-xs tabular-nums text-muted-foreground">{{ m.aLabel }}</span>
                <div
                  class="w-10 rounded-t bg-muted-foreground/30"
                  :style="{ height: `${chartBarHeight(m.a, m.max)}px` }"
                />
                <span class="text-[10px] font-medium text-muted-foreground">A</span>
              </div>
              <div class="flex flex-col items-center gap-1.5">
                <span class="text-xs font-semibold tabular-nums">{{ m.bLabel }}</span>
                <div class="w-10 rounded-t bg-primary" :style="{ height: `${chartBarHeight(m.b, m.max)}px` }" />
                <span class="text-[10px] font-medium">B</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── Over-ordered ────────────────────────────────────────────────────── -->
      <div class="rounded-lg border bg-card p-5 print:break-inside-avoid">
        <div class="mb-1 flex items-center gap-2">
          <AlertTriangle class="size-4 text-amber-600 dark:text-amber-400" />
          <p class="text-sm font-semibold">Mogelijk te veel besteld</p>
        </div>
        <p class="mb-4 text-xs text-muted-foreground">
          Producten waarvan het bestelritme in periode B minstens 30% hoger ligt dan in periode A, gesorteerd op de
          grootste extra hoeveelheid.
        </p>

        <div v-if="loading" class="flex flex-col gap-2">
          <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-md bg-muted" />
        </div>

        <p v-else-if="filteredOverOrdered.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          Geen opvallende toenames gevonden{{ supplierFilterName ? ` bij ${supplierFilterName}` : "" }}.
        </p>

        <div v-else class="flex flex-col gap-3.5">
          <div v-for="p in filteredOverOrdered" :key="p.productId" class="print:break-inside-avoid">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <p class="min-w-0 truncate text-sm">
                <span class="font-medium">{{ p.internalName }}</span>
                <span class="text-xs text-muted-foreground"> · {{ p.supplierName }}</span>
              </p>
              <span class="shrink-0 text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                +{{ p.extraQty }}<template v-if="p.deltaPct !== null"> ({{ p.deltaPct.toFixed(0) }}%)</template>
                <span v-else class="font-normal">nieuw</span>
              </span>
            </div>
            <div class="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-amber-500"
                :style="{ width: `${barPct(p.extraQty, maxOverExtra)}%` }"
              />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              A: {{ p.qtyA }} → B: {{ p.qtyB }}
              <template v-if="p.pctOfIdealStock !== null">
                · {{ p.pctOfIdealStock.toFixed(0) }}% van ideaalvoorraad</template
              >
            </p>
          </div>
        </div>
      </div>

      <!-- ─── Under-ordered ───────────────────────────────────────────────────── -->
      <div class="rounded-lg border bg-card p-5 print:break-inside-avoid">
        <div class="mb-1 flex items-center gap-2">
          <TrendingDown class="size-4 text-muted-foreground" />
          <p class="text-sm font-semibold">Minder besteld dan voorheen</p>
        </div>
        <p class="mb-4 text-xs text-muted-foreground">
          Producten met een duidelijk lager bestelritme, of helemaal gestopt.
        </p>

        <div v-if="loading" class="flex flex-col gap-2">
          <div v-for="i in 3" :key="i" class="h-10 animate-pulse rounded-md bg-muted" />
        </div>

        <p v-else-if="filteredUnderOrdered.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          Geen opvallende afnames gevonden{{ supplierFilterName ? ` bij ${supplierFilterName}` : "" }}.
        </p>

        <div v-else class="flex flex-col gap-3.5">
          <div v-for="p in filteredUnderOrdered" :key="p.productId" class="print:break-inside-avoid">
            <div class="mb-1 flex items-baseline justify-between gap-2">
              <p class="min-w-0 truncate text-sm">
                <span class="font-medium">{{ p.internalName }}</span>
                <span class="text-xs text-muted-foreground"> · {{ p.supplierName }}</span>
              </p>
              <span class="shrink-0 text-xs font-semibold tabular-nums text-green-700 dark:text-green-400">
                {{ p.qtyB === 0 ? "gestopt" : `${p.deltaPct !== null ? p.deltaPct.toFixed(0) : "—"}%` }}
              </span>
            </div>
            <div class="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full"
                :class="p.qtyB === 0 ? 'bg-muted-foreground/40' : 'bg-green-500'"
                :style="{ width: `${barPct(Math.abs(p.extraQty), maxUnderExtra)}%` }"
              />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">A: {{ p.qtyA }} → B: {{ p.qtyB }}</p>
          </div>
        </div>
      </div>

      <!-- ─── By supplier ─────────────────────────────────────────────────────── -->
      <div class="rounded-lg border bg-card p-5 print:break-inside-avoid">
        <div class="mb-1 flex items-center justify-between gap-2">
          <p class="text-sm font-semibold">Per leverancier</p>
          <button
            v-if="supplierFilter"
            type="button"
            class="text-xs text-muted-foreground underline hover:text-foreground print:hidden"
            @click="supplierFilter = ''"
          >
            Filter wissen
          </button>
        </div>
        <p class="mb-4 text-xs text-muted-foreground print:hidden">
          Klik op een leverancier om de rest van het rapport te filteren.
        </p>

        <div v-if="loading" class="flex flex-col gap-2">
          <div v-for="i in 4" :key="i" class="h-10 animate-pulse rounded-md bg-muted" />
        </div>

        <p v-else-if="data.bySupplier.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          Geen bestellingen in deze periodes.
        </p>

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b">
              <th class="pb-2 text-left font-medium text-muted-foreground">Leverancier</th>
              <th class="pb-2 text-right font-medium text-muted-foreground">Aantal A</th>
              <th class="pb-2 text-right font-medium text-muted-foreground">Aantal B</th>
              <th class="pb-2 text-right font-medium text-muted-foreground">Uitgaven B</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr
              v-for="s in data.bySupplier"
              :key="s.supplierId"
              class="cursor-pointer transition-colors hover:bg-muted/50"
              :class="supplierFilter === s.supplierId ? 'bg-primary/5' : ''"
              @click="supplierFilter = supplierFilter === s.supplierId ? '' : s.supplierId"
            >
              <td class="py-2.5 pr-3 font-medium">{{ s.supplierName }}</td>
              <td class="py-2.5 text-right tabular-nums text-muted-foreground">{{ s.qtyA }}</td>
              <td class="py-2.5 text-right font-semibold tabular-nums">{{ s.qtyB }}</td>
              <td class="py-2.5 text-right tabular-nums">{{ formatEuro(s.spendB) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ─── Full product table ──────────────────────────────────────────────── -->
      <div class="rounded-lg border">
        <div class="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="font-semibold">{{ supplierFilterName ? `Producten — ${supplierFilterName}` : "Alle producten" }}</p>
          <div class="relative w-full sm:w-56 print:hidden">
            <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="tableSearch" placeholder="Zoeken…" class="h-8 pl-9 text-sm" />
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b bg-muted/30">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-muted-foreground">Product</th>
                <th class="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">Leverancier</th>
                <th class="px-4 py-2 text-right font-medium text-muted-foreground">A</th>
                <th class="px-4 py-2 text-right font-medium text-muted-foreground">B</th>
                <th class="px-4 py-2 text-right font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="p in filteredProducts" :key="p.productId" class="hover:bg-muted/30">
                <td class="px-4 py-2 font-medium">{{ p.internalName }}</td>
                <td class="hidden px-4 py-2 text-muted-foreground sm:table-cell">{{ p.supplierName }}</td>
                <td class="px-4 py-2 text-right tabular-nums text-muted-foreground">{{ p.qtyA }}</td>
                <td class="px-4 py-2 text-right tabular-nums">{{ p.qtyB }}</td>
                <td class="px-4 py-2 text-right">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="statusStyle(p.status)">
                    {{ statusLabel(p.status) }}
                  </span>
                </td>
              </tr>
              <tr v-if="filteredProducts.length === 0">
                <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">Geen producten gevonden.</td>
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
import {
  AlertTriangle,
  ClipboardList,
  Euro,
  Package,
  Printer,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/lib/useAuth";

type Status = "new" | "stopped" | "increased" | "decreased" | "stable";

interface ProductRow {
  productId: string;
  internalName: string;
  supplierName: string;
  supplierId: string;
  idealStock: number;
  pctOfIdealStock: number | null;
  qtyA: number;
  qtyB: number;
  spendA: number;
  spendB: number;
  deltaPct: number | null;
  extraQty: number;
  status: Status;
}

interface SupplierRow {
  supplierId: string;
  supplierName: string;
  qtyA: number;
  qtyB: number;
  spendA: number;
  spendB: number;
}

interface PeriodTotals {
  from: string;
  to: string;
  days: number;
  totalQuantity: number;
  totalSpend: number;
  orderCount: number;
  distinctProducts: number;
}

interface Report {
  periodA: PeriodTotals;
  periodB: PeriodTotals;
  products: ProductRow[];
  overOrdered: ProductRow[];
  underOrdered: ProductRow[];
  bySupplier: SupplierRow[];
}

const EMPTY_TOTALS: PeriodTotals = {
  from: "",
  to: "",
  days: 0,
  totalQuantity: 0,
  totalSpend: 0,
  orderCount: 0,
  distinctProducts: 0,
};
const EMPTY: Report = {
  periodA: EMPTY_TOTALS,
  periodB: EMPTY_TOTALS,
  products: [],
  overOrdered: [],
  underOrdered: [],
  bySupplier: [],
};

const { loading: authLoading } = useAuth();

const loading = ref(true);
const error = ref("");
const data = ref<Report>(EMPTY);
const tableSearch = ref("");
const supplierFilter = ref("");

const supplierFilterName = computed(
  () => data.value.bySupplier.find((s) => s.supplierId === supplierFilter.value)?.supplierName ?? "",
);

// A fresh comparison can drop the previously selected supplier entirely
// (no orders for it in the new ranges) — clear the filter instead of
// silently showing an empty report.
watch(
  () => data.value.bySupplier,
  (suppliers) => {
    if (supplierFilter.value && !suppliers.some((s) => s.supplierId === supplierFilter.value)) {
      supplierFilter.value = "";
    }
  },
);

// ─── Periods ──────────────────────────────────────────────────────────────────
type Period = "thisMonth" | "lastMonth" | "thisYear" | "lastYear" | "custom";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "thisMonth", label: "Deze maand" },
  { value: "lastMonth", label: "Vorige maand" },
  { value: "thisYear", label: "Dit jaar" },
  { value: "lastYear", label: "Vorig jaar" },
  { value: "custom", label: "Vrij bereik" },
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (period) {
    case "thisMonth":
      return { from: iso(new Date(Date.UTC(y, m, 1))), to: iso(new Date(Date.UTC(y, m + 1, 0))) };
    case "lastMonth":
      return { from: iso(new Date(Date.UTC(y, m - 1, 1))), to: iso(new Date(Date.UTC(y, m, 0))) };
    case "thisYear":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "custom":
      return { from: customFrom, to: customTo };
  }
}

// Default: compare last month's pace (baseline) against this month so far.
const periodA = ref<Period>("lastMonth");
const periodB = ref<Period>("thisMonth");
const customFromA = ref("");
const customToA = ref("");
const customFromB = ref("");
const customToB = ref("");

const rangeA = computed(() => periodRange(periodA.value, customFromA.value, customToA.value));
const rangeB = computed(() => periodRange(periodB.value, customFromB.value, customToB.value));

const canFetch = computed(() => !!rangeA.value.from && !!rangeA.value.to && !!rangeB.value.from && !!rangeB.value.to);

function selectPeriod(which: "A" | "B", next: Period) {
  const target = which === "A" ? periodA : periodB;
  const from = which === "A" ? customFromA : customFromB;
  const to = which === "A" ? customToA : customToB;
  const currentRange = which === "A" ? rangeA : rangeB;

  target.value = next;
  if (next === "custom") {
    if (!from.value) from.value = currentRange.value.from || `${new Date().getFullYear()}-01-01`;
    if (!to.value) to.value = iso(new Date());
    return; // wait for "Vergelijk"
  }
  fetchReport();
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchReport() {
  const a = rangeA.value;
  const b = rangeB.value;
  if (!a.from || !a.to || !b.from || !b.to) return;

  loading.value = true;
  error.value = "";
  try {
    const params = new URLSearchParams({ fromA: a.from, toA: a.to, fromB: b.from, toB: b.to });
    const res = await apiFetch(`/api/orders/report?${params}`);
    if (!res.ok) {
      error.value =
        res.status === 403 ? "Je hebt geen toegang tot deze pagina." : `Kon de gegevens niet laden (${res.status}).`;
      data.value = EMPTY;
      return;
    }
    data.value = (await res.json()) as Report;
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
    if (!isLoading) fetchReport();
  },
  { immediate: true },
);

// ─── Derived ──────────────────────────────────────────────────────────────────
/** % change between two totals, normalized per day so unequal period lengths stay fair. */
function ratePct(qtyA: number, daysA: number, qtyB: number, daysB: number): number | null {
  const rateA = qtyA / Math.max(daysA, 1);
  const rateB = qtyB / Math.max(daysB, 1);
  if (rateA === 0) return rateB > 0 ? null : 0;
  return ((rateB - rateA) / rateA) * 100;
}

const quantityRatePct = computed(() =>
  ratePct(
    data.value.periodA.totalQuantity,
    data.value.periodA.days,
    data.value.periodB.totalQuantity,
    data.value.periodB.days,
  ),
);
const spendRatePct = computed(() =>
  ratePct(
    data.value.periodA.totalSpend,
    data.value.periodA.days,
    data.value.periodB.totalSpend,
    data.value.periodB.days,
  ),
);

function trendSub(pct: number | null): { text: string; tone: string } {
  if (pct === null) return { text: "nieuw t.o.v. periode A", tone: "text-amber-600 dark:text-amber-400" };
  const arrow = pct > 0 ? "▲" : pct < 0 ? "▼" : "—";
  const tone =
    pct > 5
      ? "text-red-600 dark:text-red-400"
      : pct < -5
        ? "text-green-600 dark:text-green-400"
        : "text-muted-foreground";
  return { text: `${arrow} ${Math.abs(pct).toFixed(1)}% per dag t.o.v. A`, tone };
}

const statCards = computed(() => {
  const qtyTrend = trendSub(quantityRatePct.value);
  const spendTrend = trendSub(spendRatePct.value);
  return [
    {
      label: "Besteld (B)",
      value: String(data.value.periodB.totalQuantity),
      icon: Package,
      tone: "",
      sub: qtyTrend.text,
      subTone: qtyTrend.tone,
    },
    {
      label: "Uitgaven (B)",
      value: formatEuro(data.value.periodB.totalSpend),
      icon: Euro,
      tone: "",
      sub: spendTrend.text,
      subTone: spendTrend.tone,
    },
    {
      label: "Bestellingen (B)",
      value: String(data.value.periodB.orderCount),
      icon: ClipboardList,
      tone: "",
      sub: `${data.value.periodA.orderCount} in periode A`,
      subTone: "text-muted-foreground",
    },
    {
      label: "Sterke toenames",
      value: String(data.value.overOrdered.length),
      icon: AlertTriangle,
      tone: data.value.overOrdered.length > 0 ? "text-amber-600 dark:text-amber-400" : "",
      sub: data.value.overOrdered.length > 0 ? "producten om te checken" : "niets opvallends",
      subTone: "text-muted-foreground",
    },
  ];
});

function bySupplier(rows: ProductRow[]): ProductRow[] {
  return supplierFilter.value ? rows.filter((p) => p.supplierId === supplierFilter.value) : rows;
}

const filteredOverOrdered = computed(() => bySupplier(data.value.overOrdered));
const filteredUnderOrdered = computed(() => bySupplier(data.value.underOrdered));

const filteredProducts = computed(() => {
  const rows = bySupplier(data.value.products);
  if (!tableSearch.value) return rows;
  const q = tableSearch.value.toLowerCase();
  return rows.filter((p) => p.internalName.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q));
});

// ─── Visual bars ────────────────────────────────────────────────────────────────
const maxOverExtra = computed(() => Math.max(1, ...filteredOverOrdered.value.map((p) => p.extraQty)));
const maxUnderExtra = computed(() => Math.max(1, ...filteredUnderOrdered.value.map((p) => Math.abs(p.extraQty))));

/** Bar width as a %, with a visible floor so small-but-real values don't vanish. */
function barPct(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.min(100, Math.max(4, (value / max) * 100));
}

const comparisonMetrics = computed(() => {
  const a = data.value.periodA;
  const b = data.value.periodB;
  return [
    {
      label: "Aantal besteld",
      a: a.totalQuantity,
      b: b.totalQuantity,
      aLabel: String(a.totalQuantity),
      bLabel: String(b.totalQuantity),
    },
    {
      label: "Uitgaven",
      a: a.totalSpend,
      b: b.totalSpend,
      aLabel: formatEuro(a.totalSpend),
      bLabel: formatEuro(b.totalSpend),
    },
    {
      label: "Bestellingen",
      a: a.orderCount,
      b: b.orderCount,
      aLabel: String(a.orderCount),
      bLabel: String(b.orderCount),
    },
  ].map((m) => ({ ...m, max: Math.max(m.a, m.b, 1) }));
});

/** Bar height in px for the A/B chart, floored so a zero value still shows a sliver. */
function chartBarHeight(value: number, max: number): number {
  return Math.max(4, (value / max) * 96);
}

// ─── PDF export ───────────────────────────────────────────────────────────────
// The browser's own print pipeline: the tailwind print rules isolate
// #print-report and force a light, color-preserving palette. "Save as PDF" in
// the print destination picker is what actually produces the file.
function exportPdf() {
  window.print();
}

function statusLabel(status: Status): string {
  switch (status) {
    case "new":
      return "Nieuw";
    case "stopped":
      return "Gestopt";
    case "increased":
      return "Toename";
    case "decreased":
      return "Afname";
    default:
      return "Stabiel";
  }
}

function statusStyle(status: Status): string {
  switch (status) {
    case "new":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "stopped":
      return "bg-muted text-muted-foreground";
    case "increased":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "decreased":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function formatEuro(n: number): string {
  return `€ ${(n ?? 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function formatRangeLabel(range: { from: string; to: string }): string {
  if (!range.from || !range.to) return "";
  return `${formatDate(range.from)} — ${formatDate(range.to)}`;
}
</script>
