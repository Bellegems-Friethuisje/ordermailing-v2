<template>
  <div class="flex h-full flex-col gap-4">
    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" as-child class="shrink-0">
        <a href="/video"><ChevronLeft class="size-4" /></a>
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-xl font-bold tracking-tight">{{ project?.name ?? "Loading…" }}</h1>
        <p class="text-xs text-muted-foreground">
          {{ project?.screens.length ?? 0 }} screen{{ (project?.screens.length ?? 0) !== 1 ? "s" : "" }}
        </p>
      </div>
      <Button :disabled="!project || project.screens.length === 0" @click="exportOpen = true">
        <Download class="mr-2 size-4" />
        Export
      </Button>
    </div>

    <!-- ── Main: screens | canvas | properties ────────────────────────────── -->
    <div v-if="!project" class="flex flex-1 items-center justify-center text-muted-foreground">
      <p class="text-sm opacity-50">Project not found.</p>
    </div>

    <div v-else class="flex min-h-0 flex-1 gap-4 overflow-x-auto">
      <!-- Left: screen list -->
      <div class="flex w-44 shrink-0 flex-col gap-2 overflow-y-auto">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screens</p>

        <draggable
          v-model="project.screens"
          item-key="id"
          handle=".drag-handle"
          class="flex flex-col gap-2"
          @end="save"
        >
          <template #item="{ element: screen }">
            <div
              class="relative cursor-pointer select-none rounded-lg border bg-card p-2 transition-all"
              :class="
                selectedId === screen.id
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border hover:border-muted-foreground/40'
              "
              @click="selectedId = screen.id"
            >
              <div class="drag-handle absolute right-1.5 top-1.5 z-10 cursor-grab active:cursor-grabbing">
                <GripVertical class="size-3 text-muted-foreground/50" />
              </div>
              <div
                class="mb-1.5 w-full overflow-hidden rounded bg-black"
                :style="`aspect-ratio: ${screen.resolution.width}/${screen.resolution.height}`"
              >
                <img
                  v-if="screen.image"
                  :src="screen.image"
                  :class="['h-full w-full', screen.fit === 'cover' ? 'object-cover' : 'object-contain']"
                  :style="
                    screen.fit === 'cover'
                      ? `object-position: ${(screen.offsetX ?? 0) / 2 + 50}% ${(screen.offsetY ?? 0) / 2 + 50}%`
                      : undefined
                  "
                />
                <div v-else class="flex h-full w-full items-center justify-center">
                  <ImageIcon class="size-4 text-muted-foreground/30" />
                </div>
              </div>
              <p class="truncate pr-4 text-xs font-medium">{{ screen.name }}</p>
              <div class="mt-0.5 flex items-center justify-between">
                <span class="text-xs text-muted-foreground">{{ screen.duration }}s</span>
                <button
                  class="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  @click.stop="removeScreen(screen.id)"
                >
                  <X class="size-3" />
                </button>
              </div>
            </div>
          </template>
        </draggable>

        <Button variant="outline" size="sm" class="mt-1 w-full" @click="addScreen">
          <Plus class="mr-1.5 size-3.5" />
          Add screen
        </Button>
      </div>

      <!-- Center: canvas drop zone -->
      <div
        class="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors"
        :class="dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 bg-muted/20'"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop"
      >
        <template v-if="selectedScreen">
          <canvas
            ref="canvasEl"
            :width="selectedScreen.resolution.width"
            :height="selectedScreen.resolution.height"
            class="max-h-full max-w-full rounded shadow-xl"
            style="background: #000"
          />
          <div
            v-if="!selectedScreen.image"
            class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"
          >
            <ImageIcon class="size-10 opacity-20" />
            <p class="text-sm font-medium opacity-40">Drop an image here</p>
          </div>
        </template>
        <div v-else class="flex flex-col items-center gap-3 text-muted-foreground">
          <Film class="size-12 opacity-20" />
          <p class="text-sm opacity-40">Add a screen to get started</p>
        </div>
        <Transition name="fade">
          <div
            v-if="dragOver && selectedScreen"
            class="pointer-events-none absolute inset-0 flex items-center justify-center bg-primary/10"
          >
            <p class="text-sm font-semibold text-primary">Drop to set image</p>
          </div>
        </Transition>
      </div>

      <!-- Right: properties -->
      <div v-if="selectedScreen" class="flex w-52 shrink-0 flex-col gap-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Properties</p>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium">Name</label>
          <input
            v-model="selectedScreen.name"
            class="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            @change="save"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium">Duration (seconds)</label>
          <input
            v-model.number="selectedScreen.duration"
            type="number"
            min="0.1"
            step="0.5"
            class="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            @change="save"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium">Resolution</label>
          <select
            :value="resKey(selectedScreen.resolution)"
            class="flex h-8 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            @change="onResolutionChange"
          >
            <option v-for="r in RESOLUTIONS" :key="r.label" :value="r.label">{{ r.label }}</option>
          </select>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium">Image</label>
          <Button variant="outline" size="sm" class="w-full" @click="pickImage">
            <Upload class="mr-1.5 size-3.5" />
            {{ selectedScreen.image ? "Replace" : "Choose image" }}
          </Button>
          <Button
            v-if="selectedScreen.image"
            variant="ghost"
            size="sm"
            class="w-full text-muted-foreground"
            @click="clearImage"
          >
            <X class="mr-1.5 size-3.5" />Remove image
          </Button>
        </div>

        <div v-if="selectedScreen.image" class="flex flex-col gap-1.5">
          <label class="text-xs font-medium">Image fit</label>
          <div class="grid grid-cols-2 gap-1">
            <button
              :class="[
                'rounded-md border px-2 py-1 text-xs transition-colors',
                (selectedScreen.fit ?? 'contain') === 'contain'
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-input text-muted-foreground hover:border-muted-foreground/40',
              ]"
              @click="setFit('contain')"
            >
              Contain
            </button>
            <button
              :class="[
                'rounded-md border px-2 py-1 text-xs transition-colors',
                selectedScreen.fit === 'cover'
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-input text-muted-foreground hover:border-muted-foreground/40',
              ]"
              @click="setFit('cover')"
            >
              Cover
            </button>
          </div>
        </div>

        <div v-if="selectedScreen.image && selectedScreen.fit === 'cover'" class="flex flex-col gap-2">
          <label class="text-xs font-medium">Position</label>
          <div class="flex flex-col gap-2">
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>X</span><span>{{ selectedScreen.offsetX ?? 0 }}</span>
              </div>
              <input
                type="range"
                :value="selectedScreen.offsetX ?? 0"
                min="-100"
                max="100"
                step="1"
                class="w-full accent-primary"
                @input="(e) => onOffsetChange('x', +(e.target as HTMLInputElement).value)"
              />
            </div>
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between text-xs text-muted-foreground">
                <span>Y</span><span>{{ selectedScreen.offsetY ?? 0 }}</span>
              </div>
              <input
                type="range"
                :value="selectedScreen.offsetY ?? 0"
                min="-100"
                max="100"
                step="1"
                class="w-full accent-primary"
                @input="(e) => onOffsetChange('y', +(e.target as HTMLInputElement).value)"
              />
            </div>
            <Button variant="ghost" size="sm" class="w-full text-xs text-muted-foreground" @click="resetOffset"
              >Reset position</Button
            >
          </div>
        </div>

        <div class="mt-auto border-t pt-3">
          <p class="text-xs text-muted-foreground">
            Cycle: <span class="font-medium text-foreground">{{ totalCycleDuration.toFixed(1) }}s</span>
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">
            {{ project.screens.length }} screen{{ project.screens.length !== 1 ? "s" : "" }}
          </p>
        </div>
      </div>
    </div>

    <input ref="fileInputEl" type="file" accept="image/*" class="hidden" @change="onFilePick" />

    <!-- ── Export dialog / drawer ──────────────────────────────────────────── -->
    <component :is="isDesktop ? Dialog : Drawer" v-model:open="exportOpen">
      <component :is="isDesktop ? DialogContent : DrawerContent" class="sm:max-w-md">
        <component :is="isDesktop ? DialogHeader : DrawerHeader">
          <component :is="isDesktop ? DialogTitle : DrawerTitle">Export video</component>
          <component :is="isDesktop ? DialogDescription : DrawerDescription">
            Screens repeat in order until the total duration is reached.
          </component>
        </component>

        <div :class="['flex flex-col gap-4 py-2', !isDesktop && 'px-4']">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">File name</label>
            <input
              v-model="exportName"
              placeholder="my-video"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Total duration (seconds)</label>
            <input
              v-model.number="exportTotalDuration"
              type="number"
              :min="totalCycleDuration"
              step="1"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p class="text-xs text-muted-foreground">One cycle = {{ totalCycleDuration.toFixed(1) }}s</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Output resolution</label>
            <select
              v-model="exportResolutionLabel"
              class="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option v-for="r in RESOLUTIONS" :key="r.label" :value="r.label">{{ r.label }}</option>
            </select>
          </div>
          <div v-if="exporting" class="flex flex-col gap-1.5">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>Encoding…</span><span>{{ exportProgress }}%</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-primary transition-all duration-150"
                :style="`width: ${exportProgress}%`"
              />
            </div>
          </div>
        </div>

        <component :is="isDesktop ? DialogFooter : DrawerFooter" :class="['gap-2', !isDesktop && 'px-4 pb-4']">
          <Button variant="outline" :disabled="exporting" @click="exportOpen = false">Cancel</Button>
          <Button :disabled="exporting || !exportName.trim()" @click="doExport">
            <Loader2 v-if="exporting" class="mr-2 size-4 animate-spin" />
            <Download v-else class="mr-2 size-4" />
            Export
          </Button>
        </component>
      </component>
    </component>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { usePageContext } from "vike-vue/usePageContext";
import draggable from "vuedraggable";
import {
  Film,
  Plus,
  X,
  GripVertical,
  ChevronLeft,
  Image as ImageIcon,
  Upload,
  Download,
  Loader2,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Resolution {
  width: number;
  height: number;
}
interface Screen {
  id: string;
  name: string;
  image: string | null;
  duration: number;
  resolution: Resolution;
  fit: "contain" | "cover";
  offsetX: number; // -100..100 (used in cover mode)
  offsetY: number;
}
interface Project {
  id: string;
  name: string;
  createdAt: string;
  screens: Screen[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RESOLUTIONS = [
  { label: "3840 × 2160 (4K UHD)", width: 3840, height: 2160 },
  { label: "2560 × 1440 (QHD)", width: 2560, height: 1440 },
  { label: "1920 × 1080 (FHD)", width: 1920, height: 1080 },
  { label: "1280 × 720 (HD)", width: 1280, height: 720 },
  { label: "1080 × 1920 (Portrait)", width: 1080, height: 1920 },
  { label: "1080 × 1080 (Square)", width: 1080, height: 1080 },
  { label: "854 × 480 (SD)", width: 854, height: 480 },
] as const;

function resKey(r: Resolution) {
  return RESOLUTIONS.find((p) => p.width === r.width && p.height === r.height)?.label ?? RESOLUTIONS[0].label;
}

// ─── Storage ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "videoProjects";
function allProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function save() {
  const all = allProjects();
  const idx = all.findIndex((p) => p.id === project.value?.id);
  if (idx !== -1 && project.value) {
    all[idx] = project.value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}

// ─── Route param ──────────────────────────────────────────────────────────────
const pageContext = usePageContext();
const projectId = (pageContext.routeParams as Record<string, string>).id;

// ─── State ────────────────────────────────────────────────────────────────────
const isDesktop = useMediaQuery("(min-width: 768px)");
const project = ref<Project | null>(null);
const selectedId = ref<string | null>(null);
const dragOver = ref(false);
const canvasEl = ref<HTMLCanvasElement | null>(null);
const fileInputEl = ref<HTMLInputElement | null>(null);

const exportOpen = ref(false);
const exporting = ref(false);
const exportProgress = ref(0);
const exportName = ref("video");
const exportTotalDuration = ref(10);
const exportResolutionLabel = ref<string>(RESOLUTIONS[0].label);

onMounted(() => {
  const found = allProjects().find((p) => p.id === projectId) ?? null;
  project.value = found;
  if (found) {
    exportName.value = found.name;
    selectedId.value = found.screens[0]?.id ?? null;
  }
});

// ─── Computed ─────────────────────────────────────────────────────────────────
const selectedScreen = computed<Screen | null>(
  () => project.value?.screens.find((s) => s.id === selectedId.value) ?? null,
);

const totalCycleDuration = computed(() =>
  (project.value?.screens ?? []).reduce((sum, s) => sum + (s.duration || 0), 0),
);

// ─── Canvas ───────────────────────────────────────────────────────────────────

/** Shared drawing helper used by both the preview canvas and the export encoder. */
function applyImageFit(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  src: HTMLImageElement | ImageBitmap,
  cw: number,
  ch: number,
  fit: Screen["fit"],
  offsetX: number,
  offsetY: number,
) {
  const iw = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const ih = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  if (fit === "cover") {
    const scale = Math.max(cw / iw, ch / ih);
    const w = iw * scale,
      h = ih * scale;
    // Map offsetX/Y ∈ [-100, 100] → draw origin so image edge aligns at -100 / +100
    const x = ((cw - w) * (offsetX + 100)) / 200;
    const y = ((ch - h) * (offsetY + 100)) / 200;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.clip();
    ctx.drawImage(src as any, x, y, w, h);
    ctx.restore();
  } else {
    const scale = Math.min(cw / iw, ch / ih);
    const w = iw * scale,
      h = ih * scale;
    ctx.drawImage(src as any, (cw - w) / 2, (ch - h) / 2, w, h);
  }
}

// Cache loaded images so redraws (e.g. offset sliders) are synchronous.
const _imgCache = new Map<string, HTMLImageElement>();

function _getImage(src: string): HTMLImageElement | null {
  if (_imgCache.has(src)) return _imgCache.get(src)!;
  const img = new Image();
  img.onload = () => {
    _imgCache.set(src, img);
    drawCanvas();
  };
  img.src = src;
  return null; // will redraw via onload
}

function drawCanvas() {
  const screen = selectedScreen.value;
  const canvas = canvasEl.value;
  if (!canvas || !screen) return;
  canvas.width = screen.resolution.width;
  canvas.height = screen.resolution.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (screen.image) {
    const img = _getImage(screen.image);
    if (img) {
      applyImageFit(
        ctx,
        img,
        canvas.width,
        canvas.height,
        screen.fit ?? "contain",
        screen.offsetX ?? 0,
        screen.offsetY ?? 0,
      );
    }
    // else: onload will call drawCanvas() once the image is ready
  }
}

// Only watch things that require a full reload. offset/fit are handled
// directly in their action functions to avoid async-image flickering.
watch(
  [selectedId, () => selectedScreen.value?.image, () => selectedScreen.value?.resolution],
  () => nextTick(drawCanvas),
  { deep: true },
);

// ─── Screen actions ───────────────────────────────────────────────────────────
function addScreen() {
  if (!project.value) return;
  const id = crypto.randomUUID();
  project.value.screens.push({
    id,
    name: `Screen ${project.value.screens.length + 1}`,
    image: null,
    duration: 3,
    resolution: { width: 1920, height: 1080 },
    fit: "contain",
    offsetX: 0,
    offsetY: 0,
  });
  selectedId.value = id;
  save();
}

function removeScreen(id: string) {
  if (!project.value) return;
  const idx = project.value.screens.findIndex((s) => s.id === id);
  project.value.screens.splice(idx, 1);
  if (selectedId.value === id) {
    selectedId.value = project.value.screens[idx]?.id ?? project.value.screens[idx - 1]?.id ?? null;
  }
  save();
}

function onResolutionChange(e: Event) {
  const label = (e.target as HTMLSelectElement).value;
  const res = RESOLUTIONS.find((r) => r.label === label);
  if (res && selectedScreen.value) {
    selectedScreen.value.resolution = { width: res.width, height: res.height };
    nextTick(drawCanvas);
    save();
  }
}

function clearImage() {
  if (!selectedScreen.value) return;
  selectedScreen.value.image = null;
  nextTick(drawCanvas);
  save();
}

function setFit(fit: Screen["fit"]) {
  if (!selectedScreen.value) return;
  selectedScreen.value.fit = fit;
  drawCanvas(); // synchronous — image already cached
  save();
}

let _saveOffsetTimer: ReturnType<typeof setTimeout> | null = null;
function onOffsetChange(axis: "x" | "y", value: number) {
  if (!selectedScreen.value) return;
  if (axis === "x") selectedScreen.value.offsetX = value;
  else selectedScreen.value.offsetY = value;
  drawCanvas(); // synchronous — image already cached, no flicker
  // Debounce localStorage write so rapid drags don't thrash storage
  if (_saveOffsetTimer) clearTimeout(_saveOffsetTimer);
  _saveOffsetTimer = setTimeout(() => {
    save();
    _saveOffsetTimer = null;
  }, 150);
}

function resetOffset() {
  if (!selectedScreen.value) return;
  selectedScreen.value.offsetX = 0;
  selectedScreen.value.offsetY = 0;
  drawCanvas();
  save();
}

// ─── Image pick / drop ────────────────────────────────────────────────────────
function pickImage() {
  fileInputEl.value?.click();
}

function onFilePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) readImageFile(file);
  (e.target as HTMLInputElement).value = "";
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  if (!selectedScreen.value) return;
  const file = e.dataTransfer?.files?.[0];
  if (file?.type.startsWith("image/")) readImageFile(file);
}

function readImageFile(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    if (selectedScreen.value) {
      selectedScreen.value.image = reader.result as string;
      nextTick(drawCanvas);
      save();
    }
  };
  reader.readAsDataURL(file);
}

// ─── Export ───────────────────────────────────────────────────────────────────
async function doExport() {
  if (!project.value) return;
  if (!("VideoEncoder" in window)) {
    alert("Your browser does not support WebCodecs.\nPlease use Chrome 94+ or Edge 94+.");
    return;
  }
  exporting.value = true;
  exportProgress.value = 0;
  try {
    const fps = 30;
    const resOpt = RESOLUTIONS.find((r) => r.label === exportResolutionLabel.value) ?? RESOLUTIONS[0];
    const { width, height } = resOpt;
    const totalDur = Math.max(exportTotalDuration.value, totalCycleDuration.value);
    const screens = project.value.screens;

    const sequence: { screen: Screen; duration: number }[] = [];
    let remaining = totalDur,
      safety = 0;
    while (remaining > 0.001 && safety++ < 10_000) {
      for (const screen of screens) {
        if (remaining <= 0.001) break;
        const dur = Math.min(screen.duration, remaining);
        sequence.push({ screen, duration: dur });
        remaining -= dur;
      }
    }

    const totalFrames = sequence.reduce((s, { duration }) => s + Math.round(duration * fps), 0);
    let encodedFrames = 0;

    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({ target, video: { codec: "avc", width, height, frameRate: fps }, fastStart: "in-memory" });

    // Pick AVC level based on pixel area:
    //   Level 3.1 (0x1f) → ≤921 600 px  (≤720p)
    //   Level 4.0 (0x28) → ≤2 097 152 px (≤1080p)
    //   Level 5.1 (0x33) → ≤8 912 896 px (≤4K)
    const area = width * height;
    const avcLevel = area <= 921_600 ? "1f" : area <= 2_097_152 ? "28" : "33";
    const avcCodec = `avc1.6400${avcLevel}`; // High Profile + computed level

    let encodeError: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
      error: (e) => {
        encodeError = e;
      },
    });
    encoder.configure({ codec: avcCodec, width, height, bitrate: 8_000_000, framerate: fps });

    const bitmapCache = new Map<string, ImageBitmap | null>();
    for (const { screen } of sequence) {
      if (!bitmapCache.has(screen.id)) {
        if (screen.image) {
          const blob = await (await fetch(screen.image)).blob();
          bitmapCache.set(screen.id, await createImageBitmap(blob));
        } else {
          bitmapCache.set(screen.id, null);
        }
      }
    }

    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext("2d")!;
    const frameDurUs = Math.round(1_000_000 / fps);
    let timeUs = 0;

    for (const { screen, duration } of sequence) {
      if (encodeError) throw encodeError;
      const frameCount = Math.round(duration * fps);
      const bitmap = bitmapCache.get(screen.id) ?? null;
      for (let i = 0; i < frameCount; i++) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, width, height);
        if (bitmap) {
          applyImageFit(ctx, bitmap, width, height, screen.fit ?? "contain", screen.offsetX ?? 0, screen.offsetY ?? 0);
        }
        const frame = new VideoFrame(offscreen, { timestamp: timeUs, duration: frameDurUs });
        encoder.encode(frame, { keyFrame: i === 0 });
        frame.close();
        timeUs += frameDurUs;
        exportProgress.value = Math.round((++encodedFrames / totalFrames) * 92);
        if (encodedFrames % 15 === 0) await new Promise((r) => setTimeout(r, 0));
      }
    }

    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
    exportProgress.value = 100;

    const blob = new Blob([(target as ArrayBufferTarget).buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `${exportName.value.trim() || "video"}.mp4`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    exportOpen.value = false;
  } catch (err) {
    console.error("Export failed:", err);
    alert("Export failed:\n" + String(err));
  } finally {
    exporting.value = false;
    exportProgress.value = 0;
  }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.1s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
