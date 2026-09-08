import apiClient from "./client";

/**
 * GET /api/v1/recommendations paginé/triable/filtrable côté serveur, même
 * enveloppe {items, total, page, limit} que /api/v1/alerts (voir
 * enervision-api/app/routers/recommendations.py).
 */
export async function fetchRecommendations({
  siteId,
  status,
  sortBy = "timestamp",
  order = "desc",
  page = 1,
  limit = 25,
} = {}) {
  const { data } = await apiClient.get("/api/v1/recommendations", {
    params: {
      site_id: siteId,
      status,
      sort_by: sortBy,
      order,
      page,
      limit,
    },
  });
  return data;
}
