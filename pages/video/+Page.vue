<template>
  <div class="flex flex-col gap-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Video Creator</h1>
        <p class="text-sm text-muted-foreground">Create and manage your video projects.</p>
      </div>
      <Button @click="createOpen = true">
        <Plus class="mr-2 size-4" />
        New project
      </Button>
    </div>

    <!-- Project grid -->
    <div v-if="projects.length === 0" class="flex flex-col items-center gap-3 py-20 text-muted-foreground">
      <Film class="size-12 opacity-20" />
      <p class="text-sm opacity-50">No projects yet. Create one to get started.</p>
    </div>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div
        v-for="project in projects"
        :key="project.id"
        class="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
      >
        <!-- Thumbnail strip -->
        <div class="flex h-20 w-full gap-1 overflow-hidden rounded-md bg-black">
          <template v-if="project.screens.length > 0">
            <div v-for="(screen, i) in project.screens.slice(0, 4)" :key="i" class="flex-1 overflow-hidden">
              <img v-if="screen.image" :src="screen.image" class="h-full w-full object-cover" />
              <div v-else class="flex h-full w-full items-center justify-center bg-muted/10">
                <ImageIcon class="size-4 text-muted-foreground/30" />
              </div>
            </div>
          </template>
          <div v-else class="flex flex-1 items-center justify-center">
            <Film class="size-6 text-muted-foreground/20" />
          </div>
        </div>
        <!-- Info -->
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-semibold">{{ project.name }}</p>
            <p class="text-xs text-muted-foreground">
              {{ project.screens.length }} screen{{ project.screens.length !== 1 ? "s" : "" }} ·
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
          <a :href="`/video/${project.id}`">Open</a>
        </Button>
      </div>
    </div>
  </div>

  <!-- Create -->
  <component :is="isDesktop ? Dialog : Drawer" v-model:open="createOpen">
    <component :is="isDesktop ? DialogContent : DrawerContent" class="sm:max-w-sm">
      <component :is="isDesktop ? DialogHeader : DrawerHeader">
        <component :is="isDesktop ? DialogTitle : DrawerTitle">New project</component>
        <component :is="isDesktop ? DialogDescription : DrawerDescription">Give your video project a name.</component>
      </component>
      <div :class="['py-2', !isDesktop && 'px-4']">
        <input
          v-model="newName"
          placeholder="My video"
          class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @keydown.enter="createProject"
        />
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
          <strong>{{ deleteTarget?.name }}</strong> and all its screens will be permanently deleted.
        </component>
      </component>
      <component :is="isDesktop ? DialogFooter : DrawerFooter" :class="['gap-2', !isDesktop && 'px-4 pb-4']">
        <Button variant="outline" @click="deleteOpen = false">Cancel</Button>
        <Button variant="destructive" @click="confirmDelete">Delete</Button>
      </component>
    </component>
  </component>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { Film, Plus, Pencil, Trash2, MoreHorizontal, Image as ImageIcon } from "lucide-vue-next";
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

interface Screen {
  id: string;
  name: string;
  image: string | null;
  duration: number;
  resolution: { width: number; height: number };
}
interface Project {
  id: string;
  name: string;
  createdAt: string;
  screens: Screen[];
}

const STORAGE_KEY = "videoProjects";
function loadProjects(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveProjects(ps: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ps));
}

const isDesktop = useMediaQuery("(min-width: 768px)");
const projects = ref<Project[]>([]);

const createOpen = ref(false);
const newName = ref("");
const renameOpen = ref(false);
const renameTarget = ref<Project | null>(null);
const renameName = ref("");
const deleteOpen = ref(false);
const deleteTarget = ref<Project | null>(null);

onMounted(() => {
  projects.value = loadProjects();
});

function createProject() {
  if (!newName.value.trim()) return;
  const project: Project = {
    id: crypto.randomUUID(),
    name: newName.value.trim(),
    createdAt: new Date().toISOString(),
    screens: [],
  };
  projects.value.unshift(project);
  saveProjects(projects.value);
  createOpen.value = false;
  newName.value = "";
  window.location.href = `/video/${project.id}`;
}

function startRename(project: Project) {
  renameTarget.value = project;
  renameName.value = project.name;
  renameOpen.value = true;
}
function confirmRename() {
  if (!renameTarget.value || !renameName.value.trim()) return;
  renameTarget.value.name = renameName.value.trim();
  saveProjects(projects.value);
  renameOpen.value = false;
}

function startDelete(project: Project) {
  deleteTarget.value = project;
  deleteOpen.value = true;
}
function confirmDelete() {
  if (!deleteTarget.value) return;
  projects.value = projects.value.filter((p) => p.id !== deleteTarget.value!.id);
  saveProjects(projects.value);
  deleteOpen.value = false;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
