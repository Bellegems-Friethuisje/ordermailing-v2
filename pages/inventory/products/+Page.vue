<template>
  <TopLoader :loading="loading">
    <div class="flex flex-col gap-6">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
        <a href="/inventory" class="hover:text-foreground">Inventarisatie</a>
        <span>/</span>
        <span class="font-medium text-foreground">Overige producten</span>
      </div>

      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Overige producten</h1>
          <p class="max-w-2xl text-sm text-muted-foreground">
            Alles wat je telt maar niet via de app bestelt: verpakking, schoonmaak, gas, olie, drank van de
            cash-and-carry, materiaal. Deze producten verschijnen nooit in een bestelling.
          </p>
        </div>
        <Button @click="openAdd">
          <Plus class="mr-2 size-4" />
          Product toevoegen
        </Button>
      </div>

      <!-- Toolbar -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative flex-1 sm:max-w-xs">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Product zoeken…" class="pl-9" />
        </div>
        <div class="flex items-center gap-2">
          <Switch v-model="showInactive" />
          <span class="cursor-pointer text-sm text-muted-foreground" @click="showInactive = !showInactive">
            Inactieve tonen
          </span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && products.length === 0" class="rounded-lg border border-dashed p-12 text-center">
        <Boxes class="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p class="font-medium text-muted-foreground">Nog geen overige producten</p>
        <p class="mt-1 text-sm text-muted-foreground">Voeg bijvoorbeeld "Frietzakken groot" toe.</p>
        <Button class="mt-4" @click="openAdd">
          <Plus class="mr-2 size-4" />
          Product toevoegen
        </Button>
      </div>

      <!-- Grouped by category -->
      <div v-for="group in groups" :key="group.category" class="overflow-hidden rounded-lg border">
        <div class="flex items-center justify-between bg-muted/50 px-4 py-3">
          <span class="font-semibold">{{ group.category }}</span>
          <span class="text-sm text-muted-foreground">
            {{ group.products.length }} product{{ group.products.length !== 1 ? "en" : "" }}
          </span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="border-b bg-background">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-muted-foreground">Naam</th>
                <th class="hidden px-4 py-2 text-left font-medium text-muted-foreground sm:table-cell">Herkomst</th>
                <th class="w-32 px-4 py-2 text-right font-medium text-muted-foreground">Prijs</th>
                <th class="w-24 px-4 py-2 text-center font-medium text-muted-foreground">Actief</th>
                <th class="w-24 px-4 py-2" />
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr
                v-for="product in group.products"
                :key="product.id"
                class="transition-colors hover:bg-muted/30"
                :class="{ 'opacity-60': !product.isActive }"
              >
                <td class="px-4 py-2 font-medium">{{ product.name }}</td>
                <td class="hidden px-4 py-2 text-muted-foreground sm:table-cell">{{ product.supplierLabel || "—" }}</td>
                <td class="px-4 py-2 text-right tabular-nums">
                  <span v-if="product.price > 0">
                    {{ formatCurrency(product.price)
                    }}<span class="text-xs text-muted-foreground">/{{ product.priceUnit }}</span>
                  </span>
                  <span v-else class="text-amber-600 dark:text-amber-400">—</span>
                </td>
                <td class="px-4 py-2 text-center">
                  <Switch
                    :model-value="product.isActive"
                    @update:model-value="(v: boolean) => toggleActive(product, v)"
                  />
                </td>
                <td class="px-4 py-2 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" @click="openEdit(product)">
                      <Pencil class="size-4 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" @click="confirmDelete(product)">
                      <Trash2 class="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div
        v-if="!loading && products.length > 0 && groups.length === 0"
        class="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground"
      >
        Geen producten gevonden.
      </div>
    </div>
  </TopLoader>

  <!-- Add / edit dialog -->
  <Dialog v-model:open="formOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ editing ? "Product aanpassen" : "Nieuw product" }}</DialogTitle>
        <DialogDescription>Een product dat je telt maar niet bestelt via de app.</DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-2 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <label class="text-sm font-medium">Naam</label>
          <Input v-model="form.name" placeholder="Frietzakken groot" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Categorie</label>
          <Input v-model="form.category" list="inventory-categories" placeholder="Verpakking" />
          <datalist id="inventory-categories">
            <option v-for="cat in knownCategories" :key="cat" :value="cat" />
          </datalist>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Herkomst</label>
          <Input v-model="form.supplierLabel" placeholder="Makro" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Prijs (€)</label>
          <Input v-model.number="form.price" type="number" min="0" step="0.01" placeholder="0.00" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Eenheid</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="unit in PRICE_UNITS"
              :key="unit"
              type="button"
              class="rounded-md border px-2.5 py-1 text-sm transition-colors"
              :class="
                form.priceUnit === unit
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted'
              "
              @click="form.priceUnit = unit"
            >
              {{ unit }}
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 sm:col-span-2">
          <Checkbox id="product-active" v-model="form.isActive" />
          <label for="product-active" class="cursor-pointer text-sm font-medium">Actief</label>
        </div>
      </div>
      <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
      <DialogFooter>
        <Button variant="outline" :disabled="saving" @click="formOpen = false">Annuleren</Button>
        <Button :disabled="saving" @click="save">
          <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
          {{ editing ? "Opslaan" : "Toevoegen" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete dialog -->
  <Dialog v-model:open="deleteOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Product verwijderen</DialogTitle>
        <DialogDescription>
          Wil je <strong>{{ deleteTarget?.name }}</strong> verwijderen? Dit kan niet ongedaan worden gemaakt.
        </DialogDescription>
      </DialogHeader>
      <p v-if="deleteError" class="text-sm text-destructive">{{ deleteError }}</p>
      <DialogFooter>
        <Button variant="outline" :disabled="deleting" @click="deleteOpen = false">Annuleren</Button>
        <Button variant="destructive" :disabled="deleting" @click="executeDelete">
          <Loader2 v-if="deleting" class="mr-2 size-4 animate-spin" />
          Verwijderen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { Plus, Pencil, Trash2, Loader2, Search, Boxes } from "lucide-vue-next";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

interface StandaloneProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  priceUnit: string;
  supplierLabel?: string;
  isActive: boolean;
  displayOrder: number;
}

const PRICE_UNITS = ["stuk", "kg", "doos", "pakket", "emmer", "liter", "rol", "meter"];
const SUGGESTED_CATEGORIES = ["Verpakking", "Schoonmaak", "Drank", "Gas & olie", "Materiaal", "Overige"];

const { loading: authLoading } = useAuth();
const loading = ref(true);
const products = ref<StandaloneProduct[]>([]);
const searchQuery = ref("");
const showInactive = ref(false);

const formOpen = ref(false);
const editing = ref<StandaloneProduct | null>(null);
const saving = ref(false);
const formError = ref("");
const form = reactive({
  name: "",
  category: "",
  price: 0,
  priceUnit: "stuk",
  supplierLabel: "",
  isActive: true,
});

const deleteOpen = ref(false);
const deleteTarget = ref<StandaloneProduct | null>(null);
const deleting = ref(false);
const deleteError = ref("");

watch(
  authLoading,
  (v) => {
    if (!v) fetchProducts();
  },
  { immediate: true },
);

async function fetchProducts() {
  loading.value = true;
  try {
    const res = await apiFetch("/api/inventory/products?includeInactive=true");
    products.value = await res.json();
  } catch {
    products.value = [];
  } finally {
    loading.value = false;
  }
}

const knownCategories = computed(() => {
  const seen = new Set([...products.value.map((p) => p.category).filter(Boolean), ...SUGGESTED_CATEGORIES]);
  return [...seen].sort((a, b) => a.localeCompare(b));
});

const groups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  const map = new Map<string, StandaloneProduct[]>();
  for (const product of products.value) {
    if (!showInactive.value && !product.isActive) continue;
    if (
      q &&
      !product.name.toLowerCase().includes(q) &&
      !(product.category ?? "").toLowerCase().includes(q) &&
      !(product.supplierLabel ?? "").toLowerCase().includes(q)
    ) {
      continue;
    }
    const category = product.category || "Overige";
    if (!map.has(category)) map.set(category, []);
    map.get(category)!.push(product);
  }
  return [...map.entries()]
    .map(([category, list]) => ({ category, products: list.sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.category.localeCompare(b.category));
});

function openAdd() {
  editing.value = null;
  form.name = "";
  form.category = "";
  form.price = 0;
  form.priceUnit = "stuk";
  form.supplierLabel = "";
  form.isActive = true;
  formError.value = "";
  formOpen.value = true;
}

function openEdit(product: StandaloneProduct) {
  editing.value = product;
  form.name = product.name;
  form.category = product.category ?? "";
  form.price = product.price ?? 0;
  form.priceUnit = product.priceUnit ?? "stuk";
  form.supplierLabel = product.supplierLabel ?? "";
  form.isActive = product.isActive;
  formError.value = "";
  formOpen.value = true;
}

async function save() {
  if (!form.name.trim()) {
    formError.value = "Naam is verplicht";
    return;
  }
  saving.value = true;
  formError.value = "";
  try {
    const target = editing.value;
    const res = await apiFetch(target ? `/api/inventory/products/${target.id}` : "/api/inventory/products", {
      method: target ? "PATCH" : "POST",
      body: JSON.stringify({ ...form }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      formError.value = (err as { message?: string }).message ?? `Opslaan mislukt (${res.status})`;
      return;
    }
    formOpen.value = false;
    await fetchProducts();
  } finally {
    saving.value = false;
  }
}

async function toggleActive(product: StandaloneProduct, isActive: boolean) {
  const previous = product.isActive;
  product.isActive = isActive;
  const res = await apiFetch(`/api/inventory/products/${product.id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) product.isActive = previous;
}

function confirmDelete(product: StandaloneProduct) {
  deleteTarget.value = product;
  deleteError.value = "";
  deleteOpen.value = true;
}

async function executeDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  deleteError.value = "";
  try {
    const res = await apiFetch(`/api/inventory/products/${deleteTarget.value.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      deleteError.value = (err as { message?: string }).message ?? `Verwijderen mislukt (${res.status})`;
      return;
    }
    deleteOpen.value = false;
    deleteTarget.value = null;
    await fetchProducts();
  } finally {
    deleting.value = false;
  }
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(val);
}
</script>
