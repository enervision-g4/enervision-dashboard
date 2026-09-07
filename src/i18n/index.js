import { createI18n } from "vue-i18n";

import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";

const STORAGE_KEY = "enervision_locale";
const SUPPORTED_LOCALES = ["fr", "en", "de", "es"];

function initialLocale() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  return "fr"; // Français par défaut : équipe et jury francophones.
}

const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: "fr",
  messages: { fr, en, de, es },
});

export function setLocale(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  i18n.global.locale.value = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // localStorage indisponible : la langue reste active pour la session en cours.
  }
}

export { SUPPORTED_LOCALES };
export default i18n;
