import { config } from "@vue/test-utils";
import { afterEach } from "vitest";

import i18n from "@/i18n";

// i18n installé par défaut sur tous les mount() : la plupart des composants
// utilisent maintenant $t()/useI18n(), inutile de le répéter dans chaque test.
config.global.plugins.push(i18n);

// Un test ne doit jamais voir le token laissé par le précédent.
afterEach(() => {
  localStorage.clear();
  window.APP_CONFIG = undefined;
});
