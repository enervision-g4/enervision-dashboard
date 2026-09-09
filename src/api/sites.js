import apiClient from "./client";

export async function fetchSites() {
  const { data } = await apiClient.get("/api/v1/sites");
  return data;
}

export async function fetchSite(siteId) {
  const { data } = await apiClient.get(`/api/v1/sites/${siteId}`);
  return data;
}
