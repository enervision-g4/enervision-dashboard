import { afterEach } from "vitest";

// Un test ne doit jamais voir le token laissé par le précédent.
afterEach(() => {
  localStorage.clear();
  window.APP_CONFIG = undefined;
});
