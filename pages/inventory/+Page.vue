<template>
  <TopLoader :loading="loading">
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Inventarisatie</h1>
          <p class="text-sm text-muted-foreground">Beheer jaarlijkse inventarissen voor je producten.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" as-child>
            <a href="/inventory/products">
              <Boxes class="mr-2 size-4" />
              Overige producten
            </a>
          </Button>
          <Button variant="outline" as-child>
            <a href="/inventory/statistics">
              <BarChart3 class="mr-2 size-4" />
              Statistieken
            </a>
          </Button>
          <Button @click="openNew">
            <Plus class="mr-2 size-4" />
            Nieuwe telling
          </Button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && inventories.length === 0" class="rounded-lg border border-dashed p-12 text-center">
        <Package class="mx-auto mb-3 size-10 text-muted-foreground/40" />
        <p class="font-medium text-muted-foreground">Nog geen inventarissen</p>
        <p class="mt-1 text-sm text-muted-foreground">Start je eerste telling om te beginnen.</p>
        <Button class="mt-4" @click="openNew">
          <Plus class="mr-2 size-4" />
          Nieuwe telling
        </Button>
      </div>

      <!-- Mobile: card list -->
      <div v-else class="flex flex-col gap-3 md:hidden">
        <div v-for="inv in inventories" :key="inv.id" class="rounded-lg border bg-card p-4 shadow-sm">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="font-semibold">{{ inv.label }}</p>
              <p class="text-xs text-muted-foreground">{{ formatDate(inv.startedAt) }}</p>
            </div>
            <Badge :variant="inv.status === 'open' ? 'default' : 'secondary'">
              {{ inv.status === "open" ? "Open" : "Gesloten" }}
            </Badge>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div class="text-muted-foreground">
              Waarde: <span class="font-medium text-foreground">{{ formatCurrency(inv.totalValue) }}</span>
            </div>
            <div class="text-muted-foreground">
              Producten: <span class="font-medium text-foreground">{{ inv.countedProducts }}/{{ inv.totalItems }}</span>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <Button size="sm" as-child class="flex-1">
              <a :href="`/inventory/${inv.id}`">Bekijken</a>
            </Button>
            <Button size="sm" variant="outline" @click="toggleStatus(inv)">
              {{ inv.status === "open" ? "Sluiten" : "Heropenen" }}
            </Button>
            <Button size="icon" variant="ghost" @click="confirmDelete(inv)">
              <Trash2 class="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Desktop: table -->
      <Table class="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Boekjaar</TableHead>
            <TableHead>Omschrijving</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Geteld</TableHead>
            <TableHead>Totale waarde</TableHead>
            <TableHead>Aangemaakt</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!loading && inventories.length === 0">
            <TableCell colspan="7" class="py-8 text-center text-muted-foreground"> Nog geen inventarissen. </TableCell>
          </TableRow>
          <TableRow v-for="inv in inventories" :key="inv.id">
            <TableCell class="font-bold tabular-nums">{{ inv.year }}</TableCell>
            <TableCell class="font-medium">{{ inv.label }}</TableCell>
            <TableCell>
              <Badge :variant="inv.status === 'open' ? 'default' : 'secondary'">
                {{ inv.status === "open" ? "Open" : "Gesloten" }}
              </Badge>
            </TableCell>
            <TableCell class="tabular-nums text-muted-foreground">
              {{ inv.countedProducts }}/{{ inv.totalItems }}
            </TableCell>
            <TableCell class="tabular-nums font-medium">{{ formatCurrency(inv.totalValue) }}</TableCell>
            <TableCell class="text-muted-foreground">{{ formatDate(inv.startedAt) }}</TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <Button variant="ghost" size="sm" as-child>
                  <a :href="`/inventory/${inv.id}`">Bekijken</a>
                </Button>
                <Button variant="ghost" size="sm" @click="toggleStatus(inv)">
                  {{ inv.status === "open" ? "Sluiten" : "Heropenen" }}
                </Button>
                <Button variant="ghost" size="icon" @click="confirmDelete(inv)">
                  <Trash2 class="size-4 text-muted-foreground" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </TopLoader>

  <!-- New inventory dialog -->
  <Dialog v-model:open="newOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Nieuwe inventaris</DialogTitle>
        <DialogDescription>
          Kies het boekjaar. Alle actieve leverancierproducten en overige producten worden ingeladen.
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-4 py-2">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Boekjaar</label>
          <Input v-model.number="newYear" type="number" :min="2000" :max="2100" placeholder="2025" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Omschrijving</label>
          <Input v-model="newLabel" :placeholder="`Inventaris ${newYear}`" />
        </div>
        <p v-if="newError" class="text-sm text-destructive">{{ newError }}</p>
      </div>
      <DialogFooter>
        <Button variant="outline" :disabled="newSaving" @click="newOpen = false">Annuleren</Button>
        <Button :disabled="newSaving" @click="createInventory">
          <Loader2 v-if="newSaving" class="mr-2 size-4 animate-spin" />
          Aanmaken
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete confirm dialog -->
  <Dialog v-model:open="deleteOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Inventaris verwijderen</DialogTitle>
        <DialogDescription>
          Wil je <strong>{{ deleteTarget?.label }}</strong> permanent verwijderen? Dit kan niet ongedaan worden gemaakt.
        </DialogDescription>
      </DialogHeader>
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
import { ref, watch } from "vue";
import { Plus, Trash2, Loader2, Package, Boxes, BarChart3 } from "lucide-vue-next";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

interface InventorySummary {
  id: string;
  year: number;
  label: string;
  status: "open" | "closed";
  startedAt: string;
  closedAt: string | null;
  totalItems: number;
  countedProducts: number;
  totalValue: number;
}

const { loading: authLoading } = useAuth();
const loading = ref(true);
const inventories = ref<InventorySummary[]>([]);

const newOpen = ref(false);
const newYear = ref(new Date().getFullYear());
const newLabel = ref("");
const newSaving = ref(false);
const newError = ref("");

const deleteOpen = ref(false);
const deleteTarget = ref<InventorySummary | null>(null);
const deleting = ref(false);

watch(
  authLoading,
  (v) => {
    if (!v) fetchInventories();
  },
  { immediate: true },
);

async function fetchInventories() {
  loading.value = true;
  try {
    const res = await apiFetch("/api/inventory");
    inventories.value = await res.json();
  } catch {
    inventories.value = [];
  } finally {
    loading.value = false;
  }
}

function openNew() {
  newYear.value = new Date().getFullYear();
  newLabel.value = "";
  newError.value = "";
  newOpen.value = true;
}

async function createInventory() {
  if (!newYear.value) return;
  newSaving.value = true;
  newError.value = "";
  try {
    const res = await apiFetch("/api/inventory", {
      method: "POST",
      body: JSON.stringify({
        year: newYear.value,
        label: newLabel.value || `Inventaris ${newYear.value}`,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      newError.value = (err as { message?: string }).message ?? `Aanmaken mislukt (${res.status})`;
      return;
    }
    const created = await res.json();
    newOpen.value = false;
    window.location.href = `/inventory/${created.id}`;
  } finally {
    newSaving.value = false;
  }
}

async function toggleStatus(inv: InventorySummary) {
  const newStatus = inv.status === "open" ? "closed" : "open";
  await apiFetch(`/api/inventory/${inv.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: newStatus }),
  });
  inv.status = newStatus;
}

function confirmDelete(inv: InventorySummary) {
  deleteTarget.value = inv;
  deleteOpen.value = true;
}

async function executeDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await apiFetch(`/api/inventory/${deleteTarget.value.id}`, { method: "DELETE" });
    deleteOpen.value = false;
    deleteTarget.value = null;
    await fetchInventories();
  } finally {
    deleting.value = false;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(val);
}
</script>
