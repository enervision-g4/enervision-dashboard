import { ref, watchEffect } from "vue";

const STORAGE_KEY = "enervision_theme";

/**
 * Thème clair par défaut (exigence produit), mémorisé en localStorage une
 * fois que l'utilisateur bascule explicitement — pas de détection
 * automatique de prefers-color-scheme, pour que "clair par défaut" reste
 * vrai même sur un poste réglé en sombre par le système.
 */
const theme = ref(localStorage.getItem(STORAGE_KEY) || "light");

watchEffect(
  () => {
    document.documentElement.setAttribute("data-theme", theme.value);
    try {
      localStorage.setItem(STORAGE_KEY, theme.value);
    } catch {
      // localStorage indisponible (navigation privée, quota) : le thème reste
      // actif pour la session en cours, juste pas mémorisé pour la prochaine.
    }
  },
  // flush: "sync" — sans ça l'attribut data-theme (et donc le CSS) ne change
  // qu'au prochain tick Vue, ce qui provoque un flash visible au toggle.
  { flush: "sync" },
);

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === "light" ? "dark" : "light";
  }

  function setTheme(value) {
    theme.value = value === "dark" ? "dark" : "light";
  }

  return { theme, toggleTheme, setTheme };
}
