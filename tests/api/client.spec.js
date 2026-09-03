import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * client.js résout l'URL de l'API une seule fois, au moment de l'import
 * (création de l'instance axios). On force donc un re-import à chaque test
 * (vi.resetModules) pour observer chaque ordre de priorité indépendamment :
 * window.APP_CONFIG.API_URL > VITE_API_URL > /api-proxy.
 */
describe("resolveApiBaseUrl (via apiClient.defaults.baseURL)", () => {
  beforeEach(() => {
    vi.resetModules();
    window.APP_CONFIG = undefined;
  });

  it("utilise window.APP_CONFIG.API_URL en priorité (cas prod)", async () => {
    window.APP_CONFIG = { API_URL: "https://api.enervision.example" };

    const { default: apiClient } = await import("@/api/client.js");

    expect(apiClient.defaults.baseURL).toBe("https://api.enervision.example");
  });

  it("retombe sur /api-proxy si rien n'est configuré (cas dev par défaut)", async () => {
    const { default: apiClient } = await import("@/api/client.js");

    expect(apiClient.defaults.baseURL).toBe("/api-proxy");
  });
});

describe("intercepteur de requête", () => {
  it("ajoute le header Authorization quand un token est stocké", async () => {
    localStorage.setItem("enervision_token", "fake-token");
    const { default: apiClient } = await import("@/api/client.js");

    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.headers.Authorization).toBe("Bearer fake-token");
  });

  it("n'ajoute rien si aucun token n'est stocké", async () => {
    const { default: apiClient } = await import("@/api/client.js");

    const config = await apiClient.interceptors.request.handlers[0].fulfilled({
      headers: {},
    });

    expect(config.headers.Authorization).toBeUndefined();
  });
});
