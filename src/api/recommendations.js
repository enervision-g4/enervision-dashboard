import apiClient from "./client";

/**
 * GET /api/v1/recommendations (voir enervision-api/app/routers/recommendations.py).
 * Contrairement à /api/v1/alerts, cette route renvoie une simple liste (pas
 * d'enveloppe {items, total, page, limit}) : pas de pagination serveur, juste
 * les `limit` recommandations les plus récentes, triées par date de
 * génération décroissante.
 */
export async function fetchRecommendations({ siteId, status, limit = 50 } = {}) {
  const { data } = await apiClient.get("/api/v1/recommendations", {
    params: { site_id: siteId, status, limit },
  });
  return data;
}
