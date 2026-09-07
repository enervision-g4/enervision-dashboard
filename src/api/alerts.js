import apiClient from "./client";

/**
 * GET /api/v1/alerts paginé/triable/filtrable côté serveur (voir
 * enervision-api/app/routers/alerts.py). Répond {items, total, page, limit}.
 */
export async function fetchAlerts({
  siteId,
  severity,
  startTime,
  endTime,
  sortBy = "timestamp",
  order = "desc",
  page = 1,
  limit = 20,
} = {}) {
  const { data } = await apiClient.get("/api/v1/alerts", {
    params: {
      site_id: siteId,
      severity,
      start_time: startTime,
      end_time: endTime,
      sort_by: sortBy,
      order,
      page,
      limit,
    },
  });
  return data;
}

/** Nombre d'alertes par sévérité — page d'accueil (tuiles de résumé). */
export async function fetchAlertsSummary({ siteId, startTime, endTime } = {}) {
  const { data } = await apiClient.get("/api/v1/alerts/summary", {
    params: { site_id: siteId, start_time: startTime, end_time: endTime },
  });
  return data;
}
