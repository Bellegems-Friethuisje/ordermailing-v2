<template>
  <TopLoader :loading="loading">
    <div class="flex flex-col gap-6">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <a href="/inventory" class="hover:text-foreground">Inventarisatie</a>
        <span>/</span>
        <span class="truncate font-medium text-foreground">{{ inventory?.label ?? "…" }}</span>
      </div>
      <!-- Page header -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-bold tracking-tight">{{ inventory?.label ?? "Laden…" }}</h1>
            <Badge v-if="inventory" :variant="isOpen ? 'default' : 'secondary'">
              {{ isOpen ? "Open" : "Gesloten" }}
            </Badge>
          </div>
          <p class="text-sm text-muted-foreground">
            {{ isOpen ? "Voer het aantal stuks in per product." : "Telling afgesloten." }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button v-if="isOpen" variant="outline" @click="openAddProduct">
            <Plus class="mr-2 size-4" />
            Product toevoegen
          </Button>
          <Button variant="outline" :disabled="statusSaving || loading" @click="toggleStatus">
            <Loader2 v-if="statusSaving" class="mr-2 size-4 animate-spin" />
            <Lock v-else-if="isOpen" class="mr-2 size-4" />
            <LockOpen v-else class="mr-2 size-4" />
            {{ isOpen ? "Afsluiten" : "Heropenen" }}
          </Button>
          <Button :disabled="saving || loading || !isOpen" @click="saveItems">
            <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
            <Save v-else class="mr-2 size-4" />
            Opslaan
          </Button>
        </div>
      </div>

      <!-- Summary bar -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg border bg-card p-4">
          <p class="mb-1 text-xs font-medium text-muted-foreground">Totale waarde</p>
          <p class="text-2xl font-bold tabular-nums text-primary">{{ formatCurrency(totalValue) }}</p>
        </div>
        <div class="rounded-lg border bg-card p-4">
          <p class="mb-1 text-xs font-medium text-muted-foreground">Producten geteld</p>
          <p class="text-2xl font-bold tabular-nums">
            {{ countedCount }}<span class="text-sm font-normal text-muted-foreground">/{{ items.length }}</span>
          </p>
        </div>
        <div class="rounded-lg border bg-card p-4">
          <p class="mb-1 text-xs font-medium text-muted-foreground">Leveranciers</p>
          <p class="text-2xl font-bold tabular-nums">{{ supplierGroups.length }}</p>
        </div>
        <div class="rounded-lg border bg-card p-4">
          <p class="mb-1 text-xs font-medium text-muted-foreground">Zonder prijs</p>
          <p
            class="text-2xl font-bold tabular-nums"
            :class="noPriceCount > 0 ? 'text-amber-600 dark:text-amber-400' : ''"
          >
            {{ noPriceCount }}
          </p>
        </div>
      </div>

      <!-- Search + filter -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative flex-1 sm:max-w-xs">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Product zoeken…" class="pl-9" />
        </div>
        <div class="flex flex-wrap gap-2">
          <Button size="sm" :variant="filterMode === 'all' ? 'default' : 'outline'" @click="filterMode = 'all'">
            Alles
          </Button>
          <Button size="sm" :variant="filterMode === 'counted' ? 'default' : 'outline'" @click="filterMode = 'counted'">
            Geteld
          </Button>
          <Button size="sm" :variant="filterMode === 'empty' ? 'default' : 'outline'" @click="filterMode = 'empty'">
            Leeg
          </Button>
          <Button size="sm" :variant="filterMode === 'noprice' ? 'default' : 'outline'" @click="filterMode = 'noprice'">
            Geen prijs
          </Button>
        </div>
      </div>

      <!-- Supplier groups -->
      <div
        v-for="group in filteredGroups"
        :key="group.key"
        class="flex flex-col gap-0 overflow-hidden rounded-lg border"
      >
        <!-- Group header -->
        <div
          class="flex cursor-pointer items-center justify-between bg-muted/50 px-4 py-3 transition-colors hover:bg-muted/70"
          @click="toggleGroup(group.key)"
        >
          <div class="flex items-center gap-3">
            <ChevronDown
              class="size-4 text-muted-foreground transition-transform duration-200"
              :class="{ '-rotate-90': collapsedGroups.has(group.key) }"
            />
            <span class="font-semibold">{{ group.supplierCompanyName }}</span>
            <span class="text-sm text-muted-foreground">
              {{ group.items.length }} product{{ group.items.length !== 1 ? "en" : "" }}
            </span>
          </div>
          <div class="flex items-center gap-4 text-sm">
            <span class="hidden text-muted-foreground sm:inline">
              {{ group.items.filter((i) => i.quantity > 0).length }}/{{ group.items.length }} geteld
            </span>
            <span class="font-medium tabular-nums">
              {{ formatCurrency(group.items.reduce((s, i) => s + i.quantity * i.priceAtCount, 0)) }}
            </span>
          </div>
        </div>

        <!-- Products table -->
        <div v-show="!collapsedGroups.has(group.key)" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b bg-background">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-muted-foreground">Ons naam</th>
                <th class="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">
                  {{ group.isStandalone ? "Categorie" : "Leveranciernaam" }}
                </th>
                <th class="w-28 px-4 py-2 text-right font-medium text-muted-foreground">Prijs</th>
                <th class="w-28 px-4 py-2 text-right font-medium text-muted-foreground">Aantal</th>
                <th class="hidden w-28 px-4 py-2 text-right font-medium text-muted-foreground sm:table-cell">Totaal</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="item in group.items"
                :key="itemKey(item)"
                class="transition-colors hover:bg-muted/30"
                :class="{ 'opacity-50': !matchesFilter(item) }"
              >
                <td class="px-4 py-2 font-medium">
                  <div class="flex items-center gap-2">
                    <span>{{ item.internalName }}</span>
                    <Badge v-if="item.source === 'standalone'" variant="secondary" class="shrink-0 font-normal">
                      Overig
                    </Badge>
                  </div>
                </td>
                <td class="hidden px-4 py-2 text-muted-foreground sm:table-cell">{{ item.supplierProductName }}</td>
                <td class="px-4 py-2 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <span v-if="item.priceAtCount > 0" class="tabular-nums text-muted-foreground">
                      {{ formatCurrency(item.priceAtCount)
                      }}<span class="text-xs">/{{ item.priceUnit ?? "stuk" }}</span>
                    </span>
                    <button
                      v-if="isOpen"
                      class="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      :title="item.priceAtCount > 0 ? 'Prijs aanpassen' : 'Prijs instellen'"
                      @click="openPriceEdit(item)"
                    >
                      <Pencil class="size-3" />
                    </button>
                    <span v-if="item.priceAtCount === 0" class="text-xs text-amber-600 dark:text-amber-400">—</span>
                  </div>
                </td>
                <td class="px-2 py-1 text-right">
                  <!-- Mobile: stepper -->
                  <div class="flex items-center justify-end gap-1 sm:hidden">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      class="h-8 w-8 shrink-0"
                      :disabled="!isOpen || item.quantity <= 0"
                      @click="item.quantity = Math.max(0, item.quantity - 1)"
                    >
                      <Minus class="size-3" />
                    </Button>
                    <span class="w-8 text-center text-sm font-medium tabular-nums">{{ item.quantity }}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      class="h-8 w-8 shrink-0"
                      :disabled="!isOpen"
                      @click="item.quantity++"
                    >
                      <Plus class="size-3" />
                    </Button>
                  </div>
                  <!-- Desktop: number input -->
                  <Input
                    v-model.number="item.quantity"
                    type="number"
                    min="0"
                    step="1"
                    class="hidden h-8 w-24 text-right tabular-nums sm:block"
                    :disabled="!isOpen"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                </td>
                <td class="hidden px-4 py-2 text-right font-medium tabular-nums sm:table-cell">
                  {{
                    item.quantity > 0 && item.priceAtCount > 0 ? formatCurrency(item.quantity * item.priceAtCount) : "—"
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-if="!loading && filteredGroups.length === 0"
        class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
      >
        Geen producten gevonden.
      </div>

      <!-- Save bar at bottom -->
      <div v-if="isOpen" class="sticky bottom-4 flex justify-end">
        <div class="flex items-center gap-3 rounded-xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
          <div class="flex items-center gap-1.5 text-xs">
            <Loader2 v-if="saveStatus === 'saving'" class="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            <CloudOff v-else-if="saveStatus === 'offline'" class="size-3.5 shrink-0 text-amber-500" />
            <Cloud v-else-if="saveStatus === 'saved'" class="size-3.5 shrink-0 text-green-500" />
            <span v-if="saveStatus === 'saving'" class="text-muted-foreground">Opslaan…</span>
            <span v-else-if="saveStatus === 'offline'" class="text-amber-500">Offline</span>
            <span v-else-if="saveStatus === 'saved'" class="text-green-500">Opgeslagen</span>
            <span v-else class="text-sm text-muted-foreground">
              Totaal: <strong class="text-foreground">{{ formatCurrency(totalValue) }}</strong>
            </span>
          </div>
          <Button :disabled="saving" @click="saveItems">
            <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
            <Save v-else class="mr-2 size-4" />
            Opslaan
          </Button>
        </div>
      </div>
    </div>
  </TopLoader>

  <!-- Edit price dialog -->
  <Dialog v-model:open="priceEditOpen">
    <DialogContent class="sm:max-w-xs">
      <DialogHeader>
        <DialogTitle>Prijs aanpassen</DialogTitle>
        <DialogDescription>{{ priceEditItem?.internalName }}</DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-3 py-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Eenheid</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="unit in PRICE_UNITS"
              :key="unit"
              type="button"
              class="rounded-md border px-2.5 py-1 text-sm transition-colors"
              :class="
                priceEditUnit === unit
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              "
              @click="priceEditUnit = unit"
            >
              {{ unit }}
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Prijs per {{ priceEditUnit }} (€)</label>
          <Input v-model.number="priceEditValue" type="number" min="0" step="0.01" placeholder="0.00" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="priceEditOpen = false">Annuleren</Button>
        <Button @click="applyPriceEdit">Opslaan</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Add product to a running count -->
  <Dialog v-model:open="addOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Product toevoegen</DialogTitle>
        <DialogDescription>
          Voeg een overig product toe aan deze telling. Reeds ingevulde aantallen blijven staan.
        </DialogDescription>
      </DialogHeader>

      <!-- Pick from the catalogue -->
      <div v-if="!creatingNew" class="flex flex-col gap-3 py-2">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="addSearch" placeholder="Zoeken…" class="pl-9" />
        </div>
        <div class="max-h-64 overflow-y-auto rounded-md border">
          <p v-if="addCandidates.length === 0" class="px-3 py-6 text-center text-sm text-muted-foreground">
            {{ catalogue.length === 0 ? "Nog geen overige producten." : "Alles staat al in deze telling." }}
          </p>
          <label
            v-for="product in addCandidates"
            :key="product.id"
            class="flex cursor-pointer items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
          >
            <Checkbox
              :model-value="addSelection.has(product.id)"
              @update:model-value="(v: boolean) => toggleSelection(product.id, v)"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ product.name }}</span>
              <span class="block truncate text-xs text-muted-foreground">{{ product.category }}</span>
            </span>
            <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
              {{ product.price > 0 ? `${formatCurrency(product.price)}/${product.priceUnit}` : "geen prijs" }}
            </span>
          </label>
        </div>
        <Button variant="outline" size="sm" @click="startCreateNew">
          <Plus class="mr-2 size-4" />
          Nieuw product aanmaken
        </Button>
      </div>

      <!-- Create one inline -->
      <div v-else class="grid gap-3 py-2 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <label class="text-sm font-medium">Naam</label>
          <Input v-model="newProduct.name" placeholder="Frietzakken groot" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Categorie</label>
          <Input v-model="newProduct.category" placeholder="Verpakking" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Prijs (€)</label>
          <Input v-model.number="newProduct.price" type="number" min="0" step="0.01" placeholder="0.00" />
        </div>
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <label class="text-sm font-medium">Eenheid</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="unit in PRICE_UNITS"
              :key="unit"
              type="button"
              class="rounded-md border px-2.5 py-1 text-sm transition-colors"
              :class="
                newProduct.priceUnit === unit
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              "
              @click="newProduct.priceUnit = unit"
            >
              {{ unit }}
            </button>
          </div>
        </div>
        <Button variant="ghost" size="sm" class="justify-start sm:col-span-2" @click="creatingNew = false">
          <ChevronDown class="mr-2 size-4 rotate-90" />
          Terug naar de lijst
        </Button>
      </div>

      <p v-if="addError" class="text-sm text-destructive">{{ addError }}</p>
      <DialogFooter>
        <Button variant="outline" :disabled="adding" @click="addOpen = false">Annuleren</Button>
        <Button
          :disabled="adding || (creatingNew ? !newProduct.name.trim() : addSelection.size === 0)"
          @click="addProducts"
        >
          <Loader2 v-if="adding" class="mr-2 size-4 animate-spin" />
          Toevoegen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";
import { usePageContext } from "vike-vue/usePageContext";
import {
  Search,
  Loader2,
  Lock,
  LockOpen,
  Save,
  Pencil,
  ChevronDown,
  Cloud,
  CloudOff,
  Minus,
  Plus,
} from "lucide-vue-next";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";
import { useAuth } from "@/lib/useAuth";

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
  priceUnit: string;
  totalValue: number;
}

interface InventoryDoc {
  id: string;
  year: number;
  label: string;
  status: "open" | "closed";
  startedAt: string;
  closedAt?: string;
  items: InventoryItem[];
}

interface StandaloneProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  priceUnit: string;
}

interface SupplierGroup {
  key: string;
  supplierCompanyName: string;
  isStandalone: boolean;
  items: InventoryItem[];
}

const STANDALONE_KEY = "__standalone__";
const PRICE_UNITS = ["stuk", "kg", "doos", "pakket", "emmer", "liter", "rol", "meter"];

const pageContext = usePageContext();
const inventoryId = computed(() => (pageContext.routeParams as Record<string, string>)?.id);

const { loading: authLoading } = useAuth();
const loading = ref(true);
const saveStatus = ref<"idle" | "saving" | "saved" | "offline">("idle");
const saving = computed(() => saveStatus.value === "saving");
const statusSaving = ref(false);
const loaded = ref(false);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let savedTimer: ReturnType<typeof setTimeout> | null = null;

const inventory = ref<InventoryDoc | null>(null);
const items = ref<InventoryItem[]>([]);
const isOpen = computed(() => inventory.value?.status === "open");

const searchQuery = ref("");
const filterMode = ref<"all" | "counted" | "empty" | "noprice">("all");
const collapsedGroups = ref(new Set<string>());

const priceEditOpen = ref(false);
const priceEditItem = ref<InventoryItem | null>(null);
const priceEditValue = ref(0);
const priceEditUnit = ref("stuk");

const addOpen = ref(false);
const adding = ref(false);
const addError = ref("");
const addSearch = ref("");
const addSelection = ref(new Set<string>());
const catalogue = ref<StandaloneProduct[]>([]);
const creatingNew = ref(false);
const newProduct = reactive({ name: "", category: "", price: 0, priceUnit: "stuk" });

watch(
  authLoading,
  (v) => {
    if (!v) fetchInventory();
  },
  { immediate: true },
);

async function fetchInventory() {
  loading.value = true;
  loaded.value = false;
  try {
    const res = await apiFetch(`/api/inventory/${inventoryId.value}`);
    const data = (await res.json()) as InventoryDoc;
    inventory.value = data;
    items.value = (data.items ?? []).map((i) => ({ ...i }));
  } catch {
    inventory.value = null;
  } finally {
    loading.value = false;
    loaded.value = true;
  }
}

// ─── Computed ─────────────────────────────────────────────────────────────────
const totalValue = computed(() => items.value.reduce((s, i) => s + i.quantity * i.priceAtCount, 0));
const countedCount = computed(() => items.value.filter((i) => i.quantity > 0).length);
const noPriceCount = computed(() => items.value.filter((i) => i.priceAtCount === 0).length);

function itemKey(item: InventoryItem): string {
  return `${item.source ?? "supplier"}:${item.productId}`;
}

function groupKey(item: InventoryItem): string {
  return item.source === "standalone" ? STANDALONE_KEY : (item.supplierId ?? "");
}

const supplierGroups = computed<SupplierGroup[]>(() => {
  const map = new Map<string, SupplierGroup>();
  for (const item of items.value) {
    const key = groupKey(item);
    if (!map.has(key)) {
      map.set(key, {
        key,
        supplierCompanyName: item.supplierCompanyName,
        isStandalone: key === STANDALONE_KEY,
        items: [],
      });
    }
    map.get(key)!.items.push(item);
  }
  // Non-orderable products always sit below the supplier groups.
  return [...map.values()].sort((a, b) => {
    if (a.isStandalone !== b.isStandalone) return a.isStandalone ? 1 : -1;
    return a.supplierCompanyName.localeCompare(b.supplierCompanyName);
  });
});

function matchesFilter(item: InventoryItem): boolean {
  if (filterMode.value === "counted") return item.quantity > 0;
  if (filterMode.value === "empty") return item.quantity === 0;
  if (filterMode.value === "noprice") return item.priceAtCount === 0;
  return true;
}

function matchesSearch(item: InventoryItem): boolean {
  if (!searchQuery.value) return true;
  const q = searchQuery.value.toLowerCase();
  return item.internalName.toLowerCase().includes(q) || item.supplierProductName.toLowerCase().includes(q);
}

const filteredGroups = computed<SupplierGroup[]>(() => {
  return supplierGroups.value
    .map((group) => ({
      ...group,
      items: group.items.filter((i) => matchesSearch(i) && (filterMode.value === "all" || matchesFilter(i))),
    }))
    .filter((g) => g.items.length > 0);
});

// ─── Actions ──────────────────────────────────────────────────────────────────
function toggleGroup(key: string) {
  if (collapsedGroups.value.has(key)) {
    collapsedGroups.value.delete(key);
  } else {
    collapsedGroups.value.add(key);
  }
}

async function saveItems() {
  if (saveStatus.value === "saving") return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  saveStatus.value = "saving";
  try {
    await apiFetch(`/api/inventory/${inventoryId.value}/items`, {
      method: "PUT",
      body: JSON.stringify({ items: items.value }),
    });
    saveStatus.value = "saved";
    if (savedTimer) clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      saveStatus.value = "idle";
    }, 3000);
  } catch {
    saveStatus.value = navigator.onLine ? "idle" : "offline";
  }
}

function scheduleAutoSave() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    saveItems();
  }, 2_000);
}

watch(
  items,
  () => {
    if (!loaded.value || !isOpen.value) return;
    scheduleAutoSave();
  },
  { deep: true },
);

onMounted(() => {
  window.addEventListener("online", () => {
    if (saveStatus.value === "offline") saveItems();
  });
  window.addEventListener("offline", () => {
    if (saveStatus.value !== "idle") saveStatus.value = "offline";
  });
});

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (savedTimer) clearTimeout(savedTimer);
});

async function toggleStatus() {
  if (!inventory.value) return;
  statusSaving.value = true;
  try {
    // Save while it is still open — a closed count refuses item writes.
    if (isOpen.value) await saveItems();
    const newStatus = isOpen.value ? "closed" : "open";
    await apiFetch(`/api/inventory/${inventoryId.value}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    inventory.value.status = newStatus;
  } finally {
    statusSaving.value = false;
  }
}

function openPriceEdit(item: InventoryItem) {
  priceEditItem.value = item;
  priceEditValue.value = item.priceAtCount;
  priceEditUnit.value = item.priceUnit ?? "stuk";
  priceEditOpen.value = true;
}

function applyPriceEdit() {
  if (!priceEditItem.value) return;
  priceEditItem.value.priceAtCount = priceEditValue.value ?? 0;
  priceEditItem.value.priceUnit = priceEditUnit.value;
  priceEditOpen.value = false;
}

// ─── Adding products mid-count ────────────────────────────────────────────────
async function openAddProduct() {
  addError.value = "";
  addSearch.value = "";
  addSelection.value = new Set();
  creatingNew.value = false;
  newProduct.name = "";
  newProduct.category = "";
  newProduct.price = 0;
  newProduct.priceUnit = "stuk";
  addOpen.value = true;
  try {
    const res = await apiFetch("/api/inventory/products");
    catalogue.value = await res.json();
  } catch {
    catalogue.value = [];
  }
}

const presentStandaloneIds = computed(
  () => new Set(items.value.filter((i) => i.source === "standalone").map((i) => i.productId)),
);

const addCandidates = computed(() => {
  const q = addSearch.value.trim().toLowerCase();
  return catalogue.value.filter(
    (p) =>
      !presentStandaloneIds.value.has(p.id) &&
      (!q || p.name.toLowerCase().includes(q) || (p.category ?? "").toLowerCase().includes(q)),
  );
});

function toggleSelection(id: string, selected: boolean) {
  const next = new Set(addSelection.value);
  if (selected) next.add(id);
  else next.delete(id);
  addSelection.value = next;
}

function startCreateNew() {
  addError.value = "";
  newProduct.name = addSearch.value.trim();
  creatingNew.value = true;
}

async function addProducts() {
  adding.value = true;
  addError.value = "";
  try {
    const productIds = [...addSelection.value];

    if (creatingNew.value) {
      if (!newProduct.name.trim()) return;
      const res = await apiFetch("/api/inventory/products", {
        method: "POST",
        body: JSON.stringify({ ...newProduct }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addError.value = (err as { message?: string }).message ?? `Aanmaken mislukt (${res.status})`;
        return;
      }
      productIds.push((await res.json()).id);
    }

    if (productIds.length === 0) return;

    // Flush pending edits first: /items/add rewrites items[] from what is stored.
    await saveItems();

    const res = await apiFetch(`/api/inventory/${inventoryId.value}/items/add`, {
      method: "POST",
      body: JSON.stringify({ items: productIds.map((productId) => ({ source: "standalone", productId })) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      addError.value = (err as { message?: string }).message ?? `Toevoegen mislukt (${res.status})`;
      return;
    }

    const { items: updated } = (await res.json()) as { items: InventoryItem[] };
    items.value = updated.map((i) => ({ ...i }));
    addOpen.value = false;
  } finally {
    adding.value = false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(val: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(val);
}
</script>
