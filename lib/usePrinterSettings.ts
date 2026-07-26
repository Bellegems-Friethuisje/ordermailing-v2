import { ref, watch } from "vue";
import { useAuth } from "./useAuth";
import { apiFetch } from "./apiFetch";

// Shared shop-wide thermal printer config, persisted in Firestore so the IP can
// be set once (centrally) and used from every device/user.
const printerIp = ref("");
const loaded = ref(false);

let loadPromise: Promise<void> | null = null;

async function fetchConfig() {
  const res = await apiFetch("/api/print/config");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { ip?: string };
  printerIp.value = typeof data.ip === "string" ? data.ip : "";
  loaded.value = true;
}

// Loads the printer config from the server (cached after the first successful load).
function loadPrinterConfig(force = false): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!force && loaded.value) return Promise.resolve();
  if (!loadPromise || force) {
    loadPromise = fetchConfig()
      .catch(() => {
        /* leave printerIp empty on failure */
      })
      .finally(() => {
        loadPromise = null;
      });
  }
  return loadPromise;
}

if (typeof window !== "undefined") {
  const { currentUser } = useAuth();
  // Load the shared config once a user is signed in; clear it on sign-out.
  watch(
    currentUser,
    (user) => {
      if (user) void loadPrinterConfig(true);
      else {
        printerIp.value = "";
        loaded.value = false;
      }
    },
    { immediate: true },
  );
}

// Saves the shared printer IP to the server.
async function savePrinterConfig(ip: string): Promise<void> {
  const res = await apiFetch("/api/print/config", {
    method: "PUT",
    body: JSON.stringify({ ip: ip.trim() }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string })?.message ?? `HTTP ${res.status}`);
  }
  printerIp.value = ip.trim();
  loaded.value = true;
}

export function usePrinterSettings() {
  return { printerIp, loaded, loadPrinterConfig, savePrinterConfig };
}
