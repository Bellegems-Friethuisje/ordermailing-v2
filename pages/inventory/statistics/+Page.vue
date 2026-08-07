<template>
  <TopLoader :loading="loading">
    <div class="flex flex-col gap-6">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <a href="/inventory" class="hover:text-foreground">Inventarisatie</a>
        <span>/</span>
        <span class="font-medium text-foreground">Statistieken</span>
      </div>

      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Inventaris Statistieken</h1>
          <p class="text-sm text-muted-foreground">Overzicht en analyse van je jaarlijkse inventarissen.</p>
        </div>
        <div v-if="inventories.length > 1" class="flex items-center gap-2">
          <label class="text-sm font-medium">Jaar:</label>
          <select
            v-model="selectedId"
            class="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option v-for="inv in inventories" :key="inv.id" :value="inv.id">{{ inv.label }}</option>
          </select>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && inventories.length === 0" class="rounded-lg border border-dashed py-16 text-center">
        <BarChart3 class="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p class="font-medium text-muted-foreground">Nog geen inventarissen</p>
        <p class="mt-1 text-sm text-muted-foreground">Start een telling om statistieken te bekijken.</p>
        <Button class="mt-4" as-child>
          <a href="/inventory">Naar inventarisatie</a>
        </Button>
      </div>

      <template v-if="selected">
        <!-- KPI cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-lg border bg-card p-4">
            <div class="mb-2 flex items-center gap-1.5 text-muted-foreground">
              <Euro class="size-3.5" />
              <span class="text-xs font-medium">Totale waarde</span>
            </div>
            <p class="text-2xl font-bold tabular-nums text-primary">{{ formatCurrency(totalValue) }}</p>
            <p
              v-if="yoyChange !== null"
              class="mt-1 text-xs"
              :class="yoyChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ yoyChange >= 0 ? "▲" : "▼" }} {{ Math.abs(yoyChange).toFixed(1) }}% t.o.v. vorig jaar
            </p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="mb-2 flex items-center gap-1.5 text-muted-foreground">
              <Package class="size-3.5" />
              <span class="text-xs font-medium">Producten geteld</span>
            </div>
            <p class="text-2xl font-bold tabular-nums">{{ countedCount }}</p>
            <p class="mt-1 text-xs text-muted-foreground">
              van {{ totalCount }} ({{ Math.round((countedCount / Math.max(totalCount, 1)) * 100) }}%)
            </p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="mb-2 flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp class="size-3.5" />
              <span class="text-xs font-medium">Gem. waarde/product</span>
            </div>
            <p class="text-2xl font-bold tabular-nums">
              {{ countedCount > 0 ? formatCurrency(totalValue / countedCount) : "—" }}
            </p>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="mb-2 flex items-center gap-1.5 text-muted-foreground">
              <AlertCircle class="size-3.5" />
              <span class="text-xs font-medium">Zonder prijs</span>
            </div>
            <p
              class="text-2xl font-bold tabular-nums"
              :class="noPriceCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''"
            >
              {{ noPriceCount }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">producten missen een prijs</p>
          </div>
        </div>

        <!-- Supplier vs overige split -->
        <div class="rounded-lg border bg-card p-5">
          <p class="text-sm font-semibold">Verdeling van de waarde</p>
          <p class="mb-4 text-xs text-muted-foreground">Leverancierproducten tegenover overige producten</p>
          <div class="flex h-3 overflow-hidden rounded-full bg-muted">
            <div
              class="bg-primary transition-all"
              :style="{ width: `${sharePercent(sourceSplit.supplier.amount)}%` }"
              :title="`Leverancierproducten: ${formatCurrency(sourceSplit.supplier.amount)}`"
            />
            <div
              class="bg-amber-500 transition-all"
              :style="{ width: `${sharePercent(sourceSplit.standalone.amount)}%` }"
              :title="`Overige: ${formatCurrency(sourceSplit.standalone.amount)}`"
            />
          </div>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <div class="flex items-start gap-2">
              <span class="mt-1 size-3 shrink-0 rounded-full bg-primary" />
              <div>
                <p class="text-sm font-medium">Leverancierproducten</p>
                <p class="text-lg font-bold tabular-nums">{{ formatCurrency(sourceSplit.supplier.amount) }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ sharePercent(sourceSplit.supplier.amount).toFixed(1) }}% · {{ sourceSplit.supplier.counted }} van
                  {{ sourceSplit.supplier.total }} geteld
                </p>
              </div>
            </div>
            <div class="flex items-start gap-2">
              <span class="mt-1 size-3 shrink-0 rounded-full bg-amber-500" />
              <div>
                <p class="text-sm font-medium">Overige</p>
                <p class="text-lg font-bold tabular-nums">{{ formatCurrency(sourceSplit.standalone.amount) }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ sharePercent(sourceSplit.standalone.amount).toFixed(1) }}% ·
                  {{ sourceSplit.standalone.counted }} van {{ sourceSplit.standalone.total }} geteld
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Year trend chart -->
        <div v-if="inventories.length > 1" class="rounded-lg border bg-card p-5">
          <p class="text-sm font-semibold">Inventariswaarde per jaar</p>
          <p class="mb-5 text-xs text-muted-foreground">Vergelijking over de jaren heen</p>
          <div class="flex h-40 items-end gap-3">
            <div
              v-for="inv in inventories.slice().reverse()"
              :key="inv.id"
              class="group flex flex-1 flex-col items-center gap-2"
            >
              <span
                class="text-[10px] font-medium tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                {{ formatCurrency(inv.totalValue) }}
              </span>
              <div
                class="w-full rounded-t transition-all"
                :class="inv.id === selectedId ? 'bg-primary' : 'bg-primary/40 hover:bg-primary/60'"
                :style="{ height: `${Math.max(6, (inv.totalValue / maxYearValue) * 128)}px` }"
                :title="`${inv.label}: ${formatCurrency(inv.totalValue)}`"
              />
              <span
                class="text-[10px] font-medium"
                :class="inv.id === selectedId ? 'text-foreground' : 'text-muted-foreground'"
              >
                {{ inv.year }}
              </span>
            </div>
          </div>
        </div>

        <!-- Two columns: top products + by supplier -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <!-- Top products by value -->
          <div class="rounded-lg border bg-card">
            <div class="border-b p-4">
              <p class="font-semibold">Top producten (waarde)</p>
              <p class="text-xs text-muted-foreground">Hoogste inventariswaarde</p>
            </div>
            <div class="divide-y">
              <div
                v-for="(item, i) in topProducts"
                :key="itemKey(item)"
                class="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <span class="w-4 shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{{ i + 1 }}</span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ item.internalName }}</p>
                    <p class="truncate text-xs text-muted-foreground">{{ item.supplierCompanyName }}</p>
                  </div>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold tabular-nums">{{ formatCurrency(item.totalValue) }}</p>
                  <p class="text-xs tabular-nums text-muted-foreground">
                    {{ item.quantity }} × {{ formatCurrency(item.priceAtCount) }}
                  </p>
                </div>
              </div>
              <div v-if="topProducts.length === 0" class="px-4 py-6 text-center text-sm text-muted-foreground">
                Geen producten geteld.
              </div>
            </div>
          </div>

          <!-- By supplier -->
          <div class="rounded-lg border bg-card">
            <div class="border-b p-4">
              <p class="font-semibold">Per leverancier</p>
              <p class="text-xs text-muted-foreground">Inventariswaarde per leverancier</p>
            </div>
            <div class="divide-y">
              <div
                v-for="group in bySupplier"
                :key="group.key"
                class="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">{{ group.supplierCompanyName }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ group.items.length }} product{{ group.items.length !== 1 ? "en" : "" }}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-sm font-semibold tabular-nums">{{ formatCurrency(group.totalValue) }}</p>
                  <div class="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="group.isStandalone ? 'bg-amber-500' : 'bg-primary'"
                      :style="{ width: `${(group.totalValue / Math.max(totalValue, 1)) * 100}%` }"
                    />
                  </div>
                </div>
              </div>
              <div v-if="bySupplier.length === 0" class="px-4 py-6 text-center text-sm text-muted-foreground">
                Geen leveranciers gevonden.
              </div>
            </div>
          </div>
        </div>

        <!-- Products needing attention -->
        <div
          v-if="noPriceItems.length > 0"
          class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20"
        >
          <div class="mb-3 flex items-center gap-2">
            <AlertCircle class="size-4 text-amber-600 dark:text-amber-400" />
            <p class="text-sm font-semibold text-amber-900 dark:text-amber-300">
              Producten zonder prijs ({{ noPriceItems.length }})
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="item in noPriceItems.slice(0, 20)"
              :key="itemKey(item)"
              class="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-800/50 dark:bg-amber-950/40"
            >
              {{ item.internalName }}
            </span>
            <span
              v-if="noPriceItems.length > 20"
              class="rounded-md border border-amber-200 bg-white px-2 py-1 text-xs dark:border-amber-800/50 dark:bg-amber-950/40"
            >
              +{{ noPriceItems.length - 20 }} meer
            </span>
          </div>
          <p class="mt-3 text-xs text-amber-700 dark:text-amber-400">
            Stel prijzen in via <a href="/suppliers" class="underline">Leveranciers</a> of
            <a href="/inventory/products" class="underline">Overige producten</a>.
          </p>
        </div>

        <!-- Full product table -->
        <div class="rounded-lg border">
          <div class="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="font-semibold">Alle producten</p>
            <div class="relative w-full sm:w-56">
              <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input v-model="tableSearch" placeholder="Zoeken…" class="h-8 pl-9 text-sm" />
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="border-b bg-muted/30">
                <tr>
                  <th class="px-4 py-2 text-left font-medium text-muted-foreground">Product</th>
                  <th class="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
                    Leverancier
                  </th>
                  <th class="px-4 py-2 text-right font-medium text-muted-foreground">Prijs</th>
                  <th class="px-4 py-2 text-right font-medium text-muted-foreground">Aantal</th>
                  <th class="px-4 py-2 text-right font-medium text-muted-foreground">Waarde</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="item in filteredTableItems" :key="itemKey(item)" class="hover:bg-muted/30">
                  <td class="px-4 py-2 font-medium">
                    <div class="flex items-center gap-2">
                      <span>{{ item.internalName }}</span>
                      <Badge v-if="item.source === 'standalone'" variant="secondary" class="shrink-0 font-normal">
                        Overig
                      </Badge>
                    </div>
                  </td>
                  <td class="hidden px-4 py-2 text-muted-foreground sm:table-cell">{{ item.supplierCompanyName }}</td>
                  <td class="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {{ item.priceAtCount > 0 ? formatCurrency(item.priceAtCount) : "—" }}
                  </td>
                  <td class="px-4 py-2 text-right tabular-nums">{{ item.quantity }}</td>
                  <td class="px-4 py-2 text-right font-medium tabular-nums">
                    {{ item.totalValue > 0 ? formatCurrency(item.totalValue) : "—" }}
                  </td>
                </tr>
                <tr v-if="filteredTableItems.length === 0">
                  <td colspan="5" class="px-4 py-8 text-center text-muted-foreground">Geen producten gevonden.</td>
                </tr>
              </tbody>
              <tfoot class="border-t bg-muted/30">
                <tr>
                  <td colspan="3" class="px-4 py-2 text-sm font-semibold">Totaal</td>
                  <td class="px-4 py-2 text-right text-sm font-semibold tabular-nums">
                    {{ filteredTableItems.reduce((s, i) => s + i.quantity, 0) }}
                  </td>
                  <td class="px-4 py-2 text-right text-sm font-semibold tabular-nums">
                    {{ formatCurrency(filteredTableItems.reduce((s, i) => s + i.totalValue, 0)) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </template>
    </div>
  </TopLoader>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Package, BarChart3, TrendingUp, AlertCircle, Euro, Search } from "lucide-vue-next";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/lib/useAuth";

interface InventorySummary {
  id: string;
  year: number;
  label: string;
  status: "open" | "closed";
  startedAt: string;
  totalItems: number;
  countedProducts: number;
  totalValue: number;
}

interface InventoryItem {
  // Absent on counts made before non-orderable products existed.
  source?: "supplier" | "standalone";
  productId: string;
  supplierId: string | null;
  supplierCompanyName: string;
  internalName: string;
  supplierProductName: string;
  quantity: number;
  priceAtCount: number;
  totalValue: number;
}

interface InventoryDoc extends InventorySummary {
  items: InventoryItem[];
}

interface SupplierGroup {
  key: string;
  supplierCompanyName: string;
  isStandalone: boolean;
  items: InventoryItem[];
  totalValue: number;
}

const STANDALONE_KEY = "__standalone__";

const { loading: authLoading } = useAuth();
const loading = ref(true);

const inventories = ref<InventorySummary[]>([]);
const selectedId = ref<string>("");
const detailCache = ref<Map<string, InventoryDoc>>(new Map());
const tableSearch = ref("");

watch(
  authLoading,
  (v) => {
    if (!v) fetchAll();
  },
  { immediate: true },
);

async function fetchAll() {
  loading.value = true;
  try {
    const res = await apiFetch("/api/inventory");
    const list = (await res.json()) as InventorySummary[];
    inventories.value = list;
    if (list.length > 0) {
      selectedId.value = list[0].id;
      await fetchDetail(list[0].id);
    }
  } finally {
    loading.value = false;
  }
}

async function fetchDetail(id: string) {
  if (detailCache.value.has(id)) return;
  const res = await apiFetch(`/api/inventory/${id}`);
  const doc = (await res.json()) as InventoryDoc;
  detailCache.value.set(id, doc);
}

watch(selectedId, async (id) => {
  if (id) await fetchDetail(id);
});

function itemKey(item: InventoryItem): string {
  return `${item.source ?? "supplier"}:${item.productId}`;
}

function groupKey(item: InventoryItem): string {
  return item.source === "standalone" ? STANDALONE_KEY : (item.supplierId ?? "");
}

const selected = computed<InventoryDoc | null>(() => detailCache.value.get(selectedId.value) ?? null);
const selectedItems = computed<InventoryItem[]>(() => selected.value?.items ?? []);

const totalValue = computed(() => selectedItems.value.reduce((s, i) => s + (i.totalValue ?? 0), 0));
const totalCount = computed(() => selectedItems.value.length);
const countedCount = computed(() => selectedItems.value.filter((i) => i.quantity > 0).length);
const noPriceCount = computed(() => selectedItems.value.filter((i) => i.priceAtCount === 0).length);
const noPriceItems = computed(() => selectedItems.value.filter((i) => i.priceAtCount === 0));

// How much of the inventory sits in things you can order versus everything else
// — verpakking, schoonmaak, drank, materiaal.
const sourceSplit = computed(() => {
  const empty = () => ({ amount: 0, total: 0, counted: 0 });
  const split = { supplier: empty(), standalone: empty() };
  for (const item of selectedItems.value) {
    const bucket = item.source === "standalone" ? split.standalone : split.supplier;
    bucket.amount += item.totalValue ?? 0;
    bucket.total += 1;
    if (item.quantity > 0) bucket.counted += 1;
  }
  return split;
});

function sharePercent(value: number): number {
  return totalValue.value > 0 ? (value / totalValue.value) * 100 : 0;
}

const topProducts = computed(() =>
  [...selectedItems.value]
    .filter((i) => i.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 10),
);

const bySupplier = computed<SupplierGroup[]>(() => {
  const map = new Map<string, SupplierGroup>();
  for (const item of selectedItems.value) {
    const key = groupKey(item);
    if (!map.has(key)) {
      map.set(key, {
        key,
        supplierCompanyName: item.supplierCompanyName,
        isStandalone: key === STANDALONE_KEY,
        items: [],
        totalValue: 0,
      });
    }
    const g = map.get(key)!;
    g.items.push(item);
    g.totalValue += item.totalValue ?? 0;
  }
  return [...map.values()].sort((a, b) => b.totalValue - a.totalValue);
});

const maxYearValue = computed(() => Math.max(1, ...inventories.value.map((i) => i.totalValue)));

const yoyChange = computed<number | null>(() => {
  const idx = inventories.value.findIndex((i) => i.id === selectedId.value);
  if (idx < 0 || idx >= inventories.value.length - 1) return null;
  const prev = inventories.value[idx + 1].totalValue;
  const curr = inventories.value[idx].totalValue;
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
});

const filteredTableItems = computed(() => {
  if (!tableSearch.value) return selectedItems.value;
  const q = tableSearch.value.toLowerCase();
  return selectedItems.value.filter(
    (i) => i.internalName.toLowerCase().includes(q) || i.supplierCompanyName.toLowerCase().includes(q),
  );
});

function formatCurrency(val: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(val);
}
</script>
