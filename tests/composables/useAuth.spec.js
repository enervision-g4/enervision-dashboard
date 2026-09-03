import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/auth", () => ({
  login: vi.fn(),
}));

import { login as apiLogin } from "@/api/auth";
import { useAuth } from "@/composables/useAuth";

describe("useAuth", () => {
  // Note : useAuth() partage un ref module-level (token) entre tous les
  // appels, comme dans l'implémentation réelle — c'est voulu (état d'auth
  // global partagé par toute l'app), mais ça veut dire que les tests de ce
  // fichier ne sont pas totalement isolés les uns des autres sur
  // isAuthenticated. On nettoie donc explicitement via logout() plutôt que
  // de compter sur un état "vierge" à chaque test.
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuth().logout();
  });

  it("n'est pas authentifié par défaut", () => {
    const { isAuthenticated } = useAuth();
    expect(isAuthenticated.value).toBe(false);
  });

  it("stocke le token et passe isAuthenticated à true après un login réussi", async () => {
    apiLogin.mockResolvedValueOnce({ access_token: "abc123", token_type: "bearer" });

    const { login, isAuthenticated } = useAuth();
    await login("admin", "secret");

    expect(isAuthenticated.value).toBe(true);
    expect(localStorage.getItem("enervision_token")).toBe("abc123");
  });

  it("propage l'erreur si le login échoue, sans stocker de token", async () => {
    apiLogin.mockRejectedValueOnce(new Error("401"));

    const { login } = useAuth();
    await expect(login("admin", "wrong")).rejects.toThrow("401");
    expect(localStorage.getItem("enervision_token")).toBeNull();
  });

  it("logout supprime le token", async () => {
    apiLogin.mockResolvedValueOnce({ access_token: "abc123" });
    const { login, logout, isAuthenticated } = useAuth();
    await login("admin", "secret");

    logout();

    expect(isAuthenticated.value).toBe(false);
    expect(localStorage.getItem("enervision_token")).toBeNull();
  });
});
