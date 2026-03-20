<template>
  <div class="flex flex-col gap-8 max-w-2xl">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">Settings</h1>
      <p class="text-muted-foreground text-sm">Manage application settings and data.</p>
    </div>

    <!-- Appearance section -->
    <div class="rounded-lg border">
      <div class="flex flex-col gap-1 border-b px-6 py-4">
        <h2 class="font-semibold">Appearance</h2>
        <p class="text-sm text-muted-foreground">Customize how the application looks.</p>
      </div>
      <div class="px-6 py-5">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium">Dark mode</p>
            <p class="text-xs text-muted-foreground">Switch between light and dark theme.</p>
          </div>
          <Button variant="outline" size="icon" @click="toggleTheme" :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
            <Sun v-if="isDark" class="size-4" />
            <Moon v-else class="size-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Import section -->
    <div class="rounded-lg border">
      <div class="flex flex-col gap-1 border-b px-6 py-4">
        <h2 class="font-semibold">Import suppliers data</h2>
        <p class="text-sm text-muted-foreground">
          Upload a JSON file to populate suppliers and their products.
          <span class="font-medium text-destructive">This will overwrite all existing supplier data.</span>
        </p>
      </div>
      <div class="flex flex-col gap-4 px-6 py-5">
        <!-- File input -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">JSON file</label>
          <div
            class="relative flex cursor-pointer items-center gap-3 rounded-md border-2 border-dashed px-4 py-5 transition-colors"
            :class="
              parsedData
                ? 'border-primary/50 bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            "
            @click="fileInput?.click()"
            @dragover.prevent
            @drop.prevent="onDrop"
          >
            <FileJson class="size-8 shrink-0 text-muted-foreground" />
            <div class="min-w-0">
              <p v-if="fileName" class="truncate text-sm font-medium">{{ fileName }}</p>
              <p v-else class="text-sm text-muted-foreground">Click or drag a JSON file here</p>
              <p v-if="parseError" class="mt-0.5 text-xs text-destructive">{{ parseError }}</p>
              <p v-else-if="parsedData" class="mt-0.5 text-xs text-muted-foreground">
                {{ parsedData.suppliers.length }} supplier{{ parsedData.suppliers.length !== 1 ? "s" : "" }},
                {{ parsedData.totalProducts }} product{{ parsedData.totalProducts !== 1 ? "s" : "" }} found
              </p>
            </div>
            <input ref="fileInput" type="file" accept=".json,application/json" class="sr-only" @change="onFileChange" />
          </div>
        </div>

        <!-- Preview table -->
        <div v-if="parsedData && parsedData.suppliers.length" class="rounded-md border overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-muted/50">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-muted-foreground">Supplier</th>
                <th class="px-3 py-2 text-left font-medium text-muted-foreground">Email</th>
                <th class="px-3 py-2 text-right font-medium text-muted-foreground">Products</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              <tr v-for="(s, i) in parsedData.suppliers.slice(0, 10)" :key="i">
                <td class="px-3 py-2 font-medium">{{ s.name }}</td>
                <td class="px-3 py-2 text-muted-foreground">{{ s.email || "—" }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ s.productCount }}</td>
              </tr>
              <tr v-if="parsedData.suppliers.length > 10">
                <td colspan="3" class="px-3 py-2 text-center text-xs text-muted-foreground">
                  + {{ parsedData.suppliers.length - 10 }} more suppliers
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex justify-end">
          <Button :disabled="!parsedData || importing" @click="confirmOpen = true">
            <Upload class="mr-2 size-4" />
            Import
          </Button>
        </div>

        <!-- Success message -->
        <div
          v-if="importSuccess"
          class="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300"
        >
          <CheckCircle class="size-4 shrink-0" />
          Imported <strong>{{ importSuccess.suppliers }}</strong> supplier{{
            importSuccess.suppliers !== 1 ? "s" : ""
          }}
          and <strong>{{ importSuccess.products }}</strong> product{{
            importSuccess.products !== 1 ? "s" : ""
          }}
          successfully.
        </div>
      </div>
    </div>
  </div>

  <!-- Confirm overwrite dialog -->
  <Dialog v-model:open="confirmOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Overwrite supplier data?</DialogTitle>
        <DialogDescription>
          This will permanently delete
          <span class="font-medium text-foreground">all existing suppliers and products</span>
          and replace them with the data from your file. This cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <div v-if="parsedData" class="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span class="font-medium text-foreground">{{ parsedData.suppliers.length }}</span> supplier{{
          parsedData.suppliers.length !== 1 ? "s" : ""
        }}
        and <span class="font-medium text-foreground">{{ parsedData.totalProducts }}</span> product{{
          parsedData.totalProducts !== 1 ? "s" : ""
        }}
        will be imported.
      </div>
      <DialogFooter class="mt-2">
        <Button variant="outline" :disabled="importing" @click="confirmOpen = false">Cancel</Button>
        <Button variant="destructive" :disabled="importing" @click="runImport">
          <Loader2 v-if="importing" class="mr-2 size-4 animate-spin" />
          Yes, overwrite
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { FileJson, Upload, Loader2, CheckCircle, Sun, Moon } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/useTheme";

const { isDark, toggleTheme } = useTheme();
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/apiFetch";

interface ParsedData {
  suppliers: Array<{ name: string; email: string; productCount: number }>;
  totalProducts: number;
  raw: object;
}

const fileInput = ref<HTMLInputElement | null>(null);
const fileName = ref("");
const parseError = ref("");
const parsedData = ref<ParsedData | null>(null);
const confirmOpen = ref(false);
const importing = ref(false);
const importSuccess = ref<{ suppliers: number; products: number } | null>(null);

function parseFile(text: string, name: string) {
  fileName.value = name;
  parseError.value = "";
  parsedData.value = null;
  importSuccess.value = null;

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    parseError.value = "Invalid JSON — could not parse the file.";
    return;
  }

  // Accept root array, { suppliers: [...] }, or { data: [...] }
  const obj = json as Record<string, unknown>;
  const list: unknown[] = Array.isArray(json)
    ? json
    : Array.isArray(obj?.suppliers)
      ? (obj.suppliers as unknown[])
      : Array.isArray(obj?.data)
        ? (obj.data as unknown[])
        : [];

  if (list.length === 0) {
    parseError.value = "No suppliers found. Expected an array, { suppliers: [...] }, or { data: [...] }.";
    return;
  }

  const suppliers = list.map((s: unknown) => {
    const obj = s as Record<string, unknown>;
    const products = Array.isArray(obj.products) ? obj.products : [];
    return {
      name: String(obj.name ?? ""),
      email: String(obj.email ?? ""),
      productCount: products.length,
    };
  });

  parsedData.value = {
    suppliers,
    totalProducts: suppliers.reduce((sum, s) => sum + s.productCount, 0),
    raw: Array.isArray(json) ? { suppliers: list } : (json as object),
  };
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => parseFile(reader.result as string, file.name);
  reader.readAsText(file);
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => parseFile(reader.result as string, file.name);
  reader.readAsText(file);
}

async function runImport() {
  if (!parsedData.value) return;
  importing.value = true;
  try {
    const res = await apiFetch("/api/suppliers/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsedData.value.raw),
    });

    if (!res.ok) {
      const err = await res.json();
      parseError.value = err.message ?? "Import failed.";
      confirmOpen.value = false;
      return;
    }

    const result = await res.json();
    confirmOpen.value = false;
    // Reset form
    fileName.value = "";
    parsedData.value = null;
    parseError.value = "";
    if (fileInput.value) fileInput.value.value = "";
    importSuccess.value = { suppliers: result.suppliersCreated, products: result.productsCreated };
  } finally {
    importing.value = false;
  }
}
</script>
