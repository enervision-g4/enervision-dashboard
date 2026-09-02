import { computed, ref } from "vue";

import { login as apiLogin } from "@/api/auth";

const TOKEN_KEY = "enervision_token";
const token = ref(localStorage.getItem(TOKEN_KEY));

/**
 * Auth minimale par token JWT en localStorage. Suffisant pour un compte de
 * service unique (voir enervision-api/app/security.py) ; à faire évoluer
 * vers un vrai store Pinia si le sujet demande plusieurs profils.
 */
export function useAuth() {
  const isAuthenticated = computed(() => !!token.value);

  async function login(username, password) {
    const { access_token } = await apiLogin(username, password);
    token.value = access_token;
    localStorage.setItem(TOKEN_KEY, access_token);
  }

  function logout() {
    token.value = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  return { isAuthenticated, login, logout };
}
