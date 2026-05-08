<template>
  <TopLoader :loading="loading">
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Reservaties</h1>
          <p class="text-sm text-muted-foreground">Beheer tafelreservaties van de website.</p>
        </div>
        <div class="flex items-center gap-2">
          <Button @click="createOpen = true">
            <PlusCircle class="mr-2 size-4" />
            Nieuwe reservatie
          </Button>
        </div>
      </div>

      <!-- Navigation & Date Controls -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" @click="selectedDate = formatDateKey(new Date())" :class="{ 'bg-primary text-primary-foreground': isToday }">
            Vandaag
          </Button>
          <Button variant="outline" size="sm" @click="selectedDate = formatDateKey(new Date(Date.now() + 86400000))" :class="{ 'bg-primary text-primary-foreground': isTomorrow }">
            Morgen
          </Button>
          <div class="flex items-center gap-1 ml-2">
            <Button variant="outline" size="icon" class="size-9" @click="adjustDate(-1)">
              <ChevronLeft class="size-4" />
            </Button>
            <input
              type="date"
              v-model="selectedDate"
              class="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button variant="outline" size="icon" class="size-9" @click="adjustDate(1)">
              <ChevronRight class="size-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" @click="selectedDate = ''" v-if="selectedDate" title="Toon alle datums">
            Wis
          </Button>
        </div>
      </div>

      <!-- Controls -->
      <div class="flex flex-wrap items-center gap-4">
        <div class="relative flex-1 min-w-50">
          <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Zoek op naam of email..."
            class="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <!-- Stats Summary -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card class="p-4 flex flex-col items-center justify-center">
          <span class="text-xs text-muted-foreground uppercase font-bold">Totaal Vandaag</span>
          <span class="text-2xl font-bold">{{ todayStats.count }}</span>
          <span class="text-xs text-muted-foreground">{{ todayStats.persons }} personen</span>
        </Card>
        <Card class="p-4 flex flex-col items-center justify-center">
          <span class="text-xs text-muted-foreground uppercase font-bold">Totaal Morgen</span>
          <span class="text-2xl font-bold">{{ tomorrowStats.count }}</span>
          <span class="text-xs text-muted-foreground">{{ tomorrowStats.persons }} personen</span>
        </Card>
        <Card class="p-4 flex flex-col items-center justify-center">
          <span class="text-xs text-muted-foreground uppercase font-bold">Geselecteerde Dag</span>
          <span class="text-2xl font-bold">{{ filteredStats.count }}</span>
          <span class="text-xs text-muted-foreground">{{ filteredStats.persons }} personen</span>
        </Card>
      </div>

      <!-- Desktop table -->
      <div class="rounded-lg border overflow-hidden bg-card shadow-sm">
        <div v-if="!loading && filteredReservations.length === 0" class="py-16 text-center text-sm text-muted-foreground">
          Geen reservaties gevonden voor deze criteria.
        </div>
        <table v-else class="w-full text-sm">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-muted-foreground">Naam</th>
              <th class="px-4 py-3 text-left font-medium text-muted-foreground">Datum & Tijd</th>
              <th class="px-4 py-3 text-left font-medium text-muted-foreground">Personen</th>
              <th class="px-4 py-3 text-left font-medium text-muted-foreground">Contact</th>
              <th class="px-4 py-3 text-left font-medium text-muted-foreground">Notities</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="res in filteredReservations" :key="res.id" class="hover:bg-muted/30 transition-colors">
              <td class="px-4 py-3 font-medium">
                <div class="flex flex-col">
                  <span>{{ res.name }}</span>
                  <span class="text-xs text-muted-foreground">{{ formatDateRelative(res.date) }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-muted-foreground">
                <div class="flex flex-col">
                  <span class="font-semibold text-foreground">{{ formatTime(res.date) }}</span>
                  <span>{{ formatDateShort(res.date) }}</span>
                </div>
              </td>
              <td class="px-4 py-3 font-semibold text-lg">{{ res.quantity }}</td>
              <td class="px-4 py-3 text-muted-foreground">
                <div class="flex items-center gap-2">
                  <a v-if="res.email" :href="'mailto:' + res.email" class="hover:text-primary">
                    <Mail class="size-4" />
                  </a>
                  <span class="truncate max-w-30">{{ res.email || '—' }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-muted-foreground max-w-xs truncate" :title="res.notes">
                {{ res.notes || '—' }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" @click="openEdit(res)">
                    <Pencil class="size-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" @click="confirmDelete(res)">
                    <Trash2 class="size-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </TopLoader>

  <!-- Create Reservation Dialog -->
  <Dialog v-model:open="createOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Nieuwe reservatie</DialogTitle>
        <DialogDescription>Voeg handmatig een nieuwe tafelreservatie toe.</DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <label for="new-name" class="text-sm font-medium">Naam</label>
          <Input id="new-name" v-model="newReservation.name" placeholder="Naam klant" />
        </div>
        <div class="grid gap-2">
          <label for="new-date" class="text-sm font-medium">Datum & Tijd</label>
          <Input id="new-date" type="datetime-local" v-model="newReservation.date" />
        </div>
        <div class="grid gap-2">
          <label for="new-quantity" class="text-sm font-medium">Aantal personen</label>
          <Input id="new-quantity" type="number" v-model="newReservation.quantity" :min="1" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="createOpen = false">Annuleren</Button>
        <Button :disabled="creating || !isValidNew" @click="doCreate">
          <Loader2 v-if="creating" class="mr-2 size-4 animate-spin" />
          Toevoegen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Edit Reservation Dialog -->
  <Dialog v-model:open="editOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Reservatie bewerken</DialogTitle>
        <DialogDescription>Pas de gegevens van deze reservatie aan.</DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div class="grid gap-2">
          <label for="edit-name" class="text-sm font-medium">Naam</label>
          <Input id="edit-name" v-model="editReservation.name" placeholder="Naam klant" />
        </div>
        <div class="grid gap-2">
          <label for="edit-email" class="text-sm font-medium">Email</label>
          <Input id="edit-email" v-model="editReservation.email" type="email" placeholder="naam@example.com" />
        </div>
        <div class="grid gap-2">
          <label for="edit-date" class="text-sm font-medium">Datum & Tijd</label>
          <Input id="edit-date" type="datetime-local" v-model="editReservation.date" />
        </div>
        <div class="grid gap-2">
          <label for="edit-quantity" class="text-sm font-medium">Aantal personen</label>
          <Input id="edit-quantity" type="number" v-model="editReservation.quantity" :min="1" />
        </div>
        <div class="grid gap-2">
          <label for="edit-notes" class="text-sm font-medium">Notities</label>
          <textarea
            id="edit-notes"
            v-model="editReservation.notes"
            rows="4"
            class="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Extra info of opmerkingen"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="editOpen = false">Annuleren</Button>
        <Button :disabled="editing || !isValidEdit" @click="doEdit">
          <Loader2 v-if="editing" class="mr-2 size-4 animate-spin" />
          Opslaan
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete confirm Dialog -->
  <Dialog v-model:open="deleteOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Reservatie verwijderen?</DialogTitle>
        <DialogDescription>
          Weet je zeker dat je de reservatie van <strong>{{ deleteTarget?.name }}</strong> wilt verwijderen?
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2">
        <Button variant="outline" @click="deleteOpen = false">Annuleren</Button>
        <Button variant="destructive" :disabled="deleting" @click="doDelete">
          <Loader2 v-if="deleting" class="mr-2 size-4 animate-spin" />
          Verwijderen
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { Trash2, Loader2, Search, Mail, Pencil, ChevronLeft, ChevronRight, PlusCircle } from "lucide-vue-next";
import TopLoader from "@/components/ui/top-loader/TopLoader.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

interface Reservation {
  id: string;
  name: string;
  email: string;
  date: string;
  quantity: number;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
}

interface ReservationForm {
  id: string;
  name: string;
  email: string;
  date: string;
  quantity: number;
  notes: string;
}

const { loading: authLoading } = useAuth();
const loading = ref(true);
const allReservations = ref<Reservation[]>([]);

// ─── Create State ────────────────────────────────────────────────────────────
const createOpen = ref(false);
const creating = ref(false);
const newReservation = ref({
  name: "",
  date: "",
  quantity: 10,
});

const isValidNew = computed(() => {
  return newReservation.value.name && newReservation.value.date && newReservation.value.quantity >= 1;
});

async function doCreate() {
  if (!isValidNew.value) return;
  creating.value = true;
  try {
    const res = await apiFetch("/api/reservations", {
      method: "POST",
      body: JSON.stringify(newReservation.value),
    });
    const created = await res.json();
    allReservations.value.push(created);
    createOpen.value = false;
    // Reset form
    newReservation.value = { name: "", date: "", quantity: 10 };
  } catch (err) {
    console.error("Failed to create reservation:", err);
  } finally {
    creating.value = false;
  }
}

// ─── Filters State ───────────────────────────────────────────────────────────
const searchQuery = ref("");
const selectedDate = ref(formatDateKey(new Date()));
const editOpen = ref(false);
const editing = ref(false);
const editReservation = ref<ReservationForm>({
  id: "",
  name: "",
  email: "",
  date: "",
  quantity: 1,
  notes: "",
});

// ─── Computed ────────────────────────────────────────────────────────────────
const isToday = computed(() => selectedDate.value === formatDateKey(new Date()));
const isTomorrow = computed(() => selectedDate.value === formatDateKey(new Date(Date.now() + 86400000)));

const filteredReservations = computed(() => {
  return allReservations.value.filter(res => {
    // Date filter
    if (selectedDate.value) {
      if (!res.date.startsWith(selectedDate.value)) return false;
    }
    
    // Search filter
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      const matchName = res.name?.toLowerCase().includes(q);
      const matchEmail = res.email?.toLowerCase().includes(q);
      if (!matchName && !matchEmail) return false;
    }
    
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date)); // Sort by time within the day
});

const todayStats = computed(() => calculateStats(formatDateKey(new Date())));
const tomorrowStats = computed(() => calculateStats(formatDateKey(new Date(Date.now() + 86400000))));
const filteredStats = computed(() => {
  const count = filteredReservations.value.length;
  const persons = filteredReservations.value.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  return { count, persons };
});

const isValidEdit = computed(() => {
  return !!editReservation.value.name && !!editReservation.value.date && editReservation.value.quantity >= 1;
});

function calculateStats(dateKey: string) {
  const dayRes = allReservations.value.filter(r => r.date.startsWith(dateKey));
  return {
    count: dayRes.length,
    persons: dayRes.reduce((acc, curr) => acc + (curr.quantity || 0), 0)
  };
}

function adjustDate(days: number) {
  const current = selectedDate.value ? new Date(selectedDate.value) : new Date();
  current.setDate(current.getDate() + days);
  selectedDate.value = formatDateKey(current);
}

async function fetchReservations() {
  loading.value = true;
  try {
    const res = await apiFetch("/api/reservations");
    allReservations.value = (await res.json()) as Reservation[];
  } catch (err) {
    console.error("Failed to fetch reservations:", err);
  } finally {
    loading.value = false;
  }
}

function openEdit(reservation: Reservation) {
  editReservation.value = {
    id: reservation.id,
    name: reservation.name,
    email: reservation.email || "",
    date: toDateTimeLocalValue(reservation.date),
    quantity: reservation.quantity,
    notes: reservation.notes || "",
  };
  editOpen.value = true;
}

async function doEdit() {
  if (!isValidEdit.value) return;
  editing.value = true;
  try {
    const payload = {
      name: editReservation.value.name,
      email: editReservation.value.email,
      date: new Date(editReservation.value.date).toISOString(),
      quantity: editReservation.value.quantity,
      notes: editReservation.value.notes,
    };

    const res = await apiFetch(`/api/reservations/${editReservation.value.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to update reservation: ${res.status}`);
    }

    const updated = (await res.json()) as Reservation;
    allReservations.value = allReservations.value.map((reservation) =>
      reservation.id === updated.id ? { ...reservation, ...updated } : reservation,
    );
    editOpen.value = false;
  } catch (err) {
    console.error("Failed to update reservation:", err);
  } finally {
    editing.value = false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function toDateTimeLocalValue(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function formatTime(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function formatDateRelative(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return "Vandaag";
  if (days === 1) return "Morgen";
  if (days === -1) return "Gisteren";
  if (days > 1 && days < 7) return d.toLocaleDateString("nl-NL", { weekday: "long" });
  return "";
}

const deleteOpen = ref(false);
const deleteTarget = ref<Reservation | null>(null);
const deleting = ref(false);

function confirmDelete(res: Reservation) {
  deleteTarget.value = res;
  deleteOpen.value = true;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await apiFetch(`/api/reservations/${deleteTarget.value.id}`, { method: "DELETE" });
    allReservations.value = allReservations.value.filter((r) => r.id !== deleteTarget.value.id);
    deleteOpen.value = false;
  } catch (err) {
    console.error("Failed to delete reservation:", err);
  } finally {
    deleting.value = false;
  }
}

watch(authLoading, (val) => {
  if (!val) fetchReservations();
}, { immediate: true });
</script>
