import axios from "axios";

/**
 * Résolution de l'URL de l'API, par ordre de priorité :
 * 1. window.APP_CONFIG.API_URL — injecté au démarrage du conteneur en prod
 *    (voir docker/entrypoint.sh), à partir de API_URL dans
 *    enervision-devops/compose/dashboard.yml.
 * 2. VITE_API_URL — dev local sans passer par le proxy Vite.
 * 3. /api-proxy — dev local via le proxy Vite (voir vite.config.js), évite
 *    les soucis de CORS avec l'API lancée sur localhost:3000.
 */
function resolveApiBaseUrl() {
  if (typeof window !== "undefined" && window.APP_CONFIG?.API_URL) {
    return window.APP_CONFIG.API_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return "/api-proxy";
}

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
});

// Attache le token JWT (stocké par le store d'auth) à chaque requête.
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("enervision_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Un 401 = token invalide/expiré : on nettoie et on renvoie vers /login.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("enervision_token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;
