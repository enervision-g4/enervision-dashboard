import { beforeEach, describe, expect, it, vi } from "vitest";

describe("useTheme", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("est en mode clair par défaut", async () => {
    const { useTheme } = await import("@/composables/useTheme");
    const { theme } = useTheme();

    expect(theme.value).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("bascule vers le mode sombre puis revient au clair", async () => {
    const { useTheme } = await import("@/composables/useTheme");
    const { theme, toggleTheme } = useTheme();

    toggleTheme();
    expect(theme.value).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    toggleTheme();
    expect(theme.value).toBe("light");
  });

  it("mémorise le thème choisi en localStorage", async () => {
    const { useTheme } = await import("@/composables/useTheme");
    const { toggleTheme } = useTheme();

    toggleTheme();

    expect(localStorage.getItem("enervision_theme")).toBe("dark");
  });

  it("relit le thème mémorisé au prochain chargement", async () => {
    localStorage.setItem("enervision_theme", "dark");

    const { useTheme } = await import("@/composables/useTheme");
    const { theme } = useTheme();

    expect(theme.value).toBe("dark");
  });
});
