import apiClient from "./client";

export async function fetchSites() {
  const { data } = await apiClient.get("/api/v1/sites");
  return data;
}

export async function fetchSite(siteId) {
  const { data } = await apiClient.get(`/api/v1/sites/${siteId}`);
  return data;
}

export async function fetchReadings({ siteId, startTime, endTime, limit = 100 } = {}) {
  const { data } = await apiClient.get("/api/v1/readings", {
    params: { site_id: siteId, start_time: startTime, end_time: endTime, limit },
  });
  return data;
}

export async function fetchAlerts({ siteId, severity } = {}) {
  const { data } = await apiClient.get("/api/v1/alerts", {
    params: { site_id: siteId, severity },
  });
  return data;
}
