import apiClient from "./client";

export async function fetchReadings({ siteId, startTime, endTime, limit = 100 } = {}) {
  const { data } = await apiClient.get("/api/v1/readings", {
    params: { site_id: siteId, start_time: startTime, end_time: endTime, limit },
  });
  return data;
}
