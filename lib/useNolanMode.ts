import { ref, watch, nextTick } from "vue";
import { useAuth } from "./useAuth";
import { apiFetch } from "./apiFetch";

const nolanMode = ref(false);
let loading = false;

if (typeof window !== "undefined") {
  const { currentUser } = useAuth();

  // Load the setting from the server whenever the signed-in user changes
  watch(
    currentUser,
    async (user) => {
      if (!user) {
        loading = true;
        nolanMode.value = false;
        await nextTick();
        loading = false;
        return;
      }
      try {
        loading = true;
        const res = await apiFetch("/api/users/me");
        const data = await res.json();
        nolanMode.value = data?.settings?.nolanMode === true;
        await nextTick();
        loading = false;
      } catch {
        nolanMode.value = false;
        await nextTick();
        loading = false;
      }
    },
    { immediate: true },
  );

  // Save whenever nolanMode changes, but not during the initial load
  watch(nolanMode, async (val) => {
    if (loading) return;
    if (!currentUser.value) return;
    await apiFetch("/api/users/me/settings", {
      method: "PATCH",
      body: JSON.stringify({ nolanMode: val }),
    });
  });
}

export function useNolanMode() {
  return { nolanMode };
}
