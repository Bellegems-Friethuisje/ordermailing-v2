import { ref, watch } from "vue";

const STORAGE_KEY = "theme";

// Module-level ref so state is shared across components
const isDark = ref(false);

function applyTheme() {
  document.documentElement.classList.toggle("dark", isDark.value);
}

watch(isDark, () => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, isDark.value ? "dark" : "light");
  applyTheme();
});

export function useTheme() {
  function initTheme() {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    isDark.value = stored === "dark";
    applyTheme();
  }

  return {
    isDark,
    toggleTheme: () => {
      isDark.value = !isDark.value;
    },
    initTheme,
  };
}
