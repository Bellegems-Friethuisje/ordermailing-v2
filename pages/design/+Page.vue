<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Design Editor</h1>
        <p class="text-sm text-muted-foreground">Create and export artboards as PNG or JPG.</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="svgInputEl?.click()">
          <FileCode2 class="mr-2 size-4" />
          Import SVG
        </Button>
        <Button @click="createOpen = true">
          <Plus class="mr-2 size-4" />
          New project
        </Button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="projects.length === 0" class="flex flex-col items-center gap-3 py-20 text-muted-foreground">
      <PenTool class="size-12 opacity-20" />
      <p class="text-sm opacity-50">No projects yet. Create one to get started.</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div
        v-for="project in projects"
        :key="project.id"
        class="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <!-- Thumbnail -->
        <div
          class="flex w-full items-center justify-center overflow-hidden rounded-md"
          :style="{
            aspectRatio: `${project.artboard.width}/${project.artboard.height}`,
            background: project.artboard.background || '#ffffff',
            maxHeight: '140px',
          }"
        >
          <canvas
            v-if="thumbs[project.id]"
            :ref="(el) => setCanvasRef(el as HTMLCanvasElement | null, project.id)"
            class="h-full w-full object-contain"
          />
          <div v-else class="flex flex-col items-center gap-1 text-center">
            <PenTool class="size-5 opacity-20" />
            <span class="text-xs opacity-30"
              >{{ project.artboard.elements.length }} element{{
                project.artboard.elements.length !== 1 ? "s" : ""
              }}</span
            >
          </div>
        </div>

        <!-- Info -->
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ project.name }}</p>
            <p class="text-xs text-muted-foreground">
              {{ project.artboard.elements.length }} element{{ project.artboard.elements.length !== 1 ? "s" : "" }} ·
              {{ project.artboard.width }}×{{ project.artboard.height }} ·
              {{ formatDate(project.createdAt) }}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreHorizontal class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="startRename(project)">
                <Pencil class="mr-2 size-3.5" />Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem class="text-destructive focus:text-destructive" @click="startDelete(project)">
                <Trash2 class="mr-2 size-3.5" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button as-child size="sm" class="w-full">
          <a :href="`/design/${project.id}`">Open</a>
        </Button>
      </div>
    </div>
  </div>

  <!-- Create dialog -->
  <component :is="isDesktop ? Dialog : Drawer" v-model:open="createOpen">
    <component :is="isDesktop ? DialogContent : DrawerContent" class="sm:max-w-sm">
      <component :is="isDesktop ? DialogHeader : DrawerHeader">
        <component :is="isDesktop ? DialogTitle : DrawerTitle">New project</component>
        <component :is="isDesktop ? DialogDescription : DrawerDescription">Give your design project a name.</component>
      </component>
      <div :class="['flex flex-col gap-3 py-2', !isDesktop && 'px-4']">
        <input
          v-model="newName"
          placeholder="My design"
          class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @keydown.enter="createProject"
        />
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-muted-foreground">Artboard size</label>
          <select
            v-model="newPreset"
            class="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option v-for="p in PRESETS" :key="p.label" :value="p.label">{{ p.label }}</option>
          </select>
        </div>
      </div>
      <component :is="isDesktop ? DialogFooter : DrawerFooter" :class="['gap-2', !isDesktop && 'px-4 pb-4']">
        <Button variant="outline" @click="createOpen = false">Cancel</Button>
        <Button :disabled="!newName.trim()" @click="createProject">Create</Button>
      </component>
    </component>
  </component>

  <!-- Rename -->
  <component :is="isDesktop ? Dialog : Drawer" v-model:open="renameOpen">
    <component :is="isDesktop ? DialogContent : DrawerContent" class="sm:max-w-sm">
      <component :is="isDesktop ? DialogHeader : DrawerHeader">
        <component :is="isDesktop ? DialogTitle : DrawerTitle">Rename project</component>
      </component>
      <div :class="['py-2', !isDesktop && 'px-4']">
        <input
          v-model="renameName"
          class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @keydown.enter="confirmRename"
        />
      </div>
      <component :is="isDesktop ? DialogFooter : DrawerFooter" :class="['gap-2', !isDesktop && 'px-4 pb-4']">
        <Button variant="outline" @click="renameOpen = false">Cancel</Button>
        <Button :disabled="!renameName.trim()" @click="confirmRename">Save</Button>
      </component>
    </component>
  </component>

  <!-- Delete -->
  <component :is="isDesktop ? Dialog : Drawer" v-model:open="deleteOpen">
    <component :is="isDesktop ? DialogContent : DrawerContent" class="sm:max-w-sm">
      <component :is="isDesktop ? DialogHeader : DrawerHeader">
        <component :is="isDesktop ? DialogTitle : DrawerTitle">Delete project?</component>
        <component :is="isDesktop ? DialogDescription : DrawerDescription">
          <strong>{{ deleteTarget?.name }}</strong> will be permanently deleted.
        </component>
      </component>
      <component :is="isDesktop ? DialogFooter : DrawerFooter" :class="['gap-2', !isDesktop && 'px-4 pb-4']">
        <Button variant="outline" @click="deleteOpen = false">Cancel</Button>
        <Button variant="destructive" @click="confirmDelete">Delete</Button>
      </component>
    </component>
  </component>
  <!-- Hidden SVG import input -->
  <input ref="svgInputEl" type="file" accept=".svg,image/svg+xml" class="hidden" @change="onSvgPick" />
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { PenTool, Plus, Pencil, Trash2, MoreHorizontal, FileCode2 } from "lucide-vue-next";
import { apiFetch } from "@/lib/apiFetch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DesignElement {
  id: string;
  name: string;
  type: "rect" | "ellipse" | "text" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textAlign?: string;
  fontFamily?: string;
  src?: string;
  objectFit?: "contain" | "cover";
  offsetX?: number;
  offsetY?: number;
}
export interface DesignProject {
  id: string;
  name: string;
  createdAt: string;
  artboard: { width: number; height: number; background: string; elements: DesignElement[] };
}

const PRESETS = [
  { label: "1920 × 1080 (FHD)", width: 1920, height: 1080 },
  { label: "2560 × 1440 (QHD)", width: 2560, height: 1440 },
  { label: "3840 × 2160 (4K)", width: 3840, height: 2160 },
  { label: "1280 × 720 (HD)", width: 1280, height: 720 },
  { label: "1080 × 1080 (Square)", width: 1080, height: 1080 },
  { label: "1080 × 1920 (Portrait)", width: 1080, height: 1920 },
  { label: "390 × 844 (Mobile)", width: 390, height: 844 },
  { label: "1440 × 900 (Desktop)", width: 1440, height: 900 },
  { label: "210 × 297 (A4 Portrait mm×10)", width: 2100, height: 2970 },
] as const;

const isDesktop = useMediaQuery("(min-width: 768px)");
const projects = ref<DesignProject[]>([]);
const thumbs = ref<Record<string, boolean>>({});
const svgInputEl = ref<HTMLInputElement | null>(null);
const createOpen = ref(false);
const newName = ref("");
const newPreset = ref(PRESETS[0].label);
const renameOpen = ref(false);
const renameTarget = ref<DesignProject | null>(null);
const renameName = ref("");
const deleteOpen = ref(false);
const deleteTarget = ref<DesignProject | null>(null);

onMounted(async () => {
  try {
    const res = await apiFetch("/api/designs");
    if (res.ok) {
      projects.value = await res.json();
    }
  } catch {
    // silently ignore — user may not be logged in yet
  }
});

function setCanvasRef(_el: HTMLCanvasElement | null, _id: string) {
  // Placeholder – thumbnails rendered on open via canvas
}

async function createProject() {
  if (!newName.value.trim()) return;
  const preset = PRESETS.find((p) => p.label === newPreset.value) ?? PRESETS[0];
  const project: DesignProject = {
    id: crypto.randomUUID(),
    name: newName.value.trim(),
    createdAt: new Date().toISOString(),
    artboard: { width: preset.width, height: preset.height, background: "#ffffff", elements: [] },
  };
  await apiFetch("/api/designs", {
    method: "POST",
    body: JSON.stringify(project),
  });
  createOpen.value = false;
  newName.value = "";
  window.location.href = `/design/${project.id}`;
}

function startRename(p: DesignProject) {
  renameTarget.value = p;
  renameName.value = p.name;
  renameOpen.value = true;
}
async function confirmRename() {
  if (!renameTarget.value || !renameName.value.trim()) return;
  await apiFetch(`/api/designs/${renameTarget.value.id}/rename`, {
    method: "PATCH",
    body: JSON.stringify({ name: renameName.value.trim() }),
  });
  renameTarget.value.name = renameName.value.trim();
  renameOpen.value = false;
}
function startDelete(p: DesignProject) {
  deleteTarget.value = p;
  deleteOpen.value = true;
}
async function confirmDelete() {
  if (!deleteTarget.value) return;
  await apiFetch(`/api/designs/${deleteTarget.value.id}`, { method: "DELETE" });
  projects.value = projects.value.filter((p) => p.id !== deleteTarget.value!.id);
  deleteOpen.value = false;
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── SVG import ───────────────────────────────────────────────────────────────
function onSvgPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  (e.target as HTMLInputElement).value = "";
  const name = file.name.replace(/\.svg$/i, "");
  const reader = new FileReader();
  reader.onload = () => importSvgAsProject(name, reader.result as string);
  reader.readAsText(file);
}

async function importSvgAsProject(fileName: string, text: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "image/svg+xml");
  const svgEl = doc.documentElement as unknown as SVGSVGElement;

  // ── Artboard size ────────────────────────────────────────────────────────────
  let aw = parseFloat(svgEl.getAttribute("width") ?? "0");
  let ah = parseFloat(svgEl.getAttribute("height") ?? "0");
  const vb = svgEl.getAttribute("viewBox");
  if (vb) {
    const pts = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if ((!aw || isNaN(aw)) && pts[2]) aw = pts[2];
    if ((!ah || isNaN(ah)) && pts[3]) ah = pts[3];
  }
  if (!aw || isNaN(aw)) aw = 1920;
  if (!ah || isNaN(ah)) ah = 1080;

  // ── Off-screen live host ─────────────────────────────────────────────────────
  // We inject the full SVG markup so <defs>, <style>, inherited styles, and
  // transforms all resolve correctly. width = SVG user units so getCTM() gives
  // coordinates in the same space as the artboard (1 px = 1 SVG user unit).
  const host = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGSVGElement;
  host.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  host.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  host.setAttribute("width", String(aw));
  host.setAttribute("height", String(ah));
  host.setAttribute("viewBox", vb ?? `0 0 ${aw} ${ah}`);
  Object.assign(host.style, {
    position: "fixed",
    top: "-9999px",
    left: "0",
    width: `${aw}px`,
    height: `${ah}px`,
    opacity: "0",
    pointerEvents: "none",
    overflow: "visible",
  });
  host.innerHTML = svgEl.innerHTML;
  document.body.appendChild(host);

  const elements: DesignElement[] = [];
  let bg = "#ffffff";

  // Async image-bounds resolution for raster <image> elements
  type PendingImage = {
    index: number;
    href: string;
    boxX: number;
    boxY: number;
    boxW: number;
    boxH: number;
    par: string;
  };
  const pendingImages: PendingImage[] = [];

  function attrVal(el: Element, ...names: string[]): string {
    for (const n of names) {
      // Handle namespace-qualified attrs like xlink:href
      if (n === "xlink:href") {
        const v = el.getAttributeNS("http://www.w3.org/1999/xlink", "href");
        if (v) return v;
      } else {
        const v = el.getAttribute(n);
        if (v) return v;
      }
    }
    return "";
  }
  function resolveColor(v: string, fallback = "transparent") {
    return !v || v === "none" ? fallback : v;
  }

  // Collect ALL <defs> and <style> content from the host so every snippet can reference
  // CSS classes, gradients, clip-paths, markers, etc.
  const defsBlock = (() => {
    const parts: string[] = [];
    for (const d of host.querySelectorAll(":scope > defs")) parts.push(d.outerHTML);
    for (const s of host.querySelectorAll(":scope > style")) parts.push(s.outerHTML);
    return parts.join("");
  })();

  function makeSnippetSrc(el: SVGGraphicsElement, lx: number, ly: number, lw: number, lh: number) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${lw}" height="${lh}" viewBox="${lx} ${ly} ${lw} ${lh}">${defsBlock}${el.outerHTML}</svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  // getBBox() gives local coords; getCTM() gives local→SVG-viewport matrix.
  function getRootBb(liveEl: SVGGraphicsElement) {
    let localBb: DOMRect;
    try {
      localBb = liveEl.getBBox();
    } catch {
      return null;
    }
    if (localBb.width === 0 && localBb.height === 0) return null;

    const ctm = liveEl.getCTM();
    if (!ctm) return { x: localBb.x, y: localBb.y, width: localBb.width, height: localBb.height, localBb };

    const m = new DOMMatrix([ctm.a, ctm.b, ctm.c, ctm.d, ctm.e, ctm.f]);
    const corners = [
      m.transformPoint(new DOMPoint(localBb.x, localBb.y)),
      m.transformPoint(new DOMPoint(localBb.x + localBb.width, localBb.y)),
      m.transformPoint(new DOMPoint(localBb.x, localBb.y + localBb.height)),
      m.transformPoint(new DOMPoint(localBb.x + localBb.width, localBb.y + localBb.height)),
    ];
    const xs = corners.map((p) => p.x),
      ys = corners.map((p) => p.y);
    const x = Math.min(...xs),
      y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, localBb };
  }

  // Walk the LIVE host tree recursively.
  // - <g> / <symbol>: always recurse so we never serialize huge subtrees as one blob
  // - <image>: native image element with async natural-size trim
  // - <rect>/<circle>/<ellipse>/<text>: native design elements using getComputedStyle for colors
  // - everything else (path, polygon, use…): SVG snippet that INCLUDES defsBlock so
  //   CSS classes and gradient/clip-path references resolve correctly
  function processLiveNode(node: Element, depth = 0) {
    if (depth > 40) return;
    const tag = node.tagName.replace(/.*:/, "").toLowerCase();
    if (["defs", "style", "title", "desc", "metadata", "sodipodi:namedview"].includes(tag)) return;
    // skip namespace-prefixed non-SVG elements (sodipodi:*, inkscape:*, etc.)
    if (node.tagName.includes(":") && !["svg", "use", "image", "text", "flowroot"].includes(tag)) return;

    // Groups — always recurse; never serialize a whole group as one blob
    if (tag === "g" || tag === "symbol") {
      for (const child of node.children) processLiveNode(child, depth + 1);
      return;
    }

    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return;

    const gr = getRootBb(node as SVGGraphicsElement);
    if (!gr) return;
    const { x, y, width, height, localBb } = gr;
    if (width < 3 || height < 3) return;

    const opacity = parseFloat(cs.opacity || "1");
    const rawFill = cs.fill || attrVal(node, "fill");
    const rawStroke = cs.stroke || attrVal(node, "stroke");
    const fill = resolveColor(rawFill, "#000000");
    const stroke = resolveColor(rawStroke);
    const sw = parseFloat(cs.strokeWidth || attrVal(node, "stroke-width") || "0");

    // Background rect heuristic
    if (tag === "rect" && elements.length === 0) {
      if (x <= 2 && y <= 2 && width >= aw * 0.9 && height >= ah * 0.9 && fill !== "transparent") {
        bg = fill;
        return;
      }
    }

    if (tag === "image") {
      const href = attrVal(node, "href", "xlink:href");
      const par = attrVal(node, "preserveAspectRatio") || "xMidYMid meet";
      const idx = elements.length;
      elements.push({
        id: crypto.randomUUID(),
        name: "Image",
        type: "image",
        x,
        y,
        width,
        height,
        opacity,
        src: href,
        objectFit: "contain",
        offsetX: 0,
        offsetY: 0,
      });
      pendingImages.push({ index: idx, href, boxX: x, boxY: y, boxW: width, boxH: height, par });
    } else if (tag === "rect") {
      elements.push({
        id: crypto.randomUUID(),
        name: "Rectangle",
        type: "rect",
        x,
        y,
        width,
        height,
        opacity,
        fill,
        stroke,
        strokeWidth: sw,
        borderRadius: parseFloat(attrVal(node, "rx") || attrVal(node, "ry") || "0"),
      });
    } else if (tag === "circle" || tag === "ellipse") {
      elements.push({
        id: crypto.randomUUID(),
        name: "Ellipse",
        type: "ellipse",
        x,
        y,
        width,
        height,
        opacity,
        fill,
        stroke,
        strokeWidth: sw,
      });
    } else if (tag === "text" || tag === "flowroot") {
      const content = node.textContent?.trim() ?? "";
      const fontSize = parseFloat(cs.fontSize) || 16;
      const anchor = cs.textAnchor || attrVal(node, "text-anchor") || "";
      const color = rawFill === "none" || rawFill === "" ? "#000000" : fill;
      elements.push({
        id: crypto.randomUUID(),
        name: content.slice(0, 20) || "Text",
        type: "text",
        x,
        y,
        width: Math.max(width, 60),
        height: Math.max(height, fontSize * 1.4),
        opacity,
        text: content,
        fontSize,
        fontWeight: cs.fontWeight || "normal",
        color,
        textAlign: anchor === "middle" ? "center" : anchor === "end" ? "right" : "left",
        fontFamily: cs.fontFamily || "inherit",
      });
    } else {
      // path, polygon, polyline, line, use, etc.
      // Include defsBlock so CSS classes / gradients / clip-paths resolve inside the snippet
      const src = makeSnippetSrc(node as SVGGraphicsElement, localBb.x, localBb.y, localBb.width, localBb.height);
      elements.push({
        id: crypto.randomUUID(),
        name: tag.charAt(0).toUpperCase() + tag.slice(1),
        type: "image",
        x,
        y,
        width,
        height,
        opacity,
        src,
        objectFit: "contain",
        offsetX: 0,
        offsetY: 0,
      });
    }
  }

  for (const child of host.children) processLiveNode(child as Element);
  document.body.removeChild(host);

  // Trim each raster image's bounding box to its natural aspect ratio.
  // Inkscape / Illustrator SVGs declare large container boxes and rely on
  // preserveAspectRatio to fit the image. We load the image to get its
  // natural size and apply the same math. Works for data: URIs (embedded
  // base64 images); for relative file paths we fall back to the declared box.
  await Promise.all(
    pendingImages.map(
      ({ index, href, boxX, boxY, boxW, boxH, par }) =>
        new Promise<void>((resolve) => {
          if (!href) {
            resolve();
            return;
          }
          const tryTrim = (nw: number, nh: number) => {
            if (!nw || !nh) {
              resolve();
              return;
            }
            const slice = par.includes("slice");
            const sx = boxW / nw,
              sy = boxH / nh;
            const scale = slice ? Math.max(sx, sy) : Math.min(sx, sy);
            const rw = nw * scale,
              rh = nh * scale;
            const ax = par.includes("xMin") ? 0 : par.includes("xMax") ? 1 : 0.5;
            const ay = par.includes("YMin") ? 0 : par.includes("YMax") ? 1 : 0.5;
            const el = elements[index] as any;
            el.x = boxX + (boxW - rw) * ax;
            el.y = boxY + (boxH - rh) * ay;
            el.width = rw;
            el.height = rh;
            resolve();
          };
          // Try loading directly (works for data: URIs and absolute URLs)
          const img = new window.Image();
          img.onload = () => tryTrim(img.naturalWidth, img.naturalHeight);
          img.onerror = () => resolve(); // relative URL — keep declared bounds
          img.src = href;
        }),
    ),
  );

  const project: DesignProject = {
    id: crypto.randomUUID(),
    name: fileName,
    createdAt: new Date().toISOString(),
    artboard: { width: aw, height: ah, background: bg, elements },
  };
  await apiFetch("/api/designs", {
    method: "POST",
    body: JSON.stringify(project),
  });
  window.location.href = `/design/${project.id}`;
}
</script>
