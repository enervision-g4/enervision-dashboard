import apiClient from "./client";

/**
 * `rangeHours` (ex. 1, 6, 24, 24*7) fait calculer la fenêtre par le serveur,
 * ancrée sur la donnée la plus récente réellement en base plutôt que sur
 * l'horloge du navigateur (voir app/routers/readings.py) — à préférer pour
 * un sélecteur de période. `startTime`/`endTime` restent disponibles pour un
 * filtrage par dates absolues.
 */
export async function fetchReadings({ siteId, startTime, endTime, rangeHours, limit = 100 } = {}) {
  const { data } = await apiClient.get("/api/v1/readings", {
    params: {
      site_id: siteId,
      start_time: startTime,
      end_time: endTime,
      range_hours: rangeHours,
      limit,
    },
  });
  return data;
}
