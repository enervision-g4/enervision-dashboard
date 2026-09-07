import { ref, watchEffect } from "vue";

const STORAGE_KEY = "enervision_sidebar_collapsed";

const collapsed = ref(localStorage.getItem(STORAGE_KEY) === "1");

watchEffect(
  () => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed.value ? "1" : "0");
    } catch {
      // Non bloquant : juste pas mémorisé pour la prochaine visite.
    }
  },
  { flush: "sync" },
);

export function useSidebar() {
  function toggleSidebar() {
    collapsed.value = !collapsed.value;
  }

  return { collapsed, toggleSidebar };
}
